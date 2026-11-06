import { IsBoolean, IsInt, IsOptional, Max, Min, NotEquals } from 'class-validator';

export class UpdateOfferDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  priceCents?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  // El stock se ajusta sumando o restando unidades (por ejemplo, +24 al reponer).
  // Reemplazar el valor por uno leído antes pisaría las reservas hechas mientras tanto.
  @IsOptional()
  @IsInt()
  @Min(-10_000)
  @Max(10_000)
  @NotEquals(0)
  stockDelta?: number;
}
