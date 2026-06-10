import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Full permission catalogue — lets admin UIs build role editors dynamically. */
  @Get()
  findAll() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
  }

  @Get('roles')
  roles() {
    return this.prisma.role.findMany({ include: { permissions: true } });
  }
}
