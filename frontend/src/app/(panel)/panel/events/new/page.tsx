'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { useStaffRequest } from '@/hooks/useStaffRequest';
import { ApiError } from '@/lib/api';
import { fromLocalInput, toLocalInput } from '@/lib/dates';
import type { StaffMember } from '@/types/panel';

const HOUR = 60 * 60 * 1000;

// Alta de un evento con lo esencial: nombre, inicio, fin y staff.
// Los productos se suman desde el detalle del evento.
export default function NewEventPage() {
  const router = useRouter();
  const request = useStaffRequest();
  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date()));
  const [endsAt, setEndsAt] = useState(() => toLocalInput(new Date(Date.now() + 5 * HOUR)));
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    request<StaffMember[]>('/organizer/staff').then(setStaff).catch(() => {});
  }, [request]);

  function toggleStaff(id: string) {
    setStaffIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (new Date(endsAt) <= new Date(startsAt)) {
      setError('El fin tiene que ser posterior al inicio.');
      return;
    }
    setSending(true);
    try {
      const created = await request<{ id: string }>('/organizer/events', {
        method: 'POST',
        body: { name, startsAt: fromLocalInput(startsAt), endsAt: fromLocalInput(endsAt), staffIds },
      });
      router.push(`/panel/events/${created.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo crear el evento');
      setSending(false);
    }
  }

  return (
    <main className="page">
      <h1>Nuevo evento</h1>
      <form onSubmit={submit} className="form card">
        <label>
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        </label>
        <label>
          Inicio
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
        </label>
        <label>
          Fin
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required />
        </label>
        <p className="muted">Solo se vende mientras el evento está en curso. Los tickets se retiran hasta 1 hora después del fin.</p>

        <fieldset className="fieldset">
          <legend>Staff de la barra</legend>
          {staff.length === 0 && <p className="muted">Tu productora todavía no tiene staff.</p>}
          {staff.map((member) => (
            <label key={member.id} className="toggle">
              <input type="checkbox" checked={staffIds.includes(member.id)} onChange={() => toggleStaff(member.id)} />
              {member.name} <span className="muted">({member.email})</span>
            </label>
          ))}
        </fieldset>

        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={sending}>
          {sending ? 'Creando...' : 'Crear evento'}
        </button>
      </form>
    </main>
  );
}
