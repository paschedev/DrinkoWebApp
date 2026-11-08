import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUrl, IsUUID, Length, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateProductDto {
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  name: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  requiresPreparation?: boolean;
}

export class UpdateProductDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  requiresPreparation?: boolean;

  // Archivar oculta el producto del catálogo sin borrar lo que ya se vendió.
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
