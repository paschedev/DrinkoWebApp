'use client';

import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Loading } from '@/components/ui/Loading';
import { useStaffRequest } from '@/hooks/useStaffRequest';
import { ApiError } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import type { Offer } from '@/types/staff';

type Change = { priceCents?: number; isAvailable?: boolean; stockDelta?: number };
type SaveState = { kind: 'saving' } | { kind: 'saved'; text: string } | { kind: 'error'; text: string } | null;

// Precio, stock y disponibilidad de cada producto del evento.
export default function ProductsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const request = useStaffRequest();
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    request<Offer[]>(`/staff/events/${eventId}/products`)
      .then(setOffers)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'No se pudieron cargar los productos'));
  }, [eventId, request]);

  async function update(offer: Offer, body: Change) {
    const updated = await request<Offer>(`/staff/events/${eventId}/products/${offer.eventProductId}`, {
      method: 'PATCH',
      body,
    });
    setOffers((prev) => prev?.map((o) => (o.eventProductId === updated.eventProductId ? updated : o)) ?? null);
  }

  if (!offers) {
    return <main className="page">{error ? <p className="error">{error}</p> : <Loading text="Cargando productos..." />}</main>;
  }

  return (
    <main className="page">
      <h1>Productos</h1>
      <p className="muted">Los cambios se aplican en el momento y quedan registrados.</p>
      {offers.map((offer) => (
        <OfferRow key={offer.eventProductId} offer={offer} onChange={(body) => update(offer, body)} />
      ))}
    </main>
  );
}

function OfferRow({ offer, onChange }: { offer: Offer; onChange: (body: Change) => Promise<void> }) {
  const [price, setPrice] = useState(String(offer.priceCents / 100));
  const [units, setUnits] = useState('');
  const [state, setState] = useState<SaveState>(null);

  async function save(body: Change, savedText: string) {
    setState({ kind: 'saving' });
    try {
      await onChange(body);
      setState({ kind: 'saved', text: savedText });
    } catch (e) {
      setState({ kind: 'error', text: e instanceof ApiError ? e.message : 'No se pudo guardar el cambio' });
    }
  }

  // El precio cambia lo que se cobra: se pide confirmación antes de guardarlo.
  function savePrice(event: FormEvent) {
    event.preventDefault();
    const cents = Math.round(Number(price.replace(',', '.')) * 100);
    if (!(cents > 0)) {
      setState({ kind: 'error', text: 'Ingresá un precio mayor a cero' });
      return;
    }
    if (cents === offer.priceCents) return;
    const question = `¿Cambiar el precio de ${offer.name} de ${formatPrice(offer.priceCents)} a ${formatPrice(cents)}?`;
    if (!window.confirm(question)) {
      setPrice(String(offer.priceCents / 100));
      return;
    }
    save({ priceCents: cents }, `Precio guardado: ${formatPrice(cents)}`);
  }

  function adjustStock(sign: 1 | -1) {
    const amount = Number(units);
    if (!Number.isInteger(amount) || amount <= 0) {
      setState({ kind: 'error', text: 'Ingresá una cantidad entera de unidades' });
      return;
    }
    setUnits('');
    save({ stockDelta: sign * amount }, sign > 0 ? `Se sumaron ${amount} unidades` : `Se descontaron ${amount} unidades`);
  }

  const priceChanged = Math.round(Number(price.replace(',', '.')) * 100) !== offer.priceCents;

  return (
    <section className={offer.isAvailable ? 'card' : 'card unavailable'}>
      <div className="page-header">
        <h2>{offer.name}</h2>
        <label className="toggle">
          <input
            type="checkbox"
            checked={offer.isAvailable}
            onChange={(e) =>
              save({ isAvailable: e.target.checked }, e.target.checked ? 'Disponible para la venta' : 'Pausado: no se vende')
            }
          />
          Disponible
        </label>
      </div>

      <form className="field-row" onSubmit={savePrice}>
        <label>
          Precio ($)
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <button className="small-button wide" disabled={!priceChanged}>
          Guardar
        </button>
      </form>

      {offer.stock === null ? (
        <p className="muted">Sin control de stock</p>
      ) : (
        <div className="field-row">
          <label>
            Stock actual: {offer.stock}
            <input
              className="small-input"
              inputMode="numeric"
              placeholder="Cantidad"
              aria-label={`Unidades para sumar o descontar de ${offer.name}`}
              value={units}
              onChange={(e) => setUnits(e.target.value)}
            />
          </label>
          <button className="small-button wide" onClick={() => adjustStock(1)}>
            + Sumar
          </button>
          <button className="small-button wide" onClick={() => adjustStock(-1)}>
            − Restar
          </button>
        </div>
      )}

      {state?.kind === 'saving' && <p className="save-status muted">Guardando...</p>}
      {state?.kind === 'saved' && <p className="save-status muted">✓ {state.text}</p>}
      {state?.kind === 'error' && <p className="save-status error">{state.text}</p>}
    </section>
  );
}
