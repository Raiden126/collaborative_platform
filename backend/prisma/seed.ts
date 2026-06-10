import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Canonical permission catalogue. Extend freely — the UI reads these dynamically.
const PERMISSIONS = [
  'workflow.create',
  'workflow.view',
  'workflow.edit',
  'workflow.delete',
  'workflow.duplicate',
  'workflow.publish',
  'workflow.execute',
  'analytics.view',
  'user.manage',
];

async function main() {
  // Permissions
  const permissions = await Promise.all(
    PERMISSIONS.map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, description: key.replace('.', ' ') },
      }),
    ),
  );
  const byKey = Object.fromEntries(permissions.map((p) => [p.key, p]));

  // Roles
  const admin = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Full access',
      permissions: { connect: permissions.map((p) => ({ id: p.id })) },
    },
  });

  const editor = await prisma.role.upsert({
    where: { name: 'editor' },
    update: {},
    create: {
      name: 'editor',
      description: 'Can build and run workflows but not publish or manage users',
      permissions: {
        connect: [
          'workflow.create',
          'workflow.view',
          'workflow.edit',
          'workflow.duplicate',
          'workflow.execute',
          'analytics.view',
        ].map((k) => ({ id: byKey[k].id })),
      },
    },
  });

  const viewer = await prisma.role.upsert({
    where: { name: 'viewer' },
    update: {},
    create: {
      name: 'viewer',
      description: 'Read-only access',
      permissions: {
        connect: ['workflow.view', 'analytics.view'].map((k) => ({ id: byKey[k].id })),
      },
    },
  });

  // Users
  const pw = await bcrypt.hash('password123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@cwb.dev' },
    update: {},
    create: {
      email: 'admin@cwb.dev',
      name: 'Ada Admin',
      password: pw,
      roles: { connect: [{ id: admin.id }] },
    },
  });
  await prisma.user.upsert({
    where: { email: 'editor@cwb.dev' },
    update: {},
    create: {
      email: 'editor@cwb.dev',
      name: 'Eddie Editor',
      password: pw,
      roles: { connect: [{ id: editor.id }] },
    },
  });
  await prisma.user.upsert({
    where: { email: 'viewer@cwb.dev' },
    update: {},
    create: {
      email: 'viewer@cwb.dev',
      name: 'Vera Viewer',
      password: pw,
      roles: { connect: [{ id: viewer.id }] },
    },
  });

  console.log('Seed complete. Logins (password: password123):');
  console.log('  admin@cwb.dev | editor@cwb.dev | viewer@cwb.dev');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
