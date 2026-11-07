'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { TicketCard } from '@/components/customer/TicketCard';
import { api, ApiError } from '@/lib/api';
import { loadTickets, saveTickets } from '@/lib/ticketCache';
import type { Ticket } from '@/types/api';

// Tickets comprados desde este navegador (se identifican por la cookie del cliente).
export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    api<Ticket[]>('/tickets')
      .then((loaded) => {
        setTickets(loaded);
        saveTickets(loaded);
      })
      .catch((e) => {
        // Sin conexión: se muestran los tickets guardados en el celular.
        const unreachable = e instanceof ApiError && (e.isNetworkError || e.status >= 500);
        const cached = unreachable ? loadTickets() : null;
        if (cached) {
          setTickets(cached);
          setOffline(true);
        } else {
          setError(true);
        }
      });
  }, []);

  if (error) {
    return (
      <main className="page">
        <CustomerHeader current="tickets" />
        <p className="error">No se pudieron cargar tus tickets.</p>
      </main>
    );
  }
  if (!tickets) return <main className="page"><CustomerHeader current="tickets" />Cargando...</main>;

  return (
    <main className="page">
      {/* El catálogo al que se vuelve es el del evento de la compra más reciente. */}
      <CustomerHeader eventCode={tickets[0]?.eventCode} current="tickets" />
      <h1>Mis tickets</h1>
      {offline && (
        <p className="notice">Sin conexión: te mostramos los tickets guardados en este celular. Igual podés retirar.</p>
      )}
      {tickets.length === 0 && <p>Todavía no compraste nada desde este navegador.</p>}
      {tickets.map((ticket) => (
        <div key={ticket.id}>
          <TicketCard ticket={ticket} />
          {ticket.token && <Link href={`/t/${ticket.token}`}>Abrir solo este ticket</Link>}
        </div>
      ))}
    </main>
  );
}
