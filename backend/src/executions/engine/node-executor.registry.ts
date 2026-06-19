import { Injectable } from '@nestjs/common';
import {
  ActionExecutor,
  ConditionExecutor,
  DelayExecutor,
  EmailExecutor,
  SmsExecutor,
  TriggerExecutor,
  WebhookExecutor,
} from './executors';
import { SlackExecutor } from './slack.executor';
import { NodeExecutor } from './types';

@Injectable()
export class NodeExecutorRegistry {
  private readonly executors = new Map<string, NodeExecutor>();

  constructor(
    trigger: TriggerExecutor,
    condition: ConditionExecutor,
    action: ActionExecutor,
    delay: DelayExecutor,
    webhook: WebhookExecutor,
    email: EmailExecutor,
    sms: SmsExecutor,
    slack: SlackExecutor,
  ) {
    [trigger, condition, action, delay, webhook, email, sms, slack].forEach((e) =>
      this.register(e),
    );
  }

  register(executor: NodeExecutor) {
    this.executors.set(executor.type, executor);
  }

  get(type: string): NodeExecutor | undefined {
    return this.executors.get(type);
  }
}