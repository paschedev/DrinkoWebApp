import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/auth-user';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

// Catálogo maestro de la productora. Todas las consultas se filtran por la
// organización del usuario: un organizador nunca ve ni toca productos de otra.
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listCategories(user: AuthUser) {
    return this.prisma.category.findMany({
      where: { organizationId: user.organizationId! },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    });
  }

  async listProducts(user: AuthUser) {
    const products = await this.prisma.product.findMany({
      where: { organizationId: user.organizationId! },
      include: { category: true },
      orderBy: [{ isArchived: 'asc' }, { name: 'asc' }],
    });
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      requiresPreparation: p.requiresPreparation,
      isArchived: p.isArchived,
      category: p.category ? { id: p.category.id, name: p.category.name } : null,
    }));
  }

  async createProduct(user: AuthUser, input: CreateProductDto) {
    await this.assertCategory(user, input.categoryId);
    try {
      const product = await this.prisma.product.create({
        data: {
          organizationId: user.organizationId!,
          name: input.name,
          categoryId: input.categoryId,
          description: input.description,
          imageUrl: input.imageUrl,
          requiresPreparation: input.requiresPreparation ?? false,
        },
      });
      return { id: product.id };
    } catch (error) {
      throw this.duplicateName(error);
    }
  }

  async updateProduct(user: AuthUser, productId: string, input: UpdateProductDto) {
    await this.findOwnProduct(user, productId);
    await this.assertCategory(user, input.categoryId);
    try {
      await this.prisma.product.update({
        where: { id: productId },
        data: {
          name: input.name,
          categoryId: input.categoryId,
          description: input.description,
          imageUrl: input.imageUrl,
          requiresPreparation: input.requiresPreparation,
          isArchived: input.isArchived,
        },
      });
      return { id: productId };
    } catch (error) {
      throw this.duplicateName(error);
    }
  }

  // Solo se borra un producto que nunca se ofreció en un evento; si no, se archiva.
  async deleteProduct(user: AuthUser, productId: string) {
    await this.findOwnProduct(user, productId);
    const offered = await this.prisma.eventProduct.count({ where: { productId } });
    if (offered > 0) {
      throw new ConflictException('El producto ya se ofreció en un evento: archivalo en lugar de borrarlo');
    }
    await this.prisma.product.delete({ where: { id: productId } });
  }

  private async findOwnProduct(user: AuthUser, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: user.organizationId! },
    });
    if (!product) throw new NotFoundException('El producto no existe');
    return product;
  }

  private async assertCategory(user: AuthUser, categoryId?: string) {
    if (!categoryId) return;
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, organizationId: user.organizationId! },
    });
    if (!category) throw new BadRequestException('La categoría no existe');
  }

  private duplicateName(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException('Ya tenés un producto con ese nombre');
    }
    return error;
  }
}
