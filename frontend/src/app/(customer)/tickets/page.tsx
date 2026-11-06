'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TicketCard } from '@/components/customer/TicketCard';
import { api } from '@/lib/api';
import type { Ticket } from '@/types/api';

// Tickets comprados desde este navegador (se identifican por la cookie del cliente).
export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api<Ticket[]>('/tickets')
      .then(setTickets)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <main className="page">
        <p className="error">No se pudieron cargar tus tickets.</p>
      </main>
    );
  }
  if (!tickets) return <main className="page">Cargando...</main>;

  return (
    <main className="page">
      <h1>Mis tickets</h1>
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
