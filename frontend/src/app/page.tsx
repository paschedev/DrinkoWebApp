import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="home">
      <h1 className="brand-title">Drinko</h1>
      <p>Pedí y pagá desde el celular, y retirá en la barra con tu QR.</p>
      <ol className="card steps">
        <li>Escaneá el QR de acceso del evento.</li>
        <li>Elegí tus bebidas y pagá desde el celular.</li>
        <li>Mostrá el QR de tu ticket en la barra y retirá.</li>
      </ol>
      <nav className="home-links">
        <Link href="/tickets" className="button-link">
          Mis tickets
        </Link>
        <Link href="/login" className="link-button">
          Ingresar (personal de barra)
        </Link>
      </nav>
    </main>
  );
}
