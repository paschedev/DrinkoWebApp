'use client';

import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { QrScanner } from '@/components/bar/QrScanner';
import { Loading } from '@/components/ui/Loading';
import { useStaffRequest } from '@/hooks/useStaffRequest';
import { ApiError } from '@/lib/api';
import type { RedeemedTicket } from '@/types/staff';

type Result = { ok: true; ticket: RedeemedTicket } | { ok: false; message: string };

// El QR de retiro tiene 128 bits en base64url: 22 caracteres.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

// Acepta el código solo o el link del ticket (.../t/<código>), sin espacios.
function extractToken(input: string) {
  const text = input.trim();
  const fromLink = text.match(/\/t\/([A-Za-z0-9_-]{22})\/?$/);
  return fromLink ? fromLink[1] : text;
}

// Segundos que queda el resultado en pantalla antes de volver a la cámara.
const RESULT_SECONDS = { ok: 6, fail: 8 };

// Canje: al leer el QR el ticket queda retirado. El resultado se muestra grande,
// en verde o en rojo, porque en la barra hay ruido y poca luz.
export default function ScanPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const request = useStaffRequest();
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Después de cada canje la cámara vuelve sola, así el staff atiende al siguiente sin tocar nada.
  useEffect(() => {
    if (!result) return;
    setSecondsLeft(result.ok ? RESULT_SECONDS.ok : RESULT_SECONDS.fail);
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer);
          setResult(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [result]);

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

  const manualCode = extractToken(manualToken);
  const manualValid = TOKEN_PATTERN.test(manualCode);

  function submitManual(event: FormEvent) {
    event.preventDefault();
    if (!manualValid) return;
    redeem(manualCode);
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
          <p className="result-countdown">La cámara vuelve sola en {secondsLeft} s</p>
        </section>
      ) : (
        <>
          <QrScanner onScan={redeem} paused={busy || result !== null} />
          {busy && <Loading text="Canjeando..." />}
        </>
      )}

      <details className="manual">
        <summary>¿La cámara no lee el QR? Ingresá el código</summary>
        <form onSubmit={submitManual} className="form">
          <label>
            Código del QR
            <input
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="22 caracteres o el link del ticket"
            />
          </label>
          {manualToken.trim() !== '' && !manualValid && (
            <p className="muted">El código del QR tiene 22 caracteres (letras, números, - y _).</p>
          )}
          <button className="secondary" disabled={busy || !manualValid}>
            Canjear
          </button>
        </form>
      </details>
    </main>
  );
}
