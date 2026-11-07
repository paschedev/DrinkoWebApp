'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { Loading } from '@/components/ui/Loading';
import { CART_NOTICE_KEY, MAX_PER_TICKET, useCart } from '@/hooks/useCart';
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

  // Ticket nuevo y vacío: se vuelve al catálogo para llenarlo.
  function newTicket() {
    cart.addTicket();
    router.push(`/e/${code}`);
  }

  // Aviso que deja "Repetir compra" (por ejemplo, productos que ya no están disponibles).
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    try {
      setNotice(sessionStorage.getItem(CART_NOTICE_KEY));
      sessionStorage.removeItem(CART_NOTICE_KEY);
    } catch {
      // Sin almacenamiento no hay aviso.
    }
  }, []);

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

  if (!cart.loaded) {
    return (
      <main className="page">
        <CustomerHeader eventCode={code} />
        <Loading />
      </main>
    );
  }

  if (cart.itemCount === 0) {
    return (
      <main className="page">
        <CustomerHeader eventCode={code} />
        <h1>Tu carrito está vacío</h1>
        {notice && <p className="notice">{notice}</p>}
        <Link href={`/e/${code}`} className="button-link">
          Ver el catálogo
        </Link>
      </main>
    );
  }

  function removeTicket(index: number) {
    const ticket = cart.tickets[index];
    if (ticket.items.length > 0 && !window.confirm(`¿Quitar el Ticket ${index + 1} con todos sus productos?`)) return;
    cart.removeTicket(index);
  }

  return (
    <main className="page">
      <CustomerHeader eventCode={code} />
      <h1>Carrito</h1>
      {notice && <p className="notice">{notice}</p>}
      <p className="hint">
        Cada ticket se retira completo y de una sola vez. Para retirar en momentos distintos, dividí tu compra en varios
        tickets.
      </p>

      {cart.tickets.map((ticket, index) => {
        const units = ticket.items.reduce((sum, item) => sum + item.quantity, 0);
        return (
          <section key={index} className="card">
            <div className="page-header">
              <h2>Ticket {index + 1}</h2>
              <span className="muted">{formatPrice(ticket.items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0))}</span>
            </div>
            {ticket.items.length === 0 && <p className="muted">Todavía no tiene productos.</p>}
            <ul className="list">
              {ticket.items.map((item) => (
                <li key={item.eventProductId} className="row">
                  <div>
                    <strong>{item.name}</strong>
                    <div className="muted">{formatPrice(item.priceCents * item.quantity)}</div>
                  </div>
                  <div className="stepper">
                    <button onClick={() => cart.changeQuantity(index, item, -1)} aria-label={`Quitar un ${item.name}`}>
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      onClick={() => cart.changeQuantity(index, item, 1)}
                      disabled={item.quantity >= MAX_PER_TICKET}
                      aria-label={`Agregar un ${item.name}`}
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="card-actions">
              <button className="link-button" onClick={() => addMoreTo(index)}>
                Agregar productos
              </button>
              {units > 0 && (
                <button className="link-button" onClick={() => cart.duplicateTicket(index)}>
                  Duplicar
                </button>
              )}
              {units > 1 && (
                <button className="link-button" onClick={() => cart.splitTicket(index)}>
                  Dividir en dos
                </button>
              )}
              {cart.tickets.length > 1 && (
                <button className="link-button" onClick={() => removeTicket(index)}>
                  Quitar ticket
                </button>
              )}
            </div>
          </section>
        );
      })}

      <button className="secondary" onClick={newTicket}>
        + Nuevo ticket vacío
      </button>

      <div className="total">
        <span>Total</span>
        <span>{formatPrice(cart.totalCents)}</span>
      </div>
      {error && <p className="error">{error}</p>}
      <button className="primary" onClick={confirm} disabled={sending}>
        {sending ? 'Reservando el stock...' : 'Confirmar y pagar'}
      </button>
    </main>
  );
}
