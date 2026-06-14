import { Controller, Get, Post, Body, UseGuards, HttpCode, Req, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterSchema, LoginSchema, ChangePasswordSchema, ForgotPasswordSchema, ResetPasswordSchema, VerifyTwoFactorSchema, SetTwoFactorSchema, VerifyEmailSchema, RegisterDto, LoginDto, ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto, VerifyTwoFactorDto, SetTwoFactorDto, VerifyEmailDto } from './dto/auth.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard, JwtRefreshGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private prisma: PrismaService) {}

  // Returns the authoritative user profile for the current access token.
  // Always callable even when mustResetPassword is true.
  // Explicit allowlist — any new column added to User is denied by default.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      businessId: user.businessId,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      mustResetPassword: user.mustResetPassword,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorMethod: user.twoFactorMethod,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  register(@Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto, @Req() req: Request) {
    const fwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
    return this.authService.register(dto, { ip: fwd || req.ip });
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  login(@Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto, @Req() req: Request) {
    // The web proxies login server-side, so it forwards the real client UA/IP via
    // x-client-user-agent / x-forwarded-for; mobile hits us directly.
    const fwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
    const userAgent = (req.headers['x-client-user-agent'] as string | undefined) || req.headers['user-agent'];
    return this.authService.login(dto, { ip: fwd || req.ip, userAgent });
  }

  // Public — second factor: exchange a valid OTP (from the login challenge) for
  // tokens. Throttled like login.
  @Post('2fa/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  verifyTwoFactor(@Body(new ZodValidationPipe(VerifyTwoFactorSchema)) dto: VerifyTwoFactorDto, @Req() req: Request) {
    const fwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
    const userAgent = (req.headers['x-client-user-agent'] as string | undefined) || req.headers['user-agent'];
    return this.authService.verifyTwoFactor(dto.challengeId, dto.code, { ip: fwd || req.ip, userAgent }, dto.rememberDevice);
  }

  // Authenticated — turn 2FA on/off and pick the delivery method.
  @Post('2fa')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  setTwoFactor(@CurrentUser() user: User, @Body(new ZodValidationPipe(SetTwoFactorSchema)) dto: SetTwoFactorDto) {
    return this.authService.setTwoFactor(user.id, dto.enabled, dto.method);
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(JwtRefreshGuard)
  refresh(@CurrentUser() user: User, @Req() req: Request) {
    const presented = (req.body as { refreshToken?: string }).refreshToken;
    const userAgent = (req.headers['x-client-user-agent'] as string | undefined) || req.headers['user-agent'];
    return this.authService.refresh(user, presented, userAgent);
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: User & { _jti?: string; _tokenExp?: number }, @Req() req: Request) {
    const jtiUser = user as User & { _jti?: string; _tokenExp?: number };
    if (jtiUser._jti && jtiUser._tokenExp) {
      this.authService.revokeAccessToken(jtiUser._jti, jtiUser._tokenExp).catch(() => {});
    }
    const refreshToken = (req.body as { refreshToken?: string })?.refreshToken;
    return this.authService.logout(user.id, refreshToken);
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(ChangePasswordSchema)) dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  // Public — confirm an email address from the emailed link.
  @Post('verify-email')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  verifyEmail(@Body(new ZodValidationPipe(VerifyEmailSchema)) dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  // Authenticated — resend the verification link to the current user.
  @Post('resend-verification')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  resendVerification(@CurrentUser() user: User) {
    return this.authService.resendVerification(user.id);
  }

  // Public — start a self-service reset. Always 200 (never reveals if the email
  // exists). Throttled to blunt enumeration / email-bombing.
  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  forgotPassword(@Body(new ZodValidationPipe(ForgotPasswordSchema)) dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  // Public — complete the reset with the emailed token.
  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  resetPassword(@Body(new ZodValidationPipe(ResetPasswordSchema)) dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  // One-time bootstrap: promote BOOTSTRAP_ADMIN_EMAIL to ADMIN role.
  // Only active when BOOTSTRAP_ADMIN_SECRET env var is set. Remove the env var to disable.
  @Post('bootstrap-admin')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async bootstrapAdmin(@Body() body: { secret: string; email: string }) {
    const expected = process.env.BOOTSTRAP_ADMIN_SECRET;
    if (!expected || body.secret !== expected) throw new ForbiddenException('Invalid bootstrap secret');
    const allowed = process.env.BOOTSTRAP_ADMIN_EMAIL;
    if (!allowed || body.email.toLowerCase().trim() !== allowed.toLowerCase()) throw new ForbiddenException('Email not authorised for bootstrap');
    const user = await this.prisma.user.update({
      where: { email: body.email.toLowerCase().trim() },
      data: { role: 'ADMIN' },
      select: { id: true, email: true, role: true },
    });
    return { ok: true, user };
  }
}
