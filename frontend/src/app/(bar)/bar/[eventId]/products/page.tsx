'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useStaffRequest } from '@/hooks/useStaffRequest';
import { ApiError } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import type { Offer } from '@/types/staff';

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

  async function update(offer: Offer, body: { priceCents?: number; isAvailable?: boolean; stockDelta?: number }) {
    setError(null);
    try {
      const updated = await request<Offer>(`/staff/events/${eventId}/products/${offer.eventProductId}`, {
        method: 'PATCH',
        body,
      });
      setOffers((prev) => prev?.map((o) => (o.eventProductId === updated.eventProductId ? updated : o)) ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo guardar el cambio');
    }
  }

  if (!offers) return <main className="page">{error ? <p className="error">{error}</p> : 'Cargando...'}</main>;

  return (
    <main className="page">
      <h1>Productos</h1>
      {error && <p className="error">{error}</p>}
      {offers.map((offer) => (
        <OfferRow key={offer.eventProductId} offer={offer} onChange={(body) => update(offer, body)} />
      ))}
    </main>
  );
}

function OfferRow({
  offer,
  onChange,
}: {
  offer: Offer;
  onChange: (body: { priceCents?: number; isAvailable?: boolean; stockDelta?: number }) => void;
}) {
  const [price, setPrice] = useState(String(offer.priceCents / 100));
  const [delta, setDelta] = useState('');

  function savePrice() {
    const pesos = Number(price.replace(',', '.'));
    if (pesos > 0 && Math.round(pesos * 100) !== offer.priceCents) onChange({ priceCents: Math.round(pesos * 100) });
  }

  function adjustStock(sign: 1 | -1) {
    const units = Number(delta);
    if (Number.isInteger(units) && units > 0) onChange({ stockDelta: sign * units });
    setDelta('');
  }

  return (
    <section className={offer.isAvailable ? 'card' : 'card unavailable'}>
      <div className="page-header">
        <h2>{offer.name}</h2>
        <label className="toggle">
          <input type="checkbox" checked={offer.isAvailable} onChange={(e) => onChange({ isAvailable: e.target.checked })} />
          Disponible
        </label>
      </div>

      <div className="field-row">
        <label>
          Precio ($)
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} onBlur={savePrice} />
        </label>
        <span className="muted">{formatPrice(offer.priceCents)}</span>
      </div>

      {offer.stock === null ? (
        <p className="muted">Sin control de stock</p>
      ) : (
        <div className="field-row">
          <span>
            Stock: <strong>{offer.stock}</strong>
          </span>
          <input
            className="small-input"
            inputMode="numeric"
            placeholder="Unidades"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
          />
          <button className="small-button" onClick={() => adjustStock(1)} aria-label="Sumar al stock">
            +
          </button>
          <button className="small-button" onClick={() => adjustStock(-1)} aria-label="Restar del stock">
            −
          </button>
        </div>
      )}
    </section>
  );
}
