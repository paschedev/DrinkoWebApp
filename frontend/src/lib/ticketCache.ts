import type { Ticket } from '@/types/api';

// Copia local de los tickets: si en el evento se corta la señal, el cliente
// igual puede mostrar su QR. El canje lo valida siempre el servidor.

const KEY = 'drinko-tickets';

export function saveTickets(tickets: Ticket[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(tickets));
  } catch {
    // Sin almacenamiento disponible no hay copia, pero la página funciona igual.
  }
}

export function loadTickets(): Ticket[] | null {
  try {
    const saved = localStorage.getItem(KEY);
    return saved ? (JSON.parse(saved) as Ticket[]) : null;
  } catch {
    return null;
  }
}
