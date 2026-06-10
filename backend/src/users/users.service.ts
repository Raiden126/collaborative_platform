import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { permissions: true } } },
    });
  }

  findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { permissions: true } } },
    });
  }

  /** Resolves a flattened AuthUser (roles + de-duplicated permissions). */
  async findAuthUserById(id: number): Promise<AuthUser | null> {
    const user = await this.findById(id);
    if (!user || !user.isActive) return null;
    return this.toAuthUser(user);
  }

  toAuthUser(user: NonNullable<Awaited<ReturnType<UsersService['findById']>>>): AuthUser {
    const permissions = new Set<string>();
    for (const role of user.roles) {
      for (const perm of role.permissions) permissions.add(perm.key);
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles.map((r) => r.name),
      permissions: [...permissions],
    };
  }
}
