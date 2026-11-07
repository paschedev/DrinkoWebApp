'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { TicketCard } from '@/components/customer/TicketCard';
import { Loading } from '@/components/ui/Loading';
import { api, ApiError } from '@/lib/api';
import { repeatPurchase } from '@/lib/repeatPurchase';
import { loadTickets, saveTickets } from '@/lib/ticketCache';
import type { Ticket } from '@/types/api';

const REFRESH_MS = 20_000;

// Tickets comprados desde este navegador (se identifican por la cookie del cliente).
// Arriba los que se pueden retirar; abajo el historial de retirados y vencidos.
export default function MyTicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState(false);
  const [repeatError, setRepeatError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      api<Ticket[]>('/tickets')
        .then((loaded) => {
          setTickets(loaded);
          setOffline(false);
          saveTickets(loaded);
        })
        .catch((e) => {
          // Sin conexión: se muestran los tickets guardados en el celular.
          const unreachable = e instanceof ApiError && (e.isNetworkError || e.status >= 500);
          const cached = unreachable ? loadTickets() : null;
          if (cached) {
            setTickets((current) => current ?? cached);
            setOffline(true);
          } else {
            setError(true);
          }
        });
    load();
    // Se actualiza solo: cuando la barra canjea un ticket, su QR deja de mostrarse.
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  async function repeat(ticket: Ticket) {
    setRepeatError(null);
    try {
      router.push(await repeatPurchase(ticket));
    } catch (e) {
      setRepeatError(e instanceof Error ? e.message : 'No se pudo repetir la compra.');
    }
  }

  if (error && !tickets) {
    return (
      <main className="page">
        <CustomerHeader current="tickets" />
        <p className="error">No se pudieron cargar tus tickets.</p>
      </main>
    );
  }
  if (!tickets) {
    return (
      <main className="page">
        <CustomerHeader current="tickets" />
        <Loading text="Cargando tus tickets..." />
      </main>
    );
  }

  const active = tickets.filter((t) => t.status === 'ACTIVE');
  const history = tickets.filter((t) => t.status !== 'ACTIVE');

  return (
    <main className="page">
      {/* El catálogo al que se vuelve es el del evento de la compra más reciente. */}
      <CustomerHeader eventCode={tickets[0]?.eventCode} current="tickets" />
      <h1>Mis tickets</h1>
      {offline && (
        <p className="notice">Sin conexión: te mostramos los tickets guardados en este celular. Igual podés retirar.</p>
      )}
      {repeatError && <p className="error">{repeatError}</p>}
      {tickets.length === 0 && (
        <>
          <p>Todavía no compraste nada desde este navegador.</p>
          <p className="muted">Escaneá el QR de acceso del evento para ver el catálogo.</p>
        </>
      )}

      {active.length > 0 && <h2 className="section-title">Para retirar</h2>}
      {active.map((ticket) => (
        <TicketCard key={ticket.id} ticket={ticket}>
          <Link href={`/t/${ticket.token}`} className="link-button">
            Compartir este ticket
          </Link>
          <button className="link-button" onClick={() => repeat(ticket)}>
            Repetir compra
          </button>
        </TicketCard>
      ))}

      {history.length > 0 && <h2 className="section-title">Historial</h2>}
      {history.map((ticket) => (
        <TicketCard key={ticket.id} ticket={ticket}>
          {ticket.status === 'REDEEMED' && (
            <button className="link-button" onClick={() => repeat(ticket)}>
              Repetir compra
            </button>
          )}
        </TicketCard>
      ))}
    </main>
  );
}
