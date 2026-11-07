'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loading } from '@/components/ui/Loading';
import { useStaffRequest } from '@/hooks/useStaffRequest';
import type { DemandRow } from '@/types/staff';

const REFRESH_MS = 15_000;

// Demanda pendiente: lo vendido que todavía no se retiró, para anticipar insumos.
export default function DemandPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const request = useStaffRequest();
  const [rows, setRows] = useState<DemandRow[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    const load = () =>
      request<DemandRow[]>(`/staff/events/${eventId}/demand`)
        .then((loaded) => {
          setRows(loaded);
          setUpdatedAt(new Date());
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [eventId, request]);

  if (!rows) {
    return (
      <main className="page">
        <Loading />
      </main>
    );
  }

  return (
    <main className="page">
      <h1>Por entregar</h1>
      <p className="muted">
        Vendido y todavía no retirado, para preparar insumos. Se actualiza solo
        {updatedAt &&
          ` (última vez: ${updatedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })})`}
        .
      </p>
      {rows.length === 0 && <p className="card">No hay nada pendiente de entrega.</p>}
      {rows.length > 0 && <ul className="list">
        {rows.map((row) => (
          <li key={row.productName} className="row">
            <strong>{row.productName}</strong>
            <span className="demand-count">{row.quantity}</span>
          </li>
        ))}
      </ul>}
    </main>
  );
}
