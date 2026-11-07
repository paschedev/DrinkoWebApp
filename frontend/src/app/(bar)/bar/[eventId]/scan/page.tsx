'use client';

import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useState } from 'react';
import { QrScanner } from '@/components/bar/QrScanner';
import { useStaffRequest } from '@/hooks/useStaffRequest';
import { ApiError } from '@/lib/api';
import type { RedeemedTicket } from '@/types/staff';

type Result = { ok: true; ticket: RedeemedTicket } | { ok: false; message: string };

// Canje: al leer el QR el ticket queda retirado. El resultado se muestra grande,
// en verde o en rojo, porque en la barra hay ruido y poca luz.
export default function ScanPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const request = useStaffRequest();
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [manualToken, setManualToken] = useState('');

  const redeem = useCallback(
    async (token: string) => {
      setBusy(true);
      try {
        const ticket = await request<RedeemedTicket>(`/staff/events/${eventId}/redemptions`, {
          method: 'POST',
          body: { token },
        });
        setResult({ ok: true, ticket });
        navigator.vibrate?.(150);
      } catch (e) {
        // Sin respuesta no se sabe si el canje llegó: volver a escanear lo aclara,
        // porque un ticket ya canjeado responde "ya fue retirado".
        const message =
          e instanceof ApiError && e.isNetworkError
            ? 'Sin conexión: no sabemos si se canjeó. Volvé a escanear el QR.'
            : e instanceof ApiError
              ? e.message
              : 'No se pudo canjear';
        setResult({ ok: false, message });
        navigator.vibrate?.([100, 60, 100, 60, 100]);
      }
      setBusy(false);
    },
    [eventId, request],
  );

  function submitManual(event: FormEvent) {
    event.preventDefault();
    if (manualToken.trim()) redeem(manualToken.trim());
    setManualToken('');
  }

  return (
    <main className="page">
      {result ? (
        <section className={result.ok ? 'result ok' : 'result fail'}>
          {result.ok ? (
            <>
              <p className="result-title">Entregar ticket #{result.ticket.number}</p>
              <ul className="plain result-items">
                {result.ticket.items.map((item) => (
                  <li key={item.productName}>
                    {item.quantity} × {item.productName}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="result-title">{result.message}</p>
          )}
          <button className="secondary" onClick={() => setResult(null)}>
            Escanear otro
          </button>
        </section>
      ) : (
        <>
          <QrScanner onScan={redeem} paused={busy || result !== null} />
          {busy && <p>Canjeando...</p>}
        </>
      )}

      <form onSubmit={submitManual} className="form">
        <label>
          Código del QR (si la cámara no lo lee)
          <input value={manualToken} onChange={(e) => setManualToken(e.target.value)} autoComplete="off" />
        </label>
        <button className="secondary" disabled={busy}>
          Canjear
        </button>
      </form>
    </main>
  );
}
