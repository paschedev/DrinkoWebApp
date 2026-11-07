import Link from 'next/link';

// Encabezado común del cliente: desde cualquier pantalla se vuelve al catálogo
// del evento o se va a "Mis tickets".
export function CustomerHeader({
  eventCode,
  current,
}: {
  eventCode?: string;
  current?: 'catalog' | 'tickets';
}) {
  return (
    <header className="site-header">
      <Link href={eventCode ? `/e/${eventCode}` : '/'} className="brand">
        Drinko
      </Link>
      <nav className="site-nav">
        {eventCode && current !== 'catalog' && <Link href={`/e/${eventCode}`}>Catálogo</Link>}
        {current !== 'tickets' && <Link href="/tickets">Mis tickets</Link>}
      </nav>
    </header>
  );
}
