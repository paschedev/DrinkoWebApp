'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { TicketCard } from '@/components/customer/TicketCard';
import { Loading } from '@/components/ui/Loading';
import { api, ApiError } from '@/lib/api';
import { loadTickets } from '@/lib/ticketCache';
import type { Ticket } from '@/types/api';

// Un ticket suelto. Es al portador: sirve para pasárselo a otra persona.
export default function TicketPage() {
  const { token } = useParams<{ token: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Ticket>(`/tickets/${token}`)
      .then(setTicket)
      .catch((e) => {
        // Sin conexión: si el ticket está guardado en el celular, se muestra igual.
        const unreachable = e instanceof ApiError && (e.isNetworkError || e.status >= 500);
        const cached = unreachable ? loadTickets()?.find((t) => t.token === token) : undefined;
        if (cached) setTicket(cached);
        else setError(e instanceof ApiError ? e.message : 'No se pudo cargar el ticket');
      });
  }, [token]);

  if (error) {
    return (
      <main className="page">
        <CustomerHeader />
        <p className="error">{error}</p>
      </main>
    );
  }
  if (!ticket) {
    return (
      <main className="page">
        <CustomerHeader />
        <Loading text="Cargando el ticket..." />
      </main>
    );
  }

  return (
    <main className="page">
      <CustomerHeader eventCode={ticket.eventCode} />
      <TicketCard ticket={ticket} />
      {ticket.status === 'ACTIVE' && (
        <p className="muted center">El ticket es al portador: lo retira quien muestre este QR.</p>
      )}
    </main>
  );
}
