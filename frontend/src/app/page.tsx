import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="home">
      <h1>Drinko</h1>
      <p>Pedí y pagá desde el celular, y retirá en la barra con tu QR.</p>
      <p>Para ver el catálogo, escaneá el QR de acceso del evento.</p>
      <nav className="home-links">
        <Link href="/tickets">Mis tickets</Link>
        <Link href="/login">Ingresar (personal de barra)</Link>
      </nav>
    </main>
  );
}
