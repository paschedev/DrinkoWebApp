'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MAX_PER_TICKET, useCart } from '@/hooks/useCart';
import { api, ApiError } from '@/lib/api';
import { formatPrice, formatTime } from '@/lib/format';
import type { Catalog, CatalogProduct } from '@/types/api';

export default function CatalogPage() {
  const { code } = useParams<{ code: string }>();
  const cart = useCart(code);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Catalog>(`/events/${code}`)
      .then(setCatalog)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'No se pudo cargar el evento'));
  }, [code]);

  if (error) {
    return (
      <main className="page">
        <h1>Ups</h1>
        <p>{error}</p>
      </main>
    );
  }
  if (!catalog) return <main className="page">Cargando...</main>;

  if (catalog.status === 'SCHEDULED') {
    return (
      <main className="page">
        <h1>{catalog.name}</h1>
        <p>El evento todavía no empezó. Empieza el {formatTime(catalog.startsAt)}</p>
      </main>
    );
  }
  if (catalog.status === 'FINISHED') {
    return (
      <main className="page">
        <h1>{catalog.name}</h1>
        <p>El evento terminó. Ya no se pueden hacer compras.</p>
        <Link href="/tickets">Ver mis tickets</Link>
      </main>
    );
  }

  const canAdd = (product: CatalogProduct) =>
    !product.soldOut &&
    cart.quantityIn(cart.active, product.eventProductId) < MAX_PER_TICKET &&
    (product.stock === null || cart.totalFor(product.eventProductId) < product.stock);

  return (
    <main className="page with-bar">
      <header className="page-header">
        <h1>{catalog.name}</h1>
        <Link href="/tickets">Mis tickets</Link>
      </header>
      {cart.tickets.length > 1 && <p className="hint">Agregando al Ticket {cart.active + 1}</p>}

      {catalog.categories.map((category) => (
        <section key={category.name}>
          <h2>{category.name}</h2>
          <ul className="list">
            {category.products.map((product) => {
              const quantity = cart.quantityIn(cart.active, product.eventProductId);
              const info = { eventProductId: product.eventProductId, name: product.name, priceCents: product.priceCents };
              return (
                <li key={product.eventProductId} className={product.soldOut ? 'row sold-out' : 'row'}>
                  <div>
                    <strong>{product.name}</strong>
                    <div className="muted">{product.soldOut ? 'Agotado' : formatPrice(product.priceCents)}</div>
                  </div>
                  {!product.soldOut && (
                    <div className="stepper">
                      <button onClick={() => cart.changeQuantity(cart.active, info, -1)} disabled={quantity === 0} aria-label="Quitar uno">
                        −
                      </button>
                      <span>{quantity}</span>
                      <button onClick={() => cart.changeQuantity(cart.active, info, 1)} disabled={!canAdd(product)} aria-label="Agregar uno">
                        +
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {cart.itemCount > 0 && (
        <Link href={`/e/${code}/cart`} className="bottom-bar">
          Ver carrito ({cart.itemCount}) · {formatPrice(cart.totalCents)}
        </Link>
      )}
    </main>
  );
}
