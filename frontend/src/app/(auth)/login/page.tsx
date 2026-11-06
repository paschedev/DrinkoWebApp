'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api, ApiError } from '@/lib/api';

// Ingreso de organizadores y staff.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api('/auth/login', { method: 'POST', body: { email, password } });
      router.push('/bar');
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
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={sending}>
          {sending ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </main>
  );
}
