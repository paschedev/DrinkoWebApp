'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

// Navegación del Panel del Organizador.
export function PanelHeader() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/login');
  }

  const tabs = [
    { href: '/panel', label: 'Eventos', active: pathname === '/panel' || pathname.startsWith('/panel/events') },
    { href: '/panel/catalog', label: 'Productos', active: pathname.startsWith('/panel/catalog') },
    { href: '/bar', label: 'Barra', active: false },
  ];

  return (
    <header className="bar-header">
      <div className="bar-top">
        <span className="brand">Drinko · Panel</span>
        <button className="link-button" onClick={logout}>
          Salir
        </button>
      </div>
      <nav className="tabs">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className={tab.active ? 'active' : undefined}>
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
