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
import { NodeExecutor } from './types';

/**
 * Registry mapping node `type` → executor. This is the backend counterpart of the
 * frontend node registry and the seam for the plugin architecture (feature 20):
 * external code can `register()` new executors without touching the engine.
 */
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
  ) {
    [trigger, condition, action, delay, webhook, email, sms].forEach((e) => this.register(e));
  }

  register(executor: NodeExecutor) {
    this.executors.set(executor.type, executor);
  }

  get(type: string): NodeExecutor | undefined {
    return this.executors.get(type);
  }
}
