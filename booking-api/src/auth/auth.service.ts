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
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
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

    const result = await this.prisma.$transaction(async (tx) => {
      let businessId: string | undefined;

      if (dto.role === "OWNER") {
        // Brand the new (empty) business from the signup form, falling back to
        // the owner's name. The account starts empty — no staff/services/clients —
        // the owner sets it up in-app.
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
      if (user.role === 'OWNER' && businessId) {
        await tx.staff.create({ data: { userId: user.id, businessId, active: true } });
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

      return user;
    });

    // Welcome the new owner (best-effort — never block signup on email).
    if (result.role === 'OWNER') {
      this.notifications.sendWelcome(result.id).catch(() => {});
    }
    // Send an email-verification link (best-effort). Verification gates the
    // client portal so email-matched lookups are only trusted once proven.
    this.sendVerification(result.id).catch(() => {});

    return this.issueTokens(result);
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
  private normalizedDeviceKey(userAgent?: string, ip?: string): string | null {
    const normalizedUa = (userAgent ?? '')
      .toLowerCase()
      .replace(/([a-z][a-z0-9._-]*)\/[\d._]+/g, '$1')
      .replace(/\b(os(?: x)?|android) [\d._]+/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
    const ipPrefix = ip
      ? (ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip.split('.').slice(0, 3).join('.'))
      : '';
    const source = [normalizedUa, ipPrefix ? `ip:${ipPrefix}` : ''].filter(Boolean).join('|') || null;
    if (!source) return null;
    return createHash('sha256').update(source).digest('hex').slice(0, 32);
  }

  private trustedDeviceSecret(user: User): string {
    // Recovery codes are regenerated on each off→on transition, so including
    // them revokes all old trusted-device tokens when 2FA is reset.
    return `td:${process.env.JWT_SECRET!}${user.passwordHash}:${user.twoFactorRecoveryCodes.join(':')}`;
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
      const p = this.jwt.verify(token, { secret: this.trustedDeviceSecret(user) }) as { sub?: string; kind?: string; deviceKey?: string };
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
    if (user) {
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
    if (!user) throw new BadRequestException('Invalid or expired reset link');
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

  async login(dto: LoginDto, ctx?: { ip?: string; userAgent?: string }) {
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
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      await this.authLock.recordFailure(dto.email).catch(() => {});
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.authLock.clearFailures(dto.email).catch(() => {});

    if (user.role === 'ADMIN' && dto.platform !== 'web') {
      throw new ForbiddenException('Admin accounts must be accessed from the web dashboard at pulseappointments.com');
    }

    // Opt-in 2FA: password ok, but require a one-time code before issuing tokens —
    // UNLESS this device was previously remembered (trusted), so we don't bug the
    // user with a code on every sign-in from the same device.
    if (user.twoFactorEnabled && !this.isTrustedDevice(user, dto.trustedDeviceToken, ctx)) {
      const challenge = await this.createLoginChallenge(user);
      return { twoFactorRequired: true as const, challengeId: challenge.id, method: challenge.method };
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
    if (!await bcrypt.compare(currentPassword, user.passwordHash)) {
      throw new UnauthorizedException('Current password is incorrect');
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
  private async recordLoginAndMaybeAlert(user: User, ctx?: { ip?: string; userAgent?: string }) {
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
        data: { userId: user.id, deviceKey: storedDeviceKey, ip, userAgent: ua.slice(0, 256) || null },
      });
      if (total > 0 && !priorSameDevice && !priorSameIp) {
        const resetToken = this.jwt.sign(
          { sub: user.id, kind: 'reset' },
          { secret: this.resetSecret(user.passwordHash), expiresIn: '15m' },
        );
        await this.notifications.sendSecurityAlert(user.id, { ip: ctx?.ip, userAgent: ua, resetToken });
      }
    } catch { /* never block login on the alert path */ }
  }

  // Rotate the CURRENT device's session in place (identified by the presented
  // refresh token) so other devices' sessions are untouched.
  async refresh(user: User, presentedToken?: string, userAgent?: string) {
    return this.issueTokens(user, {
      replaceTokenHash: presentedToken ? hashRefreshToken(presentedToken) : undefined,
      userAgent,
    });
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

  private async issueTokens(user: User, opts: { userAgent?: string; replaceTokenHash?: string } = {}) {
    const jti = randomBytes(8).toString('hex');
    const payload = { sub: user.id, email: user.email, role: user.role, jti };
    const accessToken = this.jwt.sign(payload, {
      secret: process.env.JWT_SECRET,
      // @nestjs/jwt v11 types expiresIn as number | ms.StringValue; env strings
      // like "15m" are valid at runtime, so cast past the stricter literal type.
      expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as unknown as number,
    });
    const refreshToken = this.jwt.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as unknown as number,
    });

    // Persist the session as a hash only — a DB leak then can't replay live
    // sessions. On refresh we ROTATE the presented session's row in place (one
    // row per device); on login we add a NEW row so web + mobile coexist.
    const tokenHash = hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + refreshTokenTtlMs());
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
}
