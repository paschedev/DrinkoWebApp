'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useStaffRequest } from '@/hooks/useStaffRequest';
import { api } from '@/lib/api';
import type { StaffEvent } from '@/types/staff';

// Navegación fija de la barra: volver a los eventos, salir y moverse entre las pantallas.
export function BarNav({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const request = useStaffRequest();
  const [eventName, setEventName] = useState('');

  useEffect(() => {
    request<StaffEvent[]>('/staff/events')
      .then((events) => setEventName(events.find((e) => e.id === eventId)?.name ?? ''))
      .catch(() => {});
  }, [eventId, request]);

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/login');
  }

  const tabs = [
    { href: `/bar/${eventId}/scan`, label: 'Escanear' },
    { href: `/bar/${eventId}/demand`, label: 'Por entregar' },
    { href: `/bar/${eventId}/products`, label: 'Productos' },
  ];

  return (
    <header className="bar-header">
      <div className="bar-top">
        <Link href="/bar">← Eventos</Link>
        <strong className="bar-event">{eventName}</strong>
        <button className="link-button" onClick={logout}>
          Salir
        </button>
      </div>
      <nav className="tabs">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className={pathname === tab.href ? 'active' : undefined}>
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
