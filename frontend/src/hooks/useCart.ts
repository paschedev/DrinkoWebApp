'use client';

import { useEffect, useState } from 'react';

// El carrito se divide en tickets: cada ticket se retira completo y de una sola vez.
// Se guarda en el navegador para no perderlo al cambiar de página.

export const MAX_PER_TICKET = 10;
export const CART_NOTICE_KEY = 'drinko-cart-notice';

export type CartItem = { eventProductId: string; name: string; priceCents: number; quantity: number };
export type CartTicket = { items: CartItem[] };
type CartState = { tickets: CartTicket[]; active: number };

const emptyCart = (): CartState => ({ tickets: [{ items: [] }], active: 0 });
const storageKeyFor = (eventCode: string) => `drinko-cart-${eventCode}`;

// Divide un ticket en dos mitades. Con cantidades impares, el primero se lleva la unidad extra.
export function splitItems(items: CartItem[]): [CartItem[], CartItem[]] {
  const first = items.map((item) => ({ ...item, quantity: Math.ceil(item.quantity / 2) }));
  const second = items
    .map((item) => ({ ...item, quantity: Math.floor(item.quantity / 2) }))
    .filter((item) => item.quantity > 0);
  return [first, second];
}

// Agrega un ticket al carrito guardado de un evento (lo usa "Repetir compra").
export function addTicketToStoredCart(eventCode: string, items: CartItem[]) {
  let cart = emptyCart();
  try {
    const saved = localStorage.getItem(storageKeyFor(eventCode));
    if (saved) cart = JSON.parse(saved);
  } catch {
    // Carrito ilegible: se empieza de nuevo.
  }
  const tickets = cart.tickets.filter((ticket) => ticket.items.length > 0);
  tickets.push({ items });
  const next: CartState = { tickets, active: tickets.length - 1 };
  try {
    localStorage.setItem(storageKeyFor(eventCode), JSON.stringify(next));
  } catch {
    // Sin almacenamiento no se puede pasar el carrito a la otra pantalla.
  }
}

export function useCart(eventCode: string) {
  const storageKey = storageKeyFor(eventCode);
  const [cart, setCart] = useState<CartState>(emptyCart);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setCart(JSON.parse(saved));
    } catch {
      // Si no se puede leer, se arranca con el carrito vacío.
    }
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(cart));
    } catch {
      // Sin almacenamiento el carrito igual funciona mientras la página esté abierta.
    }
  }, [cart, loaded, storageKey]);

  function changeQuantity(ticketIndex: number, product: Omit<CartItem, 'quantity'>, delta: number) {
    setCart((prev) => {
      const tickets = prev.tickets.map((ticket, i) => {
        if (i !== ticketIndex) return ticket;
        const current = ticket.items.find((item) => item.eventProductId === product.eventProductId);
        const quantity = Math.min(MAX_PER_TICKET, (current?.quantity ?? 0) + delta);
        const others = ticket.items.filter((item) => item.eventProductId !== product.eventProductId);
        if (quantity <= 0) return { items: others };
        if (current) {
          return {
            items: ticket.items.map((item) =>
              item.eventProductId === product.eventProductId ? { ...item, quantity } : item,
            ),
          };
        }
        return { items: [...ticket.items, { ...product, quantity }] };
      });
      return { ...prev, tickets };
    });
  }

  function addTicket() {
    setCart((prev) => ({ tickets: [...prev.tickets, { items: [] }], active: prev.tickets.length }));
  }

  function removeTicket(index: number) {
    setCart((prev) => {
      const tickets = prev.tickets.filter((_, i) => i !== index);
      if (tickets.length === 0) return emptyCart();
      return { tickets, active: Math.min(prev.active, tickets.length - 1) };
    });
  }

  function duplicateTicket(index: number) {
    setCart((prev) => {
      const copy = { items: prev.tickets[index].items.map((item) => ({ ...item })) };
      const tickets = [...prev.tickets.slice(0, index + 1), copy, ...prev.tickets.slice(index + 1)];
      return { tickets, active: index + 1 };
    });
  }

  function splitTicket(index: number) {
    setCart((prev) => {
      const [first, second] = splitItems(prev.tickets[index].items);
      if (second.length === 0) return prev;
      const tickets = [...prev.tickets.slice(0, index), { items: first }, { items: second }, ...prev.tickets.slice(index + 1)];
      return { ...prev, tickets };
    });
  }

  function setActive(index: number) {
    setCart((prev) => ({ ...prev, active: index }));
  }

  function clear() {
    setCart(emptyCart());
  }

  // Cantidad de un producto sumando todos los tickets (para no superar el stock).
  function totalFor(eventProductId: string) {
    return cart.tickets
      .flatMap((ticket) => ticket.items)
      .filter((item) => item.eventProductId === eventProductId)
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  function quantityIn(ticketIndex: number, eventProductId: string) {
    return cart.tickets[ticketIndex]?.items.find((item) => item.eventProductId === eventProductId)?.quantity ?? 0;
  }

  const allItems = cart.tickets.flatMap((ticket) => ticket.items);

  return {
    loaded,
    tickets: cart.tickets,
    active: cart.active,
    itemCount: allItems.reduce((sum, item) => sum + item.quantity, 0),
    totalCents: allItems.reduce((sum, item) => sum + item.priceCents * item.quantity, 0),
    changeQuantity,
    addTicket,
    removeTicket,
    duplicateTicket,
    splitTicket,
    setActive,
    clear,
    totalFor,
    quantityIn,
  };
}
