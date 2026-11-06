'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCart } from '@/hooks/useCart';
import { api, ApiError } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import type { Order } from '@/types/api';

function useSecondsLeft(expiresAt: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!expiresAt) return 0;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
}

// Pago simulado: reemplaza a la pasarela real en esta etapa.
export default function PaymentPage() {
  const { code, orderId } = useParams<{ code: string; orderId: string }>();
  const router = useRouter();
  const cart = useCart(code);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const secondsLeft = useSecondsLeft(order?.expiresAt);

  useEffect(() => {
    api<Order>(`/orders/${orderId}`)
      .then(setOrder)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'No se pudo cargar el pedido'));
  }, [orderId]);

  async function pay(approved: boolean) {
    setSending(true);
    setError(null);
    try {
      const result = await api<Order>(`/orders/${orderId}/payment`, { method: 'POST', body: { approved } });
      if (result.status === 'PAID') {
        cart.clear();
        router.push('/tickets');
        return;
      }
      setOrder(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo procesar el pago');
      const updated = await api<Order>(`/orders/${orderId}`).catch(() => null);
      if (updated) setOrder(updated);
    }
    setSending(false);
  }

  if (!order) {
    return <main className="page">{error ? <p className="error">{error}</p> : 'Cargando...'}</main>;
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  const pending = order.status === 'PENDING_PAYMENT' && secondsLeft > 0;
  const expired = order.status === 'EXPIRED' || (order.status === 'PENDING_PAYMENT' && secondsLeft === 0);

  return (
    <main className="page">
      <h1>Pago</h1>
      <p className="muted">{order.event.name}</p>

      {order.tickets.map((ticket, index) => (
        <section key={ticket.id} className="card">
          <h2>Ticket {index + 1}</h2>
          <ul className="plain">
            {ticket.items.map((item) => (
              <li key={item.productName}>
                {item.quantity} × {item.productName} · {formatPrice(item.unitPriceCents * item.quantity)}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="total">Total: {formatPrice(order.totalCents)}</p>

      {pending && (
        <>
          <p className="notice">
            Tenés el stock reservado por {minutes}:{seconds}. Cada ticket se retira completo y de una sola vez.
          </p>
          <button className="primary" onClick={() => pay(true)} disabled={sending}>
            Pagar (simulado)
          </button>
          <button className="secondary" onClick={() => pay(false)} disabled={sending}>
            Simular pago rechazado
          </button>
        </>
      )}

      {expired && <p className="error">La reserva venció. Volvé a armar el pedido.</p>}
      {order.status === 'REJECTED' && <p className="error">El pago fue rechazado y se liberó el stock.</p>}
      {error && <p className="error">{error}</p>}
      {order.status === 'PAID' && <Link href="/tickets">Ver mis tickets</Link>}
      {!pending && order.status !== 'PAID' && <Link href={`/e/${code}/cart`}>Volver al carrito</Link>}
    </main>
  );
}
