'use client';

import { useEffect, useState } from 'react';

// El carrito se divide en tickets: cada ticket se retira completo y de una sola vez.
// Se guarda en el navegador para no perderlo al cambiar de página.

export const MAX_PER_TICKET = 10;

export type CartItem = { eventProductId: string; name: string; priceCents: number; quantity: number };
export type CartTicket = { items: CartItem[] };
type CartState = { tickets: CartTicket[]; active: number };

const emptyCart = (): CartState => ({ tickets: [{ items: [] }], active: 0 });

export function useCart(eventCode: string) {
  const storageKey = `drinko-cart-${eventCode}`;
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
    setActive,
    clear,
    totalFor,
    quantityIn,
  };
}
