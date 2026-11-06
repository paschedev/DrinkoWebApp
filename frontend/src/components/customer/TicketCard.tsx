import { QRCodeSVG } from 'qrcode.react';
import { formatPrice, formatTime } from '@/lib/format';
import type { Ticket } from '@/types/api';

const STATUS_LABEL: Record<Ticket['status'], string> = {
  PENDING: 'Pendiente de pago',
  ACTIVE: 'Listo para retirar',
  REDEEMED: 'Retirado',
  EXPIRED: 'Vencido',
};

export function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <section className="card">
      <div className="page-header">
        <h2>Ticket #{ticket.number}</h2>
        <span className={`badge ${ticket.status.toLowerCase()}`}>{STATUS_LABEL[ticket.status]}</span>
      </div>
      <p className="muted">{ticket.eventName}</p>
      <ul className="plain">
        {ticket.items.map((item) => (
          <li key={item.productName}>
            {item.quantity} × {item.productName} · {formatPrice(item.unitPriceCents * item.quantity)}
          </li>
        ))}
      </ul>
      {/* Un ticket retirado o vencido no muestra el QR (el backend no manda el token). */}
      {ticket.token && (
        <>
          <div className="qr">
            <QRCodeSVG value={ticket.token} size={220} marginSize={2} />
          </div>
          <p className="muted">Mostrá este QR en la barra.</p>
          <p className="muted">Se puede retirar hasta el {formatTime(ticket.redeemableUntil)}</p>
        </>
      )}
      {ticket.redeemedAt && <p className="muted">Retirado el {formatTime(ticket.redeemedAt)}</p>}
    </section>
  );
}
