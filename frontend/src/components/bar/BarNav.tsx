'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BarNav({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/bar/${eventId}/scan`, label: 'Escanear' },
    { href: `/bar/${eventId}/products`, label: 'Productos' },
    { href: `/bar/${eventId}/demand`, label: 'Por entregar' },
  ];
  return (
    <nav className="tabs">
      <Link href="/bar" aria-label="Volver a mis eventos">
        ←
      </Link>
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} className={pathname === tab.href ? 'active' : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
