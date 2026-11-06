'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useStaffRequest } from '@/hooks/useStaffRequest';
import { api } from '@/lib/api';
import { formatTime } from '@/lib/format';
import type { StaffEvent, StaffUser } from '@/types/staff';

const STATUS_LABEL = { SCHEDULED: 'Programado', IN_PROGRESS: 'En curso', FINISHED: 'Finalizado' };

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

  if (!events) return <main className="page">Cargando...</main>;

  return (
    <main className="page">
      <header className="page-header">
        <h1>Barra</h1>
        <button className="link-button" onClick={logout}>
          Salir
        </button>
      </header>
      {user && <p className="muted">Hola, {user.name}</p>}
      {events.length === 0 && <p>No tenés eventos asignados.</p>}
      <ul className="list">
        {events.map((event) => (
          <li key={event.id} className="row">
            <div>
              <strong>{event.name}</strong>
              <div className="muted">
                {STATUS_LABEL[event.status]} · {formatTime(event.startsAt)} a {formatTime(event.endsAt)}
              </div>
            </div>
            <Link href={`/bar/${event.id}/scan`}>Abrir</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
