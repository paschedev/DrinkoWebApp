import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthUser } from './auth-user';
import { AuthService, SESSION_COOKIE, SESSION_TTL_MS } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { SessionGuard } from './session.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.login(body.email, body.password);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_TTL_MS,
      path: '/',
    });
    return user;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string') await this.auth.logout(token);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.getProfile(user.id);
  }
}
