'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { MAX_PER_TICKET, useCart } from '@/hooks/useCart';
import { api, ApiError } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { newUuid } from '@/lib/uuid';
import type { Order } from '@/types/api';

const ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

// Reintenta solo si no hubo respuesta o el servidor falló. Usa siempre la misma
// clave de idempotencia: si el primer intento llegó, el backend devuelve ese
// mismo pedido en vez de crear otro.
async function createOrderWithRetry(code: string, body: unknown) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await api<Order>(`/events/${code}/orders`, { method: 'POST', body });
    } catch (e) {
      const retryable = e instanceof ApiError && (e.isNetworkError || e.status >= 500);
      if (!retryable || attempt === ATTEMPTS) throw e;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

export default function CartPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const cart = useCart(code);
  // Misma clave en los reintentos: si el pedido ya se creó, el backend no lo duplica.
  const [idempotencyKey] = useState(newUuid);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addMoreTo(index: number) {
    cart.setActive(index);
    router.push(`/e/${code}`);
  }

  function splitTicket() {
    cart.addTicket();
    router.push(`/e/${code}`);
  }

  async function confirm() {
    setSending(true);
    setError(null);
    const tickets = cart.tickets
      .filter((ticket) => ticket.items.length > 0)
      .map((ticket) => ({
        items: ticket.items.map(({ eventProductId, quantity }) => ({ eventProductId, quantity })),
      }));
    try {
      const order = await createOrderWithRetry(code, { idempotencyKey, tickets });
      router.push(`/e/${code}/payment/${order.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Si ya hay un pedido pendiente, se retoma su pago.
        const pending = await api<Order>(`/events/${code}/orders/pending`).catch(() => null);
        if (pending) {
          router.push(`/e/${code}/payment/${pending.id}`);
          return;
        }
      }
      setError(e instanceof ApiError ? e.message : 'No se pudo crear el pedido');
      setSending(false);
    }
  }

  if (!cart.loaded) return <main className="page"><CustomerHeader eventCode={code} />Cargando...</main>;

  if (cart.itemCount === 0) {
    return (
      <main className="page">
        <CustomerHeader eventCode={code} />
        <h1>Tu carrito está vacío</h1>
        <Link href={`/e/${code}`}>Volver al catálogo</Link>
      </main>
    );
  }

  return (
    <main className="page">
      <CustomerHeader eventCode={code} />
      <h1>Carrito</h1>
      <p className="notice">
        Cada ticket se retira completo y de una sola vez. Si querés retirar en momentos distintos, separá tu compra en
        varios tickets.
      </p>

      {cart.tickets.map((ticket, index) => (
        <section key={index} className="card">
          <div className="page-header">
            <h2>Ticket {index + 1}</h2>
            {cart.tickets.length > 1 && (
              <button className="link-button" onClick={() => cart.removeTicket(index)}>
                Quitar
              </button>
            )}
          </div>
          {ticket.items.length === 0 && <p className="muted">Sin productos</p>}
          <ul className="list">
            {ticket.items.map((item) => (
              <li key={item.eventProductId} className="row">
                <div>
                  <strong>{item.name}</strong>
                  <div className="muted">{formatPrice(item.priceCents * item.quantity)}</div>
                </div>
                <div className="stepper">
                  <button onClick={() => cart.changeQuantity(index, item, -1)} aria-label="Quitar uno">
                    −
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    onClick={() => cart.changeQuantity(index, item, 1)}
                    disabled={item.quantity >= MAX_PER_TICKET}
                    aria-label="Agregar uno"
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button className="link-button" onClick={() => addMoreTo(index)}>
            Agregar productos a este ticket
          </button>
        </section>
      ))}

      <button className="secondary" onClick={splitTicket}>
        Separar en otro ticket
      </button>

      {error && <p className="error">{error}</p>}
      <button className="primary" onClick={confirm} disabled={sending}>
        {sending ? 'Reservando...' : `Confirmar y pagar · ${formatPrice(cart.totalCents)}`}
      </button>
    </main>
  );
}
