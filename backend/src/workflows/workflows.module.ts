import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { EventsModule } from '../events/events.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';

@Module({
  imports: [ActivityModule, EventsModule, RealtimeModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
