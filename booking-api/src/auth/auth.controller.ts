import { Controller, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterSchema, LoginSchema, ChangePasswordSchema, ForgotPasswordSchema, ResetPasswordSchema, RegisterDto, LoginDto, ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard, JwtRefreshGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5/min/IP on top of the global throttle
  login(@Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(JwtRefreshGuard)
  refresh(@CurrentUser() user: User) {
    return this.authService.refresh(user);
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: User) {
    return this.authService.logout(user.id);
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
}
