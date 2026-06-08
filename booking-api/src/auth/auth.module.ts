import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthLockService } from './auth-lock.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PassportModule, JwtModule.register({}), NotificationsModule],
  controllers: [AuthController],
  providers: [AuthService, AuthLockService, JwtStrategy, JwtRefreshStrategy],
  exports: [AuthService, AuthLockService],
})
export class AuthModule {}
