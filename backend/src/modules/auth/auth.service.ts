import { createHash, randomBytes } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from './auth-user';

export const SESSION_COOKIE = 'drinko_session';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

// Hash de una contraseña que no usa nadie: si el email no existe se verifica contra
// este, así la respuesta tarda lo mismo y no revela qué emails están registrados.
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$CB7eOsNhgqZYer9xxRPBmQ$tSy8MPT05vwwAV1nu3Sne4SMdgdkHXO7rs3wjtB6Pj0';

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest();
}

// Sesiones guardadas en la base: el token viaja en una cookie httpOnly y en la
// tabla sessions solo queda su hash. Cerrar sesión es borrar la fila.
@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    const valid = await argon2.verify(user?.passwordHash ?? DUMMY_HASH, password).catch(() => false);
    if (!user || !user.passwordHash || !valid || !user.isActive) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    const token = randomBytes(32).toString('base64url');
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
    return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  }

  async findUserByToken(token: string): Promise<AuthUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date() || !session.user.isActive) return null;
    const { id, organizationId, role, name } = session.user;
    return { id, organizationId, role, name };
  }

  async logout(token: string) {
    await this.prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }
}
