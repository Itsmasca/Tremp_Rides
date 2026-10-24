import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { AppConfig } from '../config/configuration';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

/** DatabaseModule es @Global(). UsersModule debe exportar UsersService. */
@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const auth = config.get('auth', { infer: true });
        // JWT_EXPIRES_IN acepta formatos de `ms` ('30d', '12h') o segundos
        const expiresIn = auth.jwtExpiresIn as JwtSignOptions['expiresIn'];
        return { secret: auth.jwtSecret, signOptions: { expiresIn } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [JwtAuthGuard, JwtModule], // para proteger rutas de otros módulos
})
export class AuthModule {}
