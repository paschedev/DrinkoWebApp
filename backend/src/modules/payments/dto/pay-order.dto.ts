import { IsBoolean } from 'class-validator';

// Pago simulado: el cliente elige si el pago se aprueba o se rechaza.
export class PayOrderDto {
  @IsBoolean()
  approved: boolean;
}
