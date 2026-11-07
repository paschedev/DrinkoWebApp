import { addTicketToStoredCart, CART_NOTICE_KEY, type CartItem } from '@/hooks/useCart';
import { api } from '@/lib/api';
import type { Catalog, Ticket } from '@/types/api';

// Copia los productos de un ticket al carrito como un ticket nuevo, con los precios de
// ahora. Los que ya no están disponibles se omiten y se avisa en el carrito.
// Devuelve la ruta del carrito.
export async function repeatPurchase(ticket: Ticket): Promise<string> {
  const catalog = await api<Catalog>(`/events/${ticket.eventCode}`);
  if (catalog.status !== 'IN_PROGRESS') throw new Error('El evento ya no está en curso.');

  const products = new Map(
    catalog.categories.flatMap((category) => category.products).map((p) => [p.eventProductId, p]),
  );
  const items: CartItem[] = [];
  const omitted: string[] = [];
  for (const item of ticket.items) {
    const product = item.eventProductId ? products.get(item.eventProductId) : undefined;
    if (!product || product.soldOut) {
      omitted.push(item.productName);
      continue;
    }
    const quantity = product.stock === null ? item.quantity : Math.min(item.quantity, product.stock);
    items.push({ eventProductId: product.eventProductId, name: product.name, priceCents: product.priceCents, quantity });
  }
  if (items.length === 0) throw new Error('Ninguno de esos productos está disponible ahora.');

  addTicketToStoredCart(ticket.eventCode, items);
  try {
    if (omitted.length > 0) {
      sessionStorage.setItem(CART_NOTICE_KEY, `No agregamos ${omitted.join(', ')} porque ahora no están disponibles.`);
    }
  } catch {
    // Sin almacenamiento no se muestra el aviso.
  }
  return `/e/${ticket.eventCode}/cart`;
}
