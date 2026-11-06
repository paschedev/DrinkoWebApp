'use client';

import { useEffect, useRef, useState } from 'react';

const ELEMENT_ID = 'qr-reader';

// Lee QR con la cámara trasera del celular. Mientras `paused` es true ignora las lecturas,
// así un mismo QR frente a la cámara no se envía varias veces.
export function QrScanner({ onScan, paused }: { onScan: (text: string) => void; paused: boolean }) {
  const onScanRef = useRef(onScan);
  const pausedRef = useRef(paused);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
    pausedRef.current = paused;
  }, [onScan, paused]);

  useEffect(() => {
    let stopped = false;
    let scanner: import('html5-qrcode').Html5Qrcode | null = null;

    // Se importa acá porque la librería usa el navegador apenas se carga.
    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (stopped) return;
      scanner = new Html5Qrcode(ELEMENT_ID);
      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 240 },
          (text) => {
            if (!pausedRef.current) onScanRef.current(text);
          },
          () => {},
        )
        .catch(() => setError('No se pudo abrir la cámara. Revisá los permisos o ingresá el código a mano.'));
    });

    return () => {
      stopped = true;
      if (scanner?.isScanning) scanner.stop().catch(() => {});
    };
  }, []);

  return (
    <div>
      <div id={ELEMENT_ID} className="scanner" />
      {error && <p className="error">{error}</p>}
    </div>
  );
}
