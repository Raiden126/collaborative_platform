import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  SMS_TRANSPORT,
  createEmailTransport,
  createSmsTransport,
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
    // Real SMTP / Twilio when configured (env), safe mock otherwise.
    { provide: EMAIL_TRANSPORT, useFactory: createEmailTransport, inject: [ConfigService] },
    { provide: SMS_TRANSPORT, useFactory: createSmsTransport, inject: [ConfigService] },
  ],
})
export class ExecutionsModule {}
