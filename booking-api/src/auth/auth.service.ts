import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { hashRefreshToken } from '../common/util/refresh-token';
import { normalizePhone } from '../common/util/phone';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private notifications: NotificationsService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("Email already registered");

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      let businessId = dto.businessId;

      if (dto.role === "OWNER" && !businessId) {
        // Brand the new (empty) business from the signup form, falling back to
        // the owner's name. The account starts empty — no staff/services/clients —
        // the owner sets it up in-app.
        const businessName = dto.businessName?.trim() || `${dto.name}'s Business`;
        const slugSource = (dto.businessName?.trim() || dto.name).toLowerCase();
        const baseSlug = slugSource.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "business";
        const business = await tx.business.create({
          data: {
            name: businessName,
            slug: `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`,
            email: dto.email,
            phone: normalizePhone(dto.businessPhone) ?? undefined,
            timezone: dto.timezone?.trim() || undefined,
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

      await tx.privacyConsent.createMany({
        data: [
          {
            userId: user.id,
            businessId: businessId ?? null,
            type: 'TERMS',
            granted: true,
            version: dto.consentVersion,
            source: 'registration',
          },
          {
            userId: user.id,
            businessId: businessId ?? null,
            type: 'PRIVACY_POLICY',
            granted: true,
            version: dto.consentVersion,
            source: 'registration',
          },
          {
            userId: user.id,
            businessId: businessId ?? null,
            type: 'MARKETING',
            granted: dto.marketingConsent,
            version: dto.consentVersion,
            source: 'registration',
          },
          {
            userId: user.id,
            businessId: businessId ?? null,
            type: 'TRACKING',
            granted: dto.trackingConsent,
            version: dto.consentVersion,
            source: 'registration',
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
  // Short-lived JWT signed with JWT_SECRET; carries the userId and a 'verify'
  // kind. Not single-use (re-clicking is harmless — it just re-sets the flag).
  private async sendVerification(userId: string) {
    const token = this.jwt.sign({ sub: userId, kind: 'verify' }, { secret: process.env.JWT_SECRET, expiresIn: '7d' });
    await this.notifications.sendVerifyEmail(userId, token);
  }

  async verifyEmail(token: string) {
    let decoded: { sub?: string; kind?: string } | null = null;
    try {
      decoded = this.jwt.verify(token, { secret: process.env.JWT_SECRET }) as { sub?: string; kind?: string };
    } catch {
      throw new BadRequestException('Invalid or expired verification link');
    }
    if (!decoded?.sub || decoded.kind !== 'verify') throw new BadRequestException('Invalid verification link');
    await this.prisma.user.update({ where: { id: decoded.sub }, data: { emailVerified: true } });
    return { ok: true };
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
    return `${process.env.JWT_SECRET ?? ''}${passwordHash}`;
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always succeed so we never reveal whether an email is registered.
    if (user) {
      const token = this.jwt.sign(
        { sub: user.id, kind: 'reset' },
        { secret: this.resetSecret(user.passwordHash), expiresIn: '30m' },
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
      this.jwt.verify(token, { secret: this.resetSecret(user.passwordHash) });
    } catch {
      throw new BadRequestException('Invalid or expired reset link');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      // Clear the refresh token so existing sessions are logged out, and clear any
      // forced-reset flag since the user has now set a fresh password.
      data: { passwordHash: await bcrypt.hash(newPassword, 12), refreshToken: null, mustResetPassword: false },
    });
    return { ok: true };
  }

  async login(dto: LoginDto, ctx?: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    // Opt-in 2FA: password ok, but require a one-time code before issuing tokens.
    if (user.twoFactorEnabled) {
      const challengeId = await this.createLoginChallenge(user);
      return { twoFactorRequired: true as const, challengeId, method: user.twoFactorMethod };
    }

    await this.recordLoginAndMaybeAlert(user, ctx);
    return this.issueTokens(user);
  }

  // ── 2FA (one-time code) ─────────────────────────────────────────────────────
  private async createLoginChallenge(user: User): Promise<string> {
    const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
    const codeHash = createHash('sha256').update(code).digest('hex');
    const ch = await this.prisma.otpChallenge.create({
      data: { userId: user.id, codeHash, method: user.twoFactorMethod, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    });
    await this.notifications.sendOtp(user.id, code, user.twoFactorMethod);
    return ch.id;
  }

  async verifyTwoFactor(challengeId: string, code: string, ctx?: { ip?: string; userAgent?: string }) {
    const ch = await this.prisma.otpChallenge.findUnique({ where: { id: challengeId } });
    if (!ch || ch.consumedAt || ch.expiresAt < new Date() || ch.attempts >= 5) {
      throw new UnauthorizedException('Invalid or expired code');
    }
    const otpOk = createHash('sha256').update(code).digest('hex') === ch.codeHash;

    // Recovery-code fallback: if the OTP didn't match, the user may have entered
    // one of their one-time recovery codes (which bypass the email/SMS channel
    // entirely — the whole point of recovery). Consume it on use.
    let recoveryOk = false;
    if (!otpOk) {
      const u = await this.prisma.user.findUnique({ where: { id: ch.userId } });
      const recHash = createHash('sha256').update(code.trim().toLowerCase()).digest('hex');
      if (u && u.twoFactorRecoveryCodes.includes(recHash)) {
        recoveryOk = true;
        await this.prisma.user.update({
          where: { id: u.id },
          data: { twoFactorRecoveryCodes: u.twoFactorRecoveryCodes.filter((h) => h !== recHash) },
        });
      }
    }

    if (!otpOk && !recoveryOk) {
      await this.prisma.otpChallenge.update({ where: { id: challengeId }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException('Invalid or expired code');
    }
    await this.prisma.otpChallenge.update({ where: { id: challengeId }, data: { consumedAt: new Date() } });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: ch.userId } });
    await this.recordLoginAndMaybeAlert(user, ctx);
    return this.issueTokens(user);
  }

  // A readable one-time code, e.g. "a3f9c-1e7d2".
  private genRecoveryCode(): string {
    const raw = randomBytes(5).toString('hex'); // 10 hex chars
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  }

  async setTwoFactor(userId: string, enabled: boolean, method?: 'EMAIL' | 'SMS') {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
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
      data.twoFactorRecoveryCodes = recoveryCodes.map((c) => createHash('sha256').update(c).digest('hex'));
    } else if (!enabled) {
      data.twoFactorRecoveryCodes = [];
    }

    await this.prisma.user.update({ where: { id: userId }, data });
    return { ok: true, twoFactorEnabled: enabled, ...(recoveryCodes ? { recoveryCodes } : {}) };
  }

  // Record the sign-in and, if it's from a NEW device (but not the user's very
  // first login), email a security alert with a password-reset link. Wrapped in
  // try/catch so this plumbing can never block a legitimate login.
  private async recordLoginAndMaybeAlert(user: User, ctx?: { ip?: string; userAgent?: string }) {
    try {
      const ua = ctx?.userAgent ?? '';
      const deviceKey = createHash('sha256').update(ua).digest('hex').slice(0, 32);
      const [priorSameDevice, total] = await Promise.all([
        this.prisma.loginEvent.findFirst({ where: { userId: user.id, deviceKey } }),
        this.prisma.loginEvent.count({ where: { userId: user.id } }),
      ]);
      await this.prisma.loginEvent.create({
        data: { userId: user.id, deviceKey, ip: ctx?.ip?.slice(0, 64) || null, userAgent: ua.slice(0, 256) || null },
      });
      if (total > 0 && !priorSameDevice) {
        const resetToken = this.jwt.sign(
          { sub: user.id, kind: 'reset' },
          { secret: this.resetSecret(user.passwordHash), expiresIn: '30m' },
        );
        await this.notifications.sendSecurityAlert(user.id, { ip: ctx?.ip, userAgent: ua, resetToken });
      }
    } catch { /* never block login on the alert path */ }
  }

  async refresh(user: User) {
    return this.issueTokens(user);
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
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
    return { ok: true };
  }

  private async issueTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
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
    await this.prisma.user.update({
      where: { id: user.id },
      // Store only a hash of the refresh token — a DB leak then can't replay live
      // sessions. The refresh strategy compares the same hash.
      data: { refreshToken: hashRefreshToken(refreshToken) },
    });

    let staffId: string | null = null;
    if (user.role === 'STAFF') {
      const staff = await this.prisma.staff.findUnique({ where: { userId: user.id } });
      staffId = staff?.id ?? null;
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
        mustResetPassword: user.mustResetPassword,
        twoFactorEnabled: user.twoFactorEnabled,
        twoFactorMethod: user.twoFactorMethod,
      },
    };
  }
}
