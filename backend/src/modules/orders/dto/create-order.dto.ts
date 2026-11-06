import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemDto {
  @IsUUID()
  eventProductId: string;

  // Hasta 10 unidades por producto en cada ticket.
  @IsInt()
  @Min(1)
  @Max(10)
  quantity: number;
}

export class OrderTicketDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

export class CreateOrderDto {
  // La genera el frontend: si el pedido se reenvía, no se crea dos veces.
  @IsUUID()
  idempotencyKey: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => OrderTicketDto)
  tickets: OrderTicketDto[];
}
