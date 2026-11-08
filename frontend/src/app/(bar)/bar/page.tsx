'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loading } from '@/components/ui/Loading';
import { useStaffRequest } from '@/hooks/useStaffRequest';
import { api } from '@/lib/api';
import { formatTime } from '@/lib/format';
import type { StaffEvent, StaffUser } from '@/types/staff';

const STATUS_LABEL = { SCHEDULED: 'Programado', IN_PROGRESS: 'En curso', FINISHED: 'Finalizado' };
// Los eventos en curso primero, después los programados y al final los terminados.
const STATUS_ORDER = { IN_PROGRESS: 0, SCHEDULED: 1, FINISHED: 2 };

// Eventos en los que el usuario puede operar la barra.
export default function BarHomePage() {
  const router = useRouter();
  const request = useStaffRequest();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [events, setEvents] = useState<StaffEvent[] | null>(null);

  useEffect(() => {
    request<StaffUser>('/auth/me').then(setUser).catch(() => {});
    request<StaffEvent[]>('/staff/events').then(setEvents).catch(() => {});
  }, [request]);

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/login');
  }

  if (!events) {
    return (
      <main className="page">
        <Loading text="Cargando tus eventos..." />
      </main>
    );
  }
  const sorted = [...events].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  return (
    <main className="page">
      <header className="page-header">
        <h1>Barra</h1>
        <button className="link-button" onClick={logout}>
          Salir
        </button>
      </header>
      {user && <p className="muted">Hola, {user.name}</p>}
      {user?.role === 'ORGANIZER' && (
        <Link href="/panel" className="button-link">
          Ir al Panel del Organizador
        </Link>
      )}
      {events.length === 0 && <p className="card">No tenés eventos asignados. Pedile al organizador que te asigne.</p>}
      {events.length > 0 && (
        <ul className="list">
          {sorted.map((event) => (
            <li key={event.id}>
              <Link href={`/bar/${event.id}/scan`} className="row row-link">
                <div>
                  <strong>{event.name}</strong>
                  <div className="muted">
                    {formatTime(event.startsAt)} a {formatTime(event.endsAt)}
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
