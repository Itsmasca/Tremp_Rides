import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { AuthService } from './auth.service';
import { JwtPayload } from './auth.types';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** 201 { token, user } · 400 validación · 409 correo duplicado. Mismo body que POST /users. */
  @Post('register')
  register(@Body() dto: CreateUserDto) {
    return this.auth.register(dto);
  }

  /** 200 { token, user } · 401 credenciales incorrectas */
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  /** 200 user · 401 sin token, expirado o usuario borrado */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload) {
    return this.auth.me(user.sub);
  }
}
