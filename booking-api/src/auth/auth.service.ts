import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthLockService } from './auth-lock.service';
import { RedisService } from '../common/redis/redis.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { hashRefreshToken, refreshTokenTtlMs } from '../common/util/refresh-token';
import { normalizePhone } from '../common/util/phone';
import { Prisma, User } from '@prisma/client';
import { createRemoteJWKSet, jwtVerify } from 'jose';

@Injectable()
export class AuthService {
  // Module-level JWKS instance so Apple's key set is cached across requests.
  private readonly appleJWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private notifications: NotificationsService,
    private authLock: AuthLockService,
    private redis: RedisService,
  ) {}

  async register(dto: RegisterDto, ctx?: { ip?: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("Email already registered");

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const { user: result, ownerStaffId } = await this.prisma.$transaction(async (tx) => {
      let businessId: string | undefined;

      if (dto.role === "OWNER") {
        // Brand the new business from the signup form, falling back to the
        // owner's name. Signup also creates labeled demo records so the owner can
        // open each dashboard category and understand what it is for.
        const businessName = dto.businessName?.trim() || `${dto.name}'s Business`;
        const slugSource = (dto.businessName?.trim() || dto.name).toLowerCase();
        const baseSlug = slugSource.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "business";
        const phone = normalizePhone(dto.businessPhone) ?? undefined;

        // Anti-duplicate rule: flag (never block) a new business when an existing
        // one already has the SAME phone AND the same normalized name — a strong
        // signal of a re-registration. It still registers; an admin reviews it.
        let suspectedDuplicateOfId: string | undefined;
        let duplicateNote: string | undefined;
        if (phone) {
          const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
          const samePhone = await tx.business.findMany({ where: { phone }, select: { id: true, name: true } });
          const dup = samePhone.find((b) => norm(b.name) === norm(businessName));
          if (dup) {
            suspectedDuplicateOfId = dup.id;
            duplicateNote = `Possible duplicate of "${dup.name}" (${dup.id}) — same name + phone at signup.`;
          }
        }

        const business = await tx.business.create({
          data: {
            name: businessName,
            slug: `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`,
            email: dto.email,
            phone,
            timezone: dto.timezone?.trim() || undefined,
            suspectedDuplicateOfId,
            verificationNote: duplicateNote,
          },
        });
        businessId = business.id;
      }

      const user = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          role: dto.role,
          businessId,
        },
      });

      // Sole-proprietor model: the owner is automatically a provider so they can
      // take bookings immediately, without adding "staff". Extra staff are
      // optional — the booking flow only shows a provider step once more than one
      // provider exists.
      let ownerStaffId: string | undefined;
      if (user.role === 'OWNER' && businessId) {
        const ownerStaff = await tx.staff.create({ data: { userId: user.id, businessId, active: true } });
        ownerStaffId = ownerStaff.id;
        // Demo seed runs outside this transaction so a seed failure never rolls back sign-up.
      }

      await tx.privacyConsent.createMany({
        data: [
          {
            userId: user.id,
            businessId: businessId ?? null,
            type: 'TERMS',
            granted: true,
            version: dto.consentVersion,
            source: 'registration',
            ipAddress: ctx?.ip?.slice(0, 64) || null,
          },
          {
            userId: user.id,
            businessId: businessId ?? null,
            type: 'PRIVACY_POLICY',
            granted: true,
            version: dto.consentVersion,
            source: 'registration',
            ipAddress: ctx?.ip?.slice(0, 64) || null,
          },
          {
            userId: user.id,
            businessId: businessId ?? null,
            type: 'MARKETING',
            granted: dto.marketingConsent,
            version: dto.consentVersion,
            source: 'registration',
            ipAddress: ctx?.ip?.slice(0, 64) || null,
          },
          {
            userId: user.id,
            businessId: businessId ?? null,
            type: 'TRACKING',
            granted: dto.trackingConsent,
            version: dto.consentVersion,
            source: 'registration',
            ipAddress: ctx?.ip?.slice(0, 64) || null,
          },
        ],
      });

      return { user, ownerStaffId };
    });

    // Seed demo data outside the transaction so any failure is silent and never
    // prevents a new owner from accessing their account.
    if (result.role === 'OWNER' && result.businessId && ownerStaffId) {
      const businessName = dto.businessName?.trim() || `${dto.name}'s Business`;
      void this.prisma.$transaction((tx) =>
        this.createOwnerDemoData(tx, {
          businessId: result.businessId!,
          userId: result.id,
          staffId: ownerStaffId!,
          businessName,
        }),
      ).catch(() => {});
    }

    // Welcome the new owner (best-effort — never block signup on email).
    if (result.role === 'OWNER') {
      this.notifications.sendWelcome(result.id).catch(() => {});
    }
    // Send an email-verification link (best-effort). Verification gates the
    // client portal so email-matched lookups are only trusted once proven.
    this.sendVerification(result.id).catch(() => {});

    return this.issueTokens(result);
  }

  // Completes owner registration for users who signed up via Google/Apple SSO.
  // The SSO flow creates a CLIENT account first; this upgrades it to OWNER,
  // creates the business, and issues fresh tokens reflecting the new role.
  async completeOwnerRegistration(userId: string, businessName: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, businessId: true },
    });

    // Only CLIENT accounts may be upgraded. ADMIN and STAFF must never be
    // silently overwritten — ADMIN because it would destroy elevated privileges,
    // STAFF because it would corrupt their existing business association.
    if (user.role !== 'CLIENT' && !(user.role === 'OWNER' && user.businessId)) {
      throw new ForbiddenException('Only client accounts can complete owner registration');
    }

    // Idempotent — already set up
    if (user.role === 'OWNER' && user.businessId) {
      const full = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      return this.issueTokens(full);
    }

    const name = (businessName?.trim()) || `${user.name}'s Business`;
    const slugSource = name.toLowerCase();
    const baseSlug = slugSource.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'business';

    let ownerStaffId: string;
    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name,
          slug: `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`,
          email: user.email,
        },
      });

      const promoted = await tx.user.update({
        where: { id: userId },
        data: { role: 'OWNER', businessId: business.id },
      });

      const staff = await tx.staff.create({
        data: { userId, businessId: business.id, active: true },
      });
      ownerStaffId = staff.id;

      await tx.privacyConsent.createMany({
        data: [
          { userId, businessId: business.id, type: 'TERMS', granted: true, version: '2026-06-13', source: 'sso_owner_registration', ipAddress: null },
          { userId, businessId: business.id, type: 'PRIVACY_POLICY', granted: true, version: '2026-06-13', source: 'sso_owner_registration', ipAddress: null },
        ],
        skipDuplicates: true,
      });

      return promoted;
    });

    void this.prisma.$transaction((tx) =>
      this.createOwnerDemoData(tx, {
        businessId: updatedUser.businessId!,
        userId,
        staffId: ownerStaffId,
        businessName: name,
      }),
    ).catch(() => {});
    this.notifications.sendWelcome(userId).catch(() => {});

    return this.issueTokens(updatedUser);
  }

  // Allow existing owners to seed demo data on demand (e.g., accounts created
  // before this feature was shipped). Idempotent — skips if already seeded.
  async seedDemoData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, businessId: true },
    });
    if (!user || user.role !== 'OWNER' || !user.businessId) {
      throw new ForbiddenException('Only business owners can seed demo data');
    }
    const already = await this.prisma.client.findFirst({
      where: { businessId: user.businessId, name: 'Demo Client' },
      select: { id: true },
    });
    if (already) return { ok: true, skipped: true };
    const staff = await this.prisma.staff.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!staff) throw new ForbiddenException('No staff record found');
    const business = await this.prisma.business.findUnique({
      where: { id: user.businessId },
      select: { name: true },
    });
    await this.prisma.$transaction((tx) =>
      this.createOwnerDemoData(tx, {
        businessId: user.businessId!,
        userId: user.id,
        staffId: staff.id,
        businessName: business?.name ?? `${user.name}'s Business`,
      }),
    );
    return { ok: true, skipped: false };
  }

  private async createOwnerDemoData(
    tx: Prisma.TransactionClient,
    args: { businessId: string; userId: string; staffId: string; businessName: string },
  ) {
    const now = new Date();
    const addDays = (days: number, hour = 10, minute = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() + days);
      d.setHours(hour, minute, 0, 0);
      return d;
    };
    const nextWeekdayOffset = (() => {
      for (let offset = 1; offset <= 7; offset += 1) {
        const day = addDays(offset).getDay();
        if (day >= 1 && day <= 5) return offset;
      }
      return 1;
    })();
    const previousWeekdayOffset = (() => {
      for (let offset = -1; offset >= -7; offset -= 1) {
        const day = addDays(offset).getDay();
        if (day >= 1 && day <= 5) return offset;
      }
      return -1;
    })();
    const startsAt = addDays(nextWeekdayOffset, 10, 0);
    const endsAt = addDays(nextWeekdayOffset, 10, 45);
    const completedAt = addDays(previousWeekdayOffset, 14, 0);
    const completedEnd = addDays(previousWeekdayOffset, 14, 45);

    await tx.business.update({
      where: { id: args.businessId },
      data: {
        taxRatePercent: 5,
        postVisitMessage: 'Demo: thanks for visiting. Book your next appointment anytime.',
        intakeQuestions: [
          { id: 'demo-allergies', label: 'Demo: any allergies or sensitivities?', required: false },
          { id: 'demo-goal', label: 'Demo: what should we focus on today?', required: true },
        ],
        bookingPageSettings: {
          headline: `Book with ${args.businessName}`,
          intro: 'Demo booking-page text. Replace this with what clients should know before booking.',
          tagline: 'Demo: online booking made simple.',
          brandColor: '#7C3AED',
        },
        notificationSettings: {
          emailConfirmation: true,
          emailReminder24h: true,
          emailCancellation: true,
          emailReschedule: true,
        },
      },
    });

    await tx.businessHours.createMany({
      data: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        businessId: args.businessId,
        dayOfWeek,
        startTime: '09:00',
        endTime: '17:00',
      })),
      skipDuplicates: true,
    });

    const location = await tx.location.create({
      data: {
        businessId: args.businessId,
        name: 'Demo Location',
        address: '123 Demo Street',
        active: true,
      },
    });
    await tx.staff.update({ where: { id: args.staffId }, data: { locationId: location.id, bio: 'Demo provider profile. Update this from Staff.' } });

    const resource = await tx.resource.create({
      data: { businessId: args.businessId, name: 'Demo Room' },
    });
    const category = await tx.serviceCategory.create({
      data: { businessId: args.businessId, name: 'Demo Services', description: 'Sample service category', color: '#7C3AED' },
    });
    const service = await tx.service.create({
      data: {
        businessId: args.businessId,
        categoryId: category.id,
        resourceId: resource.id,
        name: 'Demo Consultation',
        description: 'A sample service showing duration, price, buffers, staff, and resources.',
        durationMinutes: 45,
        priceCents: 7500,
        bufferBeforeMin: 10,
        bufferAfterMin: 15,
        color: '#7C3AED',
      },
    });
    await tx.staffService.create({ data: { staffId: args.staffId, serviceId: service.id } });
    await tx.availabilityRule.createMany({
      data: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        staffId: args.staffId,
        dayOfWeek,
        startTime: '09:00',
        endTime: '17:00',
      })),
    });

    const client = await tx.client.create({
      data: {
        businessId: args.businessId,
        name: 'Demo Client',
        email: `demo-client-${args.businessId}@example.com`,
        phone: '+14165550123',
        notes: 'Demo client profile. Safe to edit or delete after exploring.',
        tags: ['Demo', 'VIP'],
        birthday: '06-15',
      },
    });

    const upcomingAppointment = await tx.appointment.create({
      data: {
        businessId: args.businessId,
        staffId: args.staffId,
        serviceId: service.id,
        clientId: client.id,
        locationId: location.id,
        startsAt,
        endsAt,
        status: 'CONFIRMED',
        totalPriceCents: 7500,
        notes: 'Demo confirmed appointment.',
        referralSource: 'Demo referral',
        intakeAnswers: [
          { label: 'Demo: any allergies or sensitivities?', answer: 'No known allergies.' },
          { label: 'Demo: what should we focus on today?', answer: 'First visit consultation.' },
        ],
      },
    });
    const completedAppointment = await tx.appointment.create({
      data: {
        businessId: args.businessId,
        staffId: args.staffId,
        serviceId: service.id,
        clientId: client.id,
        locationId: location.id,
        startsAt: completedAt,
        endsAt: completedEnd,
        status: 'COMPLETED',
        totalPriceCents: 7500,
        notes: 'Demo completed appointment for reports and history.',
      },
    });

    const payment = await tx.payment.create({
      data: {
        businessId: args.businessId,
        appointmentId: completedAppointment.id,
        clientId: client.id,
        amountCents: 7500,
        taxCents: 375,
        tipCents: 1000,
        currency: 'cad',
        kind: 'IN_PERSON',
        status: 'SUCCEEDED',
        description: 'Demo in-person payment',
      },
    });
    await tx.refund.create({
      data: {
        businessId: args.businessId,
        paymentId: payment.id,
        amountCents: 1000,
        reason: 'Demo partial refund example',
        status: 'SUCCEEDED',
      },
    });
    await tx.transaction.create({
      data: {
        businessId: args.businessId,
        type: 'PROCESSING_FEE',
        amountCents: 245,
        currency: 'CAD',
        status: 'COMPLETED',
        provider: 'DEMO',
        metadata: { note: 'Demo processing-fee row for financial reports' },
      },
    });

    const invoiceSeq = await tx.business.update({
      where: { id: args.businessId },
      data: { invoiceSeq: { increment: 1 } },
      select: { invoiceSeq: true },
    });
    await tx.invoice.create({
      data: {
        businessId: args.businessId,
        clientId: client.id,
        number: invoiceSeq.invoiceSeq,
        status: 'DRAFT',
        currency: 'CAD',
        lineItems: [{ description: 'Demo invoice line item', quantity: 1, unitCents: 7500, amountCents: 7500 }],
        subtotalCents: 7500,
        taxRatePercent: 5,
        taxCents: 375,
        totalCents: 7875,
        paymentTerms: 'Due on receipt',
        notes: 'Demo invoice. Edit or delete when ready.',
      },
    });

    await tx.staffTask.create({
      data: {
        businessId: args.businessId,
        staffId: args.staffId,
        title: 'Demo task: prepare for first appointment',
        notes: 'Tasks can be assigned to providers and tracked as open/done.',
        dueAt: addDays(1, 9, 0),
      },
    });
    const followUpPolicy = await tx.followUpPolicy.create({
      data: {
        businessId: args.businessId,
        serviceId: service.id,
        name: 'Demo follow-up rule',
        delayDays: 30,
        subject: 'Demo: time to book again',
        body: 'Hi {name}, this is a demo follow-up reminder from {business}.',
      },
    });
    await tx.serviceDue.create({
      data: {
        businessId: args.businessId,
        clientId: client.id,
        serviceId: service.id,
        policyId: followUpPolicy.id,
        cadenceDays: 30,
        dueAt: addDays(30, 9, 0),
        messageSubject: 'Demo next-visit reminder',
        messageBody: 'This sample shows how follow-ups become due.',
      },
    });
    await tx.waitlistEntry.create({
      data: {
        businessId: args.businessId,
        name: 'Demo Waitlist Client',
        email: `demo-waitlist-${args.businessId}@example.com`,
        phone: '+14165550124',
        serviceId: service.id,
        staffId: args.staffId,
        desiredDate: startsAt,
        notes: 'Demo waitlist request for a full slot.',
      },
    });

    await tx.message.createMany({
      data: [
        { businessId: args.businessId, clientId: client.id, fromClient: true, content: 'Demo: can I move my appointment later?', read: false },
        { businessId: args.businessId, clientId: client.id, fromClient: false, content: 'Demo reply: yes, here are two options.', read: true },
      ],
    });
    await tx.messageThreadState.create({
      data: { businessId: args.businessId, clientId: client.id, userId: args.userId, lastReadAt: addDays(0, 8, 0) },
    });

    await tx.offer.create({
      data: {
        businessId: args.businessId,
        title: 'Demo Offer',
        description: 'A sample promotion clients can see in the client portal.',
        discount: '10% off',
        expiresAt: addDays(30, 23, 59),
      },
    });
    await tx.promoCode.create({
      data: {
        businessId: args.businessId,
        code: 'DEMO10',
        discountType: 'PERCENT',
        discountValue: 10,
        maxUsages: 25,
        expiresAt: addDays(30, 23, 59),
      },
    });
    await tx.campaign.create({
      data: {
        businessId: args.businessId,
        name: 'Demo campaign draft',
        channel: 'EMAIL',
        audience: 'ALL',
        subject: 'Demo campaign subject',
        body: 'Hi {name}, this draft shows where marketing campaigns live for {business}.',
      },
    });
    const giftCard = await tx.giftCard.create({
      data: {
        businessId: args.businessId,
        code: 'DEMO-GIFT',
        initialCents: 5000,
        balanceCents: 5000,
        recipientName: 'Demo Recipient',
        recipientEmail: `demo-gift-${args.businessId}@example.com`,
        purchaserName: 'Demo Purchaser',
        message: 'Sample gift card balance.',
      },
    });
    await tx.giftCardRedemption.create({
      data: { giftCardId: giftCard.id, amountCents: 2500, appointmentId: upcomingAppointment.id },
    });

    const pkg = await tx.package.create({
      data: {
        businessId: args.businessId,
        name: 'Demo 5-Visit Package',
        serviceId: service.id,
        credits: 5,
        priceCents: 30000,
      },
    });
    const clientPackage = await tx.clientPackage.create({
      data: {
        businessId: args.businessId,
        packageId: pkg.id,
        clientId: client.id,
        name: pkg.name,
        serviceId: service.id,
        creditsTotal: 5,
        creditsRemaining: 4,
        expiresAt: addDays(180, 23, 59),
      },
    });
    await tx.packageRedemption.create({
      data: { clientPackageId: clientPackage.id, appointmentId: completedAppointment.id },
    });

    const membershipPlan = await tx.membershipPlan.create({
      data: {
        businessId: args.businessId,
        name: 'Demo Monthly Membership',
        description: 'Sample recurring membership plan.',
        priceMonthly: 4900,
      },
    });
    await tx.clientMembership.create({
      data: {
        businessId: args.businessId,
        clientId: client.id,
        planId: membershipPlan.id,
        status: 'ACTIVE',
        currentPeriodEnd: addDays(30, 23, 59),
      },
    });
    await tx.review.create({
      data: {
        businessId: args.businessId,
        appointmentId: completedAppointment.id,
        staffId: args.staffId,
        clientName: 'Demo Client',
        rating: 5,
        comment: 'Demo review showing where client feedback appears.',
      },
    });

    await tx.notification.create({
      data: {
        userId: args.userId,
        kind: 'SYSTEM',
        title: 'Demo examples added',
        body: 'Your dashboard includes labeled demo records in each main category so you can explore safely. Delete or edit them when you are ready.',
        linkUrl: '/dashboard',
      },
    });
    await tx.notificationDelivery.create({
      data: {
        businessId: args.businessId,
        userId: args.userId,
        channel: 'EMAIL',
        recipient: 'demo@example.com',
        type: 'DEMO_DELIVERY',
        status: 'SKIPPED',
        error: 'Demo delivery only; no email was sent.',
      },
    });
  }

  // ── Email verification ──────────────────────────────────────────────────────
  // Short-lived JWT signed with JWT_SECRET; carries the userId, a 'verify' kind,
  // and a random jti. The jti is stored in Redis after first use, making the link
  // single-use — a replayed link is rejected even within the 7-day validity window.
  private async sendVerification(userId: string) {
    const jti = randomBytes(16).toString('hex');
    const token = this.jwt.sign({ sub: userId, kind: 'verify', jti }, { secret: process.env.JWT_SECRET, expiresIn: '7d' });
    await this.notifications.sendVerifyEmail(userId, token);
  }

  async verifyEmail(token: string) {
    let decoded: { sub?: string; kind?: string; jti?: string; exp?: number } | null = null;
    try {
      decoded = this.jwt.verify(token, { secret: process.env.JWT_SECRET, algorithms: ['HS256'] }) as { sub?: string; kind?: string; jti?: string; exp?: number };
    } catch {
      throw new BadRequestException('Invalid or expired verification link');
    }
    if (!decoded?.sub || decoded.kind !== 'verify' || !decoded.jti) throw new BadRequestException('Invalid verification link');
    const ttl = decoded.exp ? Math.max(1, decoded.exp - Math.floor(Date.now() / 1000)) : 7 * 24 * 3600;
    let alreadyUsed = false;
    try {
      // Atomic SET NX: returns 'OK' if the key was newly set, null if it already existed.
      const claimed = await this.redis.client.set(`auth:verify:used:${decoded.jti}`, '1', 'EX', ttl, 'NX');
      alreadyUsed = (claimed === null);
    } catch {
      // Redis unavailable: accept small replay risk rather than blocking all verification.
    }
    if (alreadyUsed) throw new BadRequestException('This verification link has already been used');
    const user = await this.prisma.user.update({ where: { id: decoded.sub }, data: { emailVerified: true } });
    // Return the role so the verify page can send them to the right home
    // (owners/staff → /dashboard, clients → /my/dashboard).
    return { ok: true, role: user.role };
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { ok: true };
    if (user.emailVerified) return { ok: true, alreadyVerified: true };
    await this.sendVerification(userId);
    return { ok: true };
  }

  // ── Self-service password reset ─────────────────────────────────────────────
  // The reset token is a short-lived JWT signed with JWT_SECRET + the user's
  // CURRENT password hash. That makes it single-use for free: once the password
  // changes the hash changes, so the signature no longer verifies. The userId is
  // carried in the (readable) payload so we can look up the hash to verify.
  private resetSecret(passwordHash: string): string {
    return `${process.env.JWT_SECRET!}${passwordHash}`;
  }

  // Trusted-device ("remember this device") token for 2FA. Bound to the user's
  // password, current 2FA setup, and a version-stable browser/OS signature.
  private normalizedDeviceKey(userAgent?: string, _ip?: string): string | null {
    // Fingerprint by browser/platform only — IP is excluded so the 30-day trust
    // survives network changes (mobile data ↔ WiFi, home IP renewal, VPN).
    const normalizedUa = (userAgent ?? '')
      .toLowerCase()
      .replace(/([a-z][a-z0-9._-]*)\/[\d._]+/g, '$1')
      .replace(/\b(os(?: x)?|android) [\d._]+/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalizedUa) return null;
    return createHash('sha256').update(normalizedUa).digest('hex').slice(0, 32);
  }

  private trustedDeviceSecret(user: User): string {
    // Recovery codes are regenerated on each off→on transition, so including
    // them revokes all old trusted-device tokens when 2FA is reset.
    return `td:${process.env.JWT_SECRET!}${user.passwordHash ?? ''}:${user.twoFactorRecoveryCodes.join(':')}`;
  }
  private mintTrustedDeviceToken(user: User, ctx?: { ip?: string; userAgent?: string }): string {
    const deviceKey = this.normalizedDeviceKey(ctx?.userAgent, ctx?.ip);
    return this.jwt.sign(
      { sub: user.id, kind: 'td', ...(deviceKey ? { deviceKey } : {}) },
      { secret: this.trustedDeviceSecret(user), expiresIn: '30d' },
    );
  }
  private isTrustedDevice(user: User, token?: string, ctx?: { ip?: string; userAgent?: string }): boolean {
    if (!token) return false;
    try {
      const p = this.jwt.verify(token, { secret: this.trustedDeviceSecret(user), algorithms: ['HS256'] }) as { sub?: string; kind?: string; deviceKey?: string };
      if (p?.sub !== user.id || p?.kind !== 'td') return false;
      const currentKey = this.normalizedDeviceKey(ctx?.userAgent, ctx?.ip);
      // Require both sides to have a resolvable key; tokens without deviceKey (no
      // UA or IP at mint time) are always rejected to prevent unbound device trust.
      if (!p.deviceKey || !currentKey) return false;
      return p.deviceKey === currentKey;
    } catch { return false; }
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always succeed so we never reveal whether an email is registered.
    if (user && user.passwordHash) {
      const token = this.jwt.sign(
        { sub: user.id, kind: 'reset' },
        { secret: this.resetSecret(user.passwordHash), expiresIn: '15m' },
      );
      await this.notifications.sendPasswordReset(user.id, token);
    }
    return { ok: true };
  }

  async resetPassword(token: string, newPassword: string) {
    if (newPassword.length < 8) throw new BadRequestException('New password must be at least 8 characters');
    // Decode (unverified) to find which user the token is for, then verify with
    // that user's hash-derived secret.
    const decoded = this.jwt.decode(token) as { sub?: string; kind?: string } | null;
    if (!decoded?.sub || decoded.kind !== 'reset') throw new BadRequestException('Invalid or expired reset link');
    const user = await this.prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user || !user.passwordHash) throw new BadRequestException('Invalid or expired reset link');
    try {
      this.jwt.verify(token, { secret: this.resetSecret(user.passwordHash), algorithms: ['HS256'] });
    } catch {
      throw new BadRequestException('Invalid or expired reset link');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      // Clear any forced-reset flag since the user has now set a fresh password.
      data: { passwordHash: await bcrypt.hash(newPassword, 12), mustResetPassword: false },
    });
    // Revoke every device session so a reset logs the account out everywhere.
    await this.prisma.refreshSession.deleteMany({ where: { userId: user.id } });
    return { ok: true };
  }

  // Dummy hash used when an email doesn't exist — ensures the no-account and
  // wrong-password code paths take the same time, preventing email enumeration
  // by comparing response latency.
  private static readonly DUMMY_HASH = '$2a$12$AAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

  async login(dto: LoginDto, ctx?: { ip?: string; userAgent?: string; origin?: string }) {
    const locked = await this.authLock.isLocked(dto.email).catch(() => {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('Authentication temporarily unavailable');
      }
      return false;
    });
    if (locked) {
      throw new HttpException({ message: 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.', statusCode: 429 }, 429);
    }

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      await bcrypt.compare(dto.password, AuthService.DUMMY_HASH);
      await this.authLock.recordFailure(dto.email).catch(() => {});
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException('This account uses social sign-in. Please use the "Continue with Google" or "Continue with Apple" option.');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      await this.authLock.recordFailure(dto.email).catch(() => {});
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.authLock.clearFailures(dto.email).catch(() => {});

    if (user.role === 'ADMIN') {
      // In production, reject login attempts from unrecognized browser origins.
      // Allowed: corsOrigins (the main web app) + the dedicated admin subdomain.
      // Requests with no Origin header (server-to-server, CLI tools) are permitted.
      const adminOrigin = process.env.ADMIN_PANEL_URL ?? process.env.ADMIN_DOMAIN;
      const isProd = process.env.NODE_ENV === 'production';
      if (isProd && ctx?.origin) {
        const normalizedAdmin = adminOrigin
          ? (adminOrigin.startsWith('https://') ? adminOrigin : `https://${adminOrigin}`)
          : null;
        const allowedOrigins = new Set([
          ...(process.env.CORS_ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean),
          ...(normalizedAdmin ? [normalizedAdmin, adminOrigin!] : []),
        ]);
        if (!allowedOrigins.has(ctx.origin)) {
          throw new ForbiddenException('Admin login is not permitted from this origin');
        }
      }
    }

    // ADMIN always requires 2FA — no trusted-device bypass permitted.
    // Regular users opt in; once enabled, trusted-device tokens skip the prompt.
    const needs2fa = user.role === 'ADMIN'
      ? true
      : user.twoFactorEnabled && !this.isTrustedDevice(user, dto.trustedDeviceToken, ctx);
    if (needs2fa) {
      const challenge = await this.createLoginChallenge(user);
      return { twoFactorRequired: true as const, challengeId: challenge.id, method: challenge.method, isAdmin: user.role === 'ADMIN' };
    }

    await this.recordLoginAndMaybeAlert(user, ctx);
    return this.issueTokens(user, { userAgent: ctx?.userAgent });
  }

  // ── 2FA (one-time code) ─────────────────────────────────────────────────────
  private async resolveTwoFactorSmsPhone(user: User): Promise<string | null> {
    const userPhone = normalizePhone(user.phone);
    if (userPhone) return userPhone;

    const linkedClient = await this.prisma.client.findFirst({
      where: { userId: user.id },
      select: { phone: true },
      orderBy: { updatedAt: 'desc' },
    });
    const linkedClientPhone = normalizePhone(linkedClient?.phone);
    if (linkedClientPhone) return linkedClientPhone;

    const client = await this.prisma.client.findFirst({
      where: {
        email: { equals: user.email, mode: 'insensitive' },
        ...(user.businessId ? { businessId: user.businessId } : {}),
      },
      select: { phone: true },
      orderBy: { updatedAt: 'desc' },
    });
    const clientPhone = normalizePhone(client?.phone);
    if (clientPhone) return clientPhone;

    if (user.businessId) {
      const business = await this.prisma.business.findUnique({
        where: { id: user.businessId },
        select: { phone: true },
      });
      const businessPhone = normalizePhone(business?.phone);
      if (businessPhone) return businessPhone;
    }

    return null;
  }

  private async createLoginChallenge(user: User): Promise<{ id: string; method: 'EMAIL' | 'SMS' }> {
    const code = String(randomInt(100000, 1000000)); // 6 digits, CSPRNG (not Math.random)
    const id = randomUUID();
    const codeHash = createHmac('sha256', process.env.OTP_PEPPER ?? process.env.JWT_SECRET!)
      .update(`${id}:${code}`)
      .digest('hex');
    const smsPhone = user.twoFactorMethod === 'SMS' ? await this.resolveTwoFactorSmsPhone(user) : null;
    const method: 'EMAIL' | 'SMS' = user.twoFactorMethod === 'SMS' && smsPhone ? 'SMS' : 'EMAIL';
    const ch = await this.prisma.otpChallenge.create({
      data: { id, userId: user.id, codeHash, method, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    });
    await this.notifications.sendOtp(user.id, code, method, smsPhone);
    return { id: ch.id, method };
  }

  async verifyTwoFactor(challengeId: string, code: string, ctx?: { ip?: string; userAgent?: string }, rememberDevice?: boolean) {
    const ch = await this.prisma.otpChallenge.findUnique({ where: { id: challengeId } });
    if (!ch || ch.consumedAt || ch.expiresAt < new Date() || ch.attempts >= 5) {
      throw new UnauthorizedException('Invalid or expired code');
    }
    // Constant-time compare so a wrong code can't be teased out by response timing.
    const computedOtp = createHmac('sha256', process.env.OTP_PEPPER ?? process.env.JWT_SECRET!)
      .update(`${challengeId}:${code}`)
      .digest('hex');
    const legacyOtp = createHash('sha256').update(code).digest('hex');
    const otpOk = [computedOtp, legacyOtp].some((candidate) =>
      candidate.length === ch.codeHash.length && timingSafeEqual(Buffer.from(candidate), Buffer.from(ch.codeHash)),
    );

    // Recovery-code fallback: if the OTP didn't match, the user may have entered
    // one of their one-time recovery codes (which bypass the email/SMS channel
    // entirely — the whole point of recovery). Consume it on use.
    // Codes may be stored as bcrypt hashes (new) or legacy SHA-256 hex (old).
    let recoveryOk = false;
    let recoveryHash: string | undefined;
    if (!otpOk) {
      const u = await this.prisma.user.findUnique({ where: { id: ch.userId } });
      if (u) {
        const candidate = code.trim().toLowerCase();
        let matchingHash: string | undefined;
        for (const h of u.twoFactorRecoveryCodes) {
          const matched = h.startsWith('$2')
            ? await bcrypt.compare(candidate, h)
            : h === createHash('sha256').update(candidate).digest('hex');
          if (matched) { matchingHash = h; break; }
        }
        if (matchingHash) {
          recoveryOk = true;
          recoveryHash = matchingHash;
        }
      }
    }

    if (!otpOk && !recoveryOk) {
      await this.prisma.otpChallenge.update({ where: { id: challengeId }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException('Invalid or expired code');
    }
    const consumed = await this.prisma.$transaction(async (tx) => {
      const result = await tx.otpChallenge.updateMany({
        where: { id: challengeId, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: 5 } },
        data: { consumedAt: new Date() },
      });
      if (result.count !== 1) return false;
      if (recoveryHash) {
        const recoveryUser = await tx.user.findUnique({ where: { id: ch.userId } });
        if (!recoveryUser?.twoFactorRecoveryCodes.includes(recoveryHash)) return false;
        await tx.user.update({
          where: { id: ch.userId },
          data: { twoFactorRecoveryCodes: recoveryUser.twoFactorRecoveryCodes.filter((hash) => hash !== recoveryHash) },
        });
      }
      return true;
    });
    if (!consumed) throw new UnauthorizedException('Invalid or expired code');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: ch.userId } });
    await this.recordLoginAndMaybeAlert(user, ctx);
    const tokens = await this.issueTokens(user, { userAgent: ctx?.userAgent });
    // "Remember this device": hand back a trusted-device token the client stores,
    // so future logins from here skip the 2FA prompt.
    return rememberDevice ? { ...tokens, trustedDeviceToken: this.mintTrustedDeviceToken(user, ctx) } : tokens;
  }

  // A readable one-time code, e.g. "a3f9c-1e7d2".
  private genRecoveryCode(): string {
    const raw = randomBytes(5).toString('hex'); // 10 hex chars
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  }

  async setTwoFactor(userId: string, enabled: boolean, method: 'EMAIL' | 'SMS' | undefined, currentPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    // SSO-only accounts have no password — they authenticated via a trusted provider,
    // so skip password confirmation. Password accounts must confirm before changing 2FA.
    if (user.passwordHash) {
      if (!await bcrypt.compare(currentPassword, user.passwordHash)) {
        throw new UnauthorizedException('Current password is incorrect');
      }
    }
    const data: { twoFactorEnabled: boolean; twoFactorMethod?: string; twoFactorRecoveryCodes?: string[] } = {
      twoFactorEnabled: enabled,
      ...(method ? { twoFactorMethod: method } : {}),
    };

    // Mint fresh recovery codes only on the off→on transition (not when just
    // switching delivery method while already enabled — that must not invalidate
    // codes the user already saved). Clear them when turning 2FA off.
    let recoveryCodes: string[] | undefined;
    if (enabled && !user.twoFactorEnabled) {
      recoveryCodes = Array.from({ length: 8 }, () => this.genRecoveryCode());
      data.twoFactorRecoveryCodes = await Promise.all(recoveryCodes.map((c) => bcrypt.hash(c, 10)));
    } else if (!enabled) {
      data.twoFactorRecoveryCodes = [];
    }

    const updated = await this.prisma.user.update({ where: { id: userId }, data });
    let staffId: string | null = null;
    if (updated.role === 'STAFF') {
      const staff = await this.prisma.staff.findUnique({ where: { userId: updated.id } });
      staffId = staff?.id ?? null;
    }
    return {
      ok: true,
      twoFactorEnabled: updated.twoFactorEnabled,
      ...(recoveryCodes ? { recoveryCodes } : {}),
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        businessId: updated.businessId,
        staffId,
        mustResetPassword: updated.mustResetPassword,
        twoFactorEnabled: updated.twoFactorEnabled,
        twoFactorMethod: updated.twoFactorMethod,
      },
    };
  }

  // Record the sign-in and, if it's from a NEW device (but not the user's very
  // first login), email a security alert with a password-reset link. Wrapped in
  // try/catch so this plumbing can never block a legitimate login.
  private async recordLoginAndMaybeAlert(user: User, ctx?: { ip?: string; userAgent?: string }, method = 'PASSWORD') {
    try {
      const ua = ctx?.userAgent ?? '';
      const ip = ctx?.ip?.slice(0, 64) || null;
      const deviceKey = this.normalizedDeviceKey(ua, ip ?? undefined);
      const storedDeviceKey = deviceKey ?? '';
      const [priorSameDevice, priorSameIp, total] = await Promise.all([
        deviceKey
          ? this.prisma.loginEvent.findFirst({ where: { userId: user.id, deviceKey } })
          : Promise.resolve(null),
        ip ? this.prisma.loginEvent.findFirst({ where: { userId: user.id, ip } }) : Promise.resolve(null),
        this.prisma.loginEvent.count({ where: { userId: user.id } }),
      ]);
      await this.prisma.loginEvent.create({
        data: { userId: user.id, deviceKey: storedDeviceKey, ip, userAgent: ua.slice(0, 256) || null, method },
      });
      if (total > 0 && !priorSameDevice && !priorSameIp) {
        // SSO-only users have no password to reset; skip the reset-token attachment.
        const resetToken = user.passwordHash
          ? this.jwt.sign({ sub: user.id, kind: 'reset' }, { secret: this.resetSecret(user.passwordHash), expiresIn: '15m' })
          : undefined;
        await this.notifications.sendSecurityAlert(user.id, { ip: ctx?.ip, userAgent: ua, ...(resetToken ? { resetToken } : {}) });
      }
    } catch { /* never block login on the alert path */ }
  }

  // Rotate the CURRENT device's session in place (identified by the presented
  // refresh token) so other devices' sessions are untouched.
  // Redis lock: if the same token arrives concurrently (e.g. two inflight requests
  // on the same device), only one rotation wins; the other falls back to creating
  // a fresh session instead of racing to replace the same DB row.
  async refresh(user: User, presentedToken?: string, userAgent?: string) {
    if (!presentedToken) {
      return this.issueTokens(user, { userAgent });
    }
    const tokenHash = hashRefreshToken(presentedToken);
    const lockKey = `auth:refresh-lock:${tokenHash}`;
    const acquired = await this.redis.client.set(lockKey, '1', 'EX', 10, 'NX').catch(() => null);
    if (!acquired) {
      // Concurrent rotation for this token is already in progress on another pod.
      // Issue a brand-new session to avoid the duplicate-row race; the old session
      // row will be swept by the expired-session GC on the next successful refresh.
      return this.issueTokens(user, { userAgent });
    }
    try {
      return await this.issueTokens(user, { replaceTokenHash: tokenHash, userAgent });
    } finally {
      await this.redis.client.del(lockKey).catch(() => {});
    }
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      // Revoke only the presented session so other devices stay signed in.
      const tokenHash = hashRefreshToken(refreshToken);
      await this.prisma.refreshSession.deleteMany({ where: { userId, tokenHash } });
    } else {
      // No token presented (e.g. older clients) — fall back to revoking all sessions.
      await this.prisma.refreshSession.deleteMany({ where: { userId } });
    }
  }

  // Authenticated password change. Verifies the current password, sets the new
  // one, and clears the mustResetPassword flag (used for forced first-login resets).
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash) throw new BadRequestException('Social sign-in accounts cannot set a password here');
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    if (newPassword.length < 8) throw new BadRequestException('New password must be at least 8 characters');
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new BadRequestException('New password must be different from the current one');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 12), mustResetPassword: false },
    });
    // Revoke all sessions so concurrent devices are logged out after a password change.
    await this.prisma.refreshSession.deleteMany({ where: { userId } });
    return { ok: true };
  }

  async revokeAccessToken(jti: string, exp: number) {
    const ttl = Math.max(1, exp - Math.floor(Date.now() / 1000));
    await this.redis.client.set(`auth:revoked:${jti}`, '1', 'EX', ttl).catch(() => {});
  }

  // ── SSO: Google + Apple ─────────────────────────────────────────────────────

  async findOrCreateSSOUser(provider: string, subject: string, email: string, name: string, ctx?: { ip?: string }): Promise<User> {
    // 1. Fast path: already linked account.
    const existing = await this.prisma.user.findFirst({
      where: { oauthProvider: provider, oauthSubject: subject },
    });
    if (existing) return existing;

    // 2. Email-match path: link to an existing account — but only if that account
    //    has already verified the email (proves they own it) and is not an admin
    //    (admin accounts must never be silently taken over via OAuth).
    if (email) {
      const byEmail = await this.prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        if (!byEmail.emailVerified) {
          throw new UnauthorizedException(
            'An account with this email exists but has not yet been verified. ' +
            'Sign in with your password first to verify it, then link your social account from settings.',
          );
        }
        if (byEmail.role === 'ADMIN') {
          throw new UnauthorizedException('Admin accounts cannot be linked via social sign-in.');
        }
        return this.prisma.user.update({
          where: { id: byEmail.id },
          data: { oauthProvider: provider, oauthSubject: subject },
        });
      }
    }

    // 3. New user: create inside a transaction so consent records are atomic.
    //    Guard with a P2002 catch in case two concurrent requests race.
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: name || (email ? email.split('@')[0] : `${provider}_user`),
            email: email || `${provider}.${subject}@noreply.pulse`,
            passwordHash: null,
            oauthProvider: provider,
            oauthSubject: subject,
            role: 'CLIENT',
            emailVerified: true,
          },
        });
        // Write TERMS + PRIVACY_POLICY consent — user accepted by clicking the
        // SSO button, which is presented alongside the "By continuing you agree…" notice.
        await tx.privacyConsent.createMany({
          data: [
            {
              userId: user.id,
              businessId: null,
              type: 'TERMS',
              granted: true,
              version: '2026-06-13',
              source: 'sso_registration',
              ipAddress: ctx?.ip?.slice(0, 64) ?? null,
            },
            {
              userId: user.id,
              businessId: null,
              type: 'PRIVACY_POLICY',
              granted: true,
              version: '2026-06-13',
              source: 'sso_registration',
              ipAddress: ctx?.ip?.slice(0, 64) ?? null,
            },
          ],
        });
        return user;
      });
    } catch (e) {
      // Race condition: another concurrent request won the insert. Return the winner.
      if ((e as { code?: string }).code === 'P2002') {
        const winner = await this.prisma.user.findFirst({ where: { oauthProvider: provider, oauthSubject: subject } });
        if (winner) return winner;
      }
      throw e;
    }
  }

  async verifyGoogleCode(code: string, redirectUri: string, codeVerifier?: string): Promise<{ sub: string; email: string; name: string }> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new ServiceUnavailableException('Google sign-in is not configured');

    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    if (codeVerifier) params.set('code_verifier', codeVerifier);

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!tokenRes.ok) throw new UnauthorizedException('Google token exchange failed');
    const tokenData = await tokenRes.json() as { access_token?: string };
    if (!tokenData.access_token) throw new UnauthorizedException('No access token from Google');

    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!infoRes.ok) throw new UnauthorizedException('Could not fetch Google profile');
    const info = await infoRes.json() as { sub?: string; email?: string; name?: string; email_verified?: boolean };
    if (!info.sub || !info.email) throw new UnauthorizedException('Incomplete Google profile — email scope may be missing');
    if (!info.email_verified) throw new UnauthorizedException('Google account email address is not verified');
    return { sub: info.sub, email: info.email, name: info.name ?? '' };
  }

  async verifyAppleToken(identityToken: string, platform: 'web' | 'mobile', email?: string, firstName?: string, lastName?: string): Promise<{ sub: string; email: string; name: string }> {
    const clientId = platform === 'mobile'
      ? (process.env.APPLE_MOBILE_CLIENT_ID ?? 'com.pulseappointments.app')
      : process.env.APPLE_CLIENT_ID;
    if (!clientId) throw new ServiceUnavailableException('Apple sign-in is not configured');

    let payload: Record<string, unknown>;
    try {
      const result = await jwtVerify(identityToken, this.appleJWKS, {
        issuer: 'https://appleid.apple.com',
        audience: clientId,
      });
      payload = result.payload as Record<string, unknown>;
    } catch {
      throw new UnauthorizedException('Apple identity token verification failed');
    }
    const sub = payload.sub as string | undefined;
    if (!sub) throw new UnauthorizedException('Apple token missing subject claim');
    const resolvedEmail = email || (payload.email as string | undefined) || '';
    const name = [firstName, lastName].filter(Boolean).join(' ');
    return { sub, email: resolvedEmail, name };
  }

  protected async issueTokens(user: User, opts: { userAgent?: string; replaceTokenHash?: string } = {}) {
    const jti = randomBytes(8).toString('hex');
    const isAdmin = user.role === 'ADMIN';
    const payload = { sub: user.id, email: user.email, role: user.role, jti, ...(isAdmin ? { kind: 'admin' } : {}) };
    const accessToken = this.jwt.sign(payload, {
      secret: process.env.JWT_SECRET,
      // Admin sessions use a 5-minute access TTL to limit the window for replayed tokens.
      // @nestjs/jwt v11 types expiresIn as number | ms.StringValue; env strings
      // like "15m" are valid at runtime, so cast past the stricter literal type.
      expiresIn: (isAdmin ? '5m' : (process.env.JWT_EXPIRES_IN ?? '15m')) as unknown as number,
    });
    const refreshToken = this.jwt.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: (isAdmin ? '1h' : (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d')) as unknown as number,
    });

    // Persist the session as a hash only — a DB leak then can't replay live
    // sessions. On refresh we ROTATE the presented session's row in place (one
    // row per device); on login we add a NEW row so web + mobile coexist.
    const tokenHash = hashRefreshToken(refreshToken);
    // Admin refresh tokens are capped at 1h in the JWT; keep the DB row in sync.
    const expiresAt = new Date(Date.now() + (isAdmin ? 60 * 60 * 1000 : refreshTokenTtlMs()));
    const userAgent = opts.userAgent?.slice(0, 256) ?? null;
    if (opts.replaceTokenHash) {
      const { count } = await this.prisma.refreshSession.updateMany({
        where: { userId: user.id, tokenHash: opts.replaceTokenHash },
        data: { tokenHash, expiresAt, userAgent },
      });
      if (count === 0) {
        await this.prisma.refreshSession.create({ data: { userId: user.id, tokenHash, expiresAt, userAgent } });
      }
    } else {
      await this.prisma.refreshSession.create({ data: { userId: user.id, tokenHash, expiresAt, userAgent } });
    }
    // Opportunistic cleanup of this user's expired sessions.
    await this.prisma.refreshSession.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } });
    // Enforce session cap: evict oldest sessions beyond the limit.
    const MAX_SESSIONS = 10;
    const allSessions = await this.prisma.refreshSession.findMany({
      where: { userId: user.id },
      orderBy: { expiresAt: 'asc' },
      select: { id: true },
    });
    if (allSessions.length > MAX_SESSIONS) {
      const excess = allSessions.slice(0, allSessions.length - MAX_SESSIONS);
      await this.prisma.refreshSession.deleteMany({ where: { id: { in: excess.map((s) => s.id) } } });
    }

    let staffId: string | null = null;
    let permissions: string[] = [];
    if (user.role === 'STAFF') {
      const staff = await this.prisma.staff.findUnique({ where: { userId: user.id } });
      staffId = staff?.id ?? null;
      permissions = staff?.permissions ?? [];
    }

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        businessId: user.businessId,
        staffId,
        permissions,
        mustResetPassword: user.mustResetPassword,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        twoFactorMethod: user.twoFactorMethod,
      },
    };
  }

  async getSessions(userId: string) {
    const events = await this.prisma.loginEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, ip: true, userAgent: true, method: true, createdAt: true },
    });
    return {
      data: events.map(e => ({
        id: e.id,
        ipAddress: e.ip,
        userAgent: e.userAgent,
        method: e.method,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  async recordSSOLogin(user: User, method: 'GOOGLE' | 'APPLE', ctx?: { ip?: string; userAgent?: string }) {
    await this.recordLoginAndMaybeAlert(user, ctx, method);
  }
}
