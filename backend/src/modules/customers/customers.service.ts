import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Customer } from '@prisma/client';
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

export const CUSTOMER_COOKIE = 'drinko_customer';
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function hashSecret(secret: string) {
  return createHash('sha256').update(secret).digest();
}

// El asistente compra sin cuenta: se lo identifica con un secreto aleatorio
// guardado en una cookie httpOnly. En la base solo queda el hash.
@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findFromRequest(req: Request): Promise<Customer | null> {
    const secret: unknown = req.cookies?.[CUSTOMER_COOKIE];
    if (typeof secret !== 'string' || secret.length === 0) return null;
    return this.prisma.customer.findUnique({ where: { secretHash: hashSecret(secret) } });
  }

  async findOrCreate(req: Request, res: Response): Promise<Customer> {
    const existing = await this.findFromRequest(req);
    if (existing) return existing;

    const secret = randomBytes(32).toString('base64url');
    const customer = await this.prisma.customer.create({ data: { secretHash: hashSecret(secret) } });
    res.cookie(CUSTOMER_COOKIE, secret, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: COOKIE_MAX_AGE_MS,
      path: '/',
    });
    return customer;
  }
}
