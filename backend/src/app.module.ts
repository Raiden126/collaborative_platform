import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ActivityModule } from './activity/activity.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { JwtAccessGuard } from './auth/guards/jwt-access.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { EventsModule } from './events/events.module';
import { ExecutionsModule } from './executions/executions.module';
import { HealthController } from './health.controller';
import { PermissionsModule } from './permissions/permissions.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { UsersModule } from './users/users.module';
import { WorkflowsModule } from './workflows/workflows.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
    PermissionsModule,
    RealtimeModule,
    EventsModule,
    ActivityModule,
    WorkflowsModule,
    ExecutionsModule,
    AnalyticsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Protect every route by default; opt out with @Public().
    { provide: APP_GUARD, useClass: JwtAccessGuard },
    // Enforce @RequirePermissions(...) globally.
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
