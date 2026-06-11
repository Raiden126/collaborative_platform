import { Inject, Injectable } from '@nestjs/common';
import { WorkflowNode } from '@cwb/shared';
import { evaluateCondition, interpolateData } from './expression';
import {
  EMAIL_TRANSPORT,
  EmailTransport,
  SMS_TRANSPORT,
  SmsTransport,
} from './transports';
import { NodeExecutionError, NodeExecutor, NodeOutcome, RunContext } from './types';

/** Injectable fetch, so the webhook executor can be unit-tested with a stub. */
export const HTTP_FETCH = Symbol('HTTP_FETCH');
export type FetchFn = typeof fetch;

const num = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Trigger: the entry node. Emits the run's trigger payload merged with its config. */
@Injectable()
export class TriggerExecutor implements NodeExecutor {
  readonly type = 'trigger';
  execute(node: WorkflowNode, ctx: RunContext): NodeOutcome {
    return { output: { event: node.data?.event ?? 'manual', ...ctx.trigger } };
  }
}

/** Condition: evaluates an expression and follows the matching true/false branch. */
@Injectable()
export class ConditionExecutor implements NodeExecutor {
  readonly type = 'condition';
  execute(node: WorkflowNode, ctx: RunContext): NodeOutcome {
    const result = evaluateCondition(node.data?.expression as string | undefined, ctx);
    return { output: { result }, activate: [result ? 'true' : 'false'] };
  }
}

/** Action: a generic step. Honors a `_fail` flag for demoing failure paths. */
@Injectable()
export class ActionExecutor implements NodeExecutor {
  readonly type = 'action';
  execute(node: WorkflowNode, ctx: RunContext): NodeOutcome {
    const data = interpolateData(node.data ?? {}, ctx);
    if (data._fail) throw new NodeExecutionError(String(data._error ?? 'Action failed'));
    return { output: { action: data.name ?? 'action', status: 'done', data } };
  }
}

/** Delay: waits in live mode (capped); in simulate mode just records the intended wait. */
@Injectable()
export class DelayExecutor implements NodeExecutor {
  readonly type = 'delay';
  private static readonly MAX_LIVE_WAIT_MS = 5000;
  async execute(node: WorkflowNode, ctx: RunContext): Promise<NodeOutcome> {
    const ms = num(node.data?.seconds, 0) * 1000;
    if (ctx.mode === 'live' && ms > 0) {
      await new Promise((r) => setTimeout(r, Math.min(ms, DelayExecutor.MAX_LIVE_WAIT_MS)));
      return { output: { waitedMs: Math.min(ms, DelayExecutor.MAX_LIVE_WAIT_MS) } };
    }
    return { output: { scheduledMs: ms } };
  }
}

/** Webhook: performs a real HTTP request and returns the API response (feature 11). */
@Injectable()
export class WebhookExecutor implements NodeExecutor {
  readonly type = 'webhook';
  private static readonly TIMEOUT_MS = 10000;
  constructor(@Inject(HTTP_FETCH) private readonly fetchFn: FetchFn) {}

  async execute(node: WorkflowNode, ctx: RunContext): Promise<NodeOutcome> {
    const data = interpolateData(node.data ?? {}, ctx);
    const url = String(data.url ?? '').trim();
    if (!url) throw new NodeExecutionError('Webhook URL is required');
    const method = String(data.method ?? 'POST').toUpperCase();

    let headers: Record<string, string> = { 'content-type': 'application/json' };
    if (data.headers && typeof data.headers === 'object') {
      headers = { ...headers, ...(data.headers as Record<string, string>) };
    }
    const hasBody = method !== 'GET' && method !== 'HEAD';
    const body = hasBody
      ? typeof data.body === 'string'
        ? data.body
        : JSON.stringify(data.body ?? ctx.outputs)
      : undefined;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WebhookExecutor.TIMEOUT_MS);
    try {
      const res = await this.fetchFn(url, { method, headers, body, signal: controller.signal });
      const text = await res.text();
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        /* keep raw text */
      }
      const output = {
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        // Cap body size so the debugger payload stays manageable.
        body: typeof parsed === 'string' ? parsed.slice(0, 4000) : parsed,
      };
      if (!res.ok && data.failOnErrorStatus !== false) {
        throw new NodeExecutionError(`HTTP ${res.status} ${res.statusText}`, output);
      }
      return { output };
    } catch (err) {
      if (err instanceof NodeExecutionError) throw err;
      const e = err as Error;
      const reason = e.name === 'AbortError' ? 'Request timed out' : e.message;
      throw new NodeExecutionError(`Webhook request failed: ${reason}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Email: delivers through the configured EmailTransport. */
@Injectable()
export class EmailExecutor implements NodeExecutor {
  readonly type = 'email';
  constructor(@Inject(EMAIL_TRANSPORT) private readonly transport: EmailTransport) {}
  async execute(node: WorkflowNode, ctx: RunContext): Promise<NodeOutcome> {
    const data = interpolateData(node.data ?? {}, ctx);
    try {
      const result = await this.transport.send({
        to: String(data.to ?? ''),
        subject: data.subject as string | undefined,
        body: data.body as string | undefined,
      });
      return { output: result };
    } catch (err) {
      throw new NodeExecutionError((err as Error).message);
    }
  }
}

/** SMS: delivers through the configured SmsTransport. */
@Injectable()
export class SmsExecutor implements NodeExecutor {
  readonly type = 'sms';
  constructor(@Inject(SMS_TRANSPORT) private readonly transport: SmsTransport) {}
  async execute(node: WorkflowNode, ctx: RunContext): Promise<NodeOutcome> {
    const data = interpolateData(node.data ?? {}, ctx);
    try {
      const result = await this.transport.send({
        to: String(data.to ?? ''),
        message: data.message as string | undefined,
      });
      return { output: result };
    } catch (err) {
      throw new NodeExecutionError((err as Error).message);
    }
  }
}
