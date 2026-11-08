import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrganizerGuard } from '../auth/organizer.guard';
import { CatalogService } from './catalog.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@Controller('organizer')
@UseGuards(OrganizerGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories(@CurrentUser() user: AuthUser) {
    return this.catalog.listCategories(user);
  }

  @Get('products')
  list(@CurrentUser() user: AuthUser) {
    return this.catalog.listProducts(user);
  }

  @Post('products')
  create(@CurrentUser() user: AuthUser, @Body() body: CreateProductDto) {
    return this.catalog.createProduct(user, body);
  }

  @Patch('products/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateProductDto) {
    return this.catalog.updateProduct(user, id, body);
  }

  @Delete('products/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.deleteProduct(user, id);
  }
}
