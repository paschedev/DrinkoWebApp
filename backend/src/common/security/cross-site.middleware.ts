import { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Defensa contra CSRF, además de las cookies SameSite=Lax: los navegadores mandan
// Sec-Fetch-Site en cada pedido, y una página de otro sitio que intente comprar,
// pagar o canjear con la cookie del usuario llega con "cross-site". Esos pedidos se
// rechazan. Nuestro frontend llama a /api en su mismo dominio ("same-origin").
export function rejectCrossSiteWrites(req: Request, res: Response, next: NextFunction) {
  if (!SAFE_METHODS.has(req.method) && req.get('sec-fetch-site') === 'cross-site') {
    res.status(403).json({ statusCode: 403, message: 'Pedido de otro sitio rechazado' });
    return;
  }
  next();
}
