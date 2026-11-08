'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

// Ingreso de organizadores y staff.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Si ya hay una sesión abierta, se va directo a la barra.
  useEffect(() => {
    api<{ role: string }>('/auth/me')
      .then((me) => router.replace(me.role === 'ORGANIZER' ? '/panel' : '/bar'))
      .catch(() => {});
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      // El organizador entra a su panel; el staff, a la barra.
      const user = await api<{ role: string }>('/auth/login', { method: 'POST', body: { email, password } });
      router.push(user.role === 'ORGANIZER' ? '/panel' : '/bar');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo iniciar sesión');
      setSending(false);
    }
  }

  return (
    <main className="page">
      <h1>Ingresar</h1>
      <p className="muted">Para organizadores y personal de barra.</p>
      <form onSubmit={submit} className="form">
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </label>
        <label>
          Contraseña
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        <label className="toggle">
          <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
          Mostrar contraseña
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={sending}>
          {sending ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
      <p className="center">
        <Link href="/">Volver al inicio</Link>
      </p>
    </main>
  );
}
