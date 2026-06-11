import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ExecutionsController } from './executions.controller';
import { ExecutionsService } from './executions.service';
import {
  ActionExecutor,
  ConditionExecutor,
  DelayExecutor,
  EmailExecutor,
  HTTP_FETCH,
  SmsExecutor,
  TriggerExecutor,
  WebhookExecutor,
} from './engine/executors';
import { NodeExecutorRegistry } from './engine/node-executor.registry';
import { WorkflowEngine } from './engine/workflow-engine';
import {
  EMAIL_TRANSPORT,
  MockEmailTransport,
  MockSmsTransport,
  SMS_TRANSPORT,
} from './engine/transports';

@Module({
  imports: [ActivityModule, RealtimeModule],
  controllers: [ExecutionsController],
  providers: [
    ExecutionsService,
    WorkflowEngine,
    NodeExecutorRegistry,
    TriggerExecutor,
    ConditionExecutor,
    ActionExecutor,
    DelayExecutor,
    WebhookExecutor,
    EmailExecutor,
    SmsExecutor,
    // Real HTTP for webhooks (overridable in tests).
    { provide: HTTP_FETCH, useValue: globalThis.fetch?.bind(globalThis) },
    // Default transports — bind real providers (SMTP/Twilio/…) here in production.
    { provide: EMAIL_TRANSPORT, useClass: MockEmailTransport },
    { provide: SMS_TRANSPORT, useClass: MockSmsTransport },
  ],
})
export class ExecutionsModule {}
