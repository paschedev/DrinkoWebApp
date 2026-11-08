'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Loading } from '@/components/ui/Loading';
import { useStaffRequest } from '@/hooks/useStaffRequest';
import { ApiError } from '@/lib/api';
import { fromLocalInput, toLocalInput } from '@/lib/dates';
import { formatPrice, formatTime } from '@/lib/format';
import type { PanelEventDetail, PanelProduct, StaffMember } from '@/types/panel';

const STATUS_LABEL = { SCHEDULED: 'Programado', IN_PROGRESS: 'En curso', FINISHED: 'Finalizado' };

export default function PanelEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const request = useStaffRequest();
  const [event, setEvent] = useState<PanelEventDetail | null>(null);
  const [catalog, setCatalog] = useState<PanelProduct[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  const load = useCallback(() => {
    request<PanelEventDetail>(`/organizer/events/${id}`)
      .then(setEvent)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'No se pudo cargar el evento'));
  }, [id, request]);

  useEffect(() => {
    setOrigin(window.location.origin);
    load();
    request<PanelProduct[]>('/organizer/products').then(setCatalog).catch(() => {});
    request<StaffMember[]>('/organizer/staff').then(setStaff).catch(() => {});
  }, [load, request]);

  async function remove() {
    if (!event || !window.confirm(`¿Eliminar "${event.name}"? No se puede deshacer.`)) return;
    try {
      await request(`/organizer/events/${id}`, { method: 'DELETE' });
      router.push('/panel');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo eliminar');
    }
  }

  if (!event) {
    return <main className="page">{error ? <p className="error">{error}</p> : <Loading text="Cargando evento..." />}</main>;
  }

  const accessUrl = `${origin}/e/${event.accessCode}`;
  const finished = event.status === 'FINISHED';

  return (
    <main className="page">
      <p className="no-print">
        <Link href="/panel">← Eventos</Link>
      </p>
      <div className="page-header">
        <h1>{event.name}</h1>
        <span className={event.status === 'IN_PROGRESS' ? 'badge active' : 'badge'}>{STATUS_LABEL[event.status]}</span>
      </div>
      <p className="muted">
        {formatTime(event.startsAt)} a {formatTime(event.endsAt)}
      </p>
      {error && <p className="error">{error}</p>}

      <section className="card print-area">
        <h2>QR de acceso</h2>
        <p className="muted">Imprimilo y ponelo en el evento: abre el catálogo en el celular.</p>
        <div className="qr">
          <QRCodeSVG value={accessUrl} size={220} marginSize={1} />
        </div>
        <p className="center">
          <a href={accessUrl}>{accessUrl}</a>
        </p>
        <button className="secondary no-print" onClick={() => window.print()}>
          Imprimir QR
        </button>
      </section>

      {!finished && <EditEvent event={event} onSaved={setEvent} />}
      {!finished && <AssignStaff event={event} staff={staff} onSaved={setEvent} />}
      <Offer event={event} catalog={catalog} onSaved={setEvent} />

      {event.status === 'SCHEDULED' && !event.hasOrders && (
        <button className="danger no-print" onClick={remove}>
          Eliminar evento
        </button>
      )}
    </main>
  );
}

type SectionProps = { event: PanelEventDetail; onSaved: (event: PanelEventDetail) => void };

function useSave() {
  const request = useStaffRequest();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  async function save<T>(path: string, method: string, body: unknown, okText: string): Promise<T | null> {
    setStatus(null);
    try {
      const result = await request<T>(path, { method, body });
      setStatus({ ok: true, text: okText });
      return result;
    } catch (e) {
      setStatus({ ok: false, text: e instanceof ApiError ? e.message : 'No se pudo guardar' });
      return null;
    }
  }
  const message = status && <p className={status.ok ? 'save-status muted' : 'save-status error'}>{status.ok ? `✓ ${status.text}` : status.text}</p>;
  return { save, message };
}

// Programado: se edita todo. En curso: solo el nombre y extender el fin.
function EditEvent({ event, onSaved }: SectionProps) {
  const { save, message } = useSave();
  const [name, setName] = useState(event.name);
  const [startsAt, setStartsAt] = useState(toLocalInput(new Date(event.startsAt)));
  const [endsAt, setEndsAt] = useState(toLocalInput(new Date(event.endsAt)));
  const inProgress = event.status === 'IN_PROGRESS';

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = inProgress
      ? { name, endsAt: fromLocalInput(endsAt) }
      : { name, startsAt: fromLocalInput(startsAt), endsAt: fromLocalInput(endsAt) };
    const updated = await save<PanelEventDetail>(`/organizer/events/${event.id}`, 'PATCH', body, 'Cambios guardados');
    if (updated) onSaved(updated);
  }

  return (
    <form className="card form no-print" onSubmit={submit}>
      <h2>Datos del evento</h2>
      <label>
        Nombre
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
      </label>
      <label>
        Inicio
        <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} disabled={inProgress} />
      </label>
      <label>
        Fin
        <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
      </label>
      {inProgress && <p className="muted">El evento ya empezó: solo podés cambiar el nombre o extender el fin.</p>}
      <button className="secondary">Guardar cambios</button>
      {message}
    </form>
  );
}

function AssignStaff({ event, staff, onSaved }: SectionProps & { staff: StaffMember[] }) {
  const { save, message } = useSave();
  const [selected, setSelected] = useState<string[]>(event.staffIds);

  function toggle(id: string) {
    setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function submit() {
    const updated = await save<PanelEventDetail>(`/organizer/events/${event.id}/staff`, 'PUT', { staffIds: selected }, 'Staff actualizado');
    if (updated) onSaved(updated);
  }

  return (
    <section className="card no-print">
      <h2>Staff de la barra</h2>
      {staff.length === 0 && <p className="muted">Tu productora todavía no tiene staff.</p>}
      {staff.map((member) => (
        <label key={member.id} className="toggle">
          <input type="checkbox" checked={selected.includes(member.id)} onChange={() => toggle(member.id)} />
          {member.name}
        </label>
      ))}
      {staff.length > 0 && (
        <button className="secondary" onClick={submit}>
          Guardar staff
        </button>
      )}
      {message}
    </section>
  );
}

function Offer({ event, catalog, onSaved }: SectionProps & { catalog: PanelProduct[] }) {
  const { save, message } = useSave();
  const offered = new Set(event.products.map((p) => p.productId));
  const available = catalog.filter((p) => !p.isArchived && !offered.has(p.id));
  const [productId, setProductId] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const finished = event.status === 'FINISHED';

  async function add(e: FormEvent) {
    e.preventDefault();
    const priceCents = Math.round(Number(price.replace(',', '.')) * 100);
    const body = {
      products: [{ productId, priceCents, ...(stock.trim() !== '' ? { stock: Number(stock) } : {}) }],
    };
    const updated = await save<PanelEventDetail>(`/organizer/events/${event.id}/products`, 'POST', body, 'Producto agregado');
    if (updated) {
      onSaved(updated);
      setProductId('');
      setPrice('');
      setStock('');
    }
  }

  return (
    <section className="card no-print">
      <h2>Productos del evento</h2>
      {event.products.length === 0 && <p className="muted">Todavía no agregaste productos.</p>}
      <ul className="list">
        {event.products.map((p) => (
          <li key={p.eventProductId} className="row">
            <div>
              <strong>{p.name}</strong>
              <div className="muted">
                {p.stock === null ? 'Sin control de stock' : `Stock: ${p.stock}`}
                {!p.isAvailable && ' · Pausado'}
              </div>
            </div>
            <span>{formatPrice(p.priceCents)}</span>
          </li>
        ))}
      </ul>
      {event.products.length > 0 && (
        <p>
          <Link href={`/bar/${event.id}/products`}>Cambiar precios, stock o disponibilidad</Link>
        </p>
      )}

      {!finished && (
        <form className="form" onSubmit={add}>
          <h3 className="section-title">Agregar producto</h3>
          {available.length === 0 ? (
            <p className="muted">
              No hay productos para agregar. <Link href="/panel/catalog">Crealos en Productos</Link>.
            </p>
          ) : (
            <>
              <label>
                Producto
                <select value={productId} onChange={(e) => setProductId(e.target.value)} required>
                  <option value="">Elegí un producto</option>
                  {available.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field-row">
                <label>
                  Precio ($)
                  <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
                </label>
                <label>
                  Stock (opcional)
                  <input inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Sin límite" />
                </label>
              </div>
              <button className="secondary" disabled={!productId || !(Number(price.replace(',', '.')) > 0)}>
                Agregar al evento
              </button>
            </>
          )}
        </form>
      )}
      {message}
    </section>
  );
}
