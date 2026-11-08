'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Loading } from '@/components/ui/Loading';
import { useStaffRequest } from '@/hooks/useStaffRequest';
import { ApiError } from '@/lib/api';
import { formatTime } from '@/lib/format';
import type { PanelEvent } from '@/types/panel';

const STATUS_LABEL = { SCHEDULED: 'Programado', IN_PROGRESS: 'En curso', FINISHED: 'Finalizado' };
const STATUS_ORDER = { IN_PROGRESS: 0, SCHEDULED: 1, FINISHED: 2 };

// Panel del Organizador: eventos de la productora.
export default function PanelEventsPage() {
  const request = useStaffRequest();
  const [events, setEvents] = useState<PanelEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    request<PanelEvent[]>('/organizer/events')
      .then(setEvents)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'No se pudieron cargar los eventos'));
  }, [request]);

  if (error) {
    return (
      <main className="page">
        <p className="error">{error}</p>
        <Link href="/bar">Ir a la barra</Link>
      </main>
    );
  }
  if (!events) {
    return (
      <main className="page">
        <Loading text="Cargando eventos..." />
      </main>
    );
  }

  const sorted = [...events].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.startsAt.localeCompare(b.startsAt),
  );

  return (
    <main className="page">
      <div className="page-header">
        <h1>Eventos</h1>
      </div>
      <Link href="/panel/events/new" className="button-link primary-link">
        + Nuevo evento
      </Link>
      {events.length === 0 && <p className="card">Todavía no creaste eventos.</p>}
      {events.length > 0 && (
        <ul className="list spaced">
          {sorted.map((event) => (
            <li key={event.id}>
              <Link href={`/panel/events/${event.id}`} className="row row-link">
                <div>
                  <strong>{event.name}</strong>
                  <div className="muted">
                    {formatTime(event.startsAt)} a {formatTime(event.endsAt)}
                  </div>
                  <div className="muted">
                    {event.productCount} productos · {event.staffCount} staff
                  </div>
                </div>
                <span className={event.status === 'IN_PROGRESS' ? 'badge active' : 'badge'}>
                  {STATUS_LABEL[event.status]} ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
