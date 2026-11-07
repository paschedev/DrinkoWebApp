'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { useCart } from '@/hooks/useCart';
import { Loading } from '@/components/ui/Loading';
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
      // Si la respuesta se perdió, el pago pudo haberse hecho igual: se consulta el pedido.
      const updated = await api<Order>(`/orders/${orderId}`).catch(() => null);
      if (updated?.status === 'PAID') {
        cart.clear();
        router.push('/tickets');
        return;
      }
      if (updated) setOrder(updated);
    }
    setSending(false);
  }

  async function cancel() {
    if (!window.confirm('¿Cancelar el pedido? Se libera la reserva y volvés al carrito para cambiarlo.')) return;
    setSending(true);
    setError(null);
    try {
      await api<Order>(`/orders/${orderId}/cancel`, { method: 'POST' });
      router.push(`/e/${code}/cart`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo cancelar el pedido');
      setSending(false);
    }
  }

  if (!order) {
    return (
      <main className="page">
        <CustomerHeader eventCode={code} />
        {error ? <p className="error">{error}</p> : <Loading text="Cargando el pedido..." />}
      </main>
    );
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  const pending = order.status === 'PENDING_PAYMENT' && secondsLeft > 0;
  const expired = order.status === 'EXPIRED' || (order.status === 'PENDING_PAYMENT' && secondsLeft === 0);

  return (
    <main className="page">
      <CustomerHeader eventCode={code} />
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

      <div className="total">
        <span>Total</span>
        <span>{formatPrice(order.totalCents)}</span>
      </div>

      {pending && (
        <>
          <p className="notice">
            Tu pedido está reservado por <strong>{minutes}:{seconds}</strong>. Cada ticket se retira completo y de una
            sola vez.
          </p>
          <p className="muted">Pago simulado: en esta versión no se cobra dinero real.</p>
          <button className="primary" onClick={() => pay(true)} disabled={sending}>
            {sending ? 'Procesando...' : `Pagar ${formatPrice(order.totalCents)}`}
          </button>
          <div className="card-actions">
            <button className="link-button" onClick={cancel} disabled={sending}>
              Cancelar pedido
            </button>
            <button className="link-button" onClick={() => pay(false)} disabled={sending}>
              Simular pago rechazado
            </button>
          </div>
        </>
      )}

      {expired && <p className="error">La reserva venció y se liberó el stock.</p>}
      {order.status === 'REJECTED' && <p className="error">El pago fue rechazado y se liberó el stock.</p>}
      {error && <p className="error">{error}</p>}
      {order.status === 'PAID' && (
        <Link href="/tickets" className="button-link">
          Ver mis tickets
        </Link>
      )}
      {!pending && order.status !== 'PAID' && (
        <Link href={`/e/${code}/cart`} className="button-link">
          Volver al carrito
        </Link>
      )}
    </main>
  );
}
