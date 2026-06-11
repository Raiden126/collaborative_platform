import { WorkflowConnection, WorkflowGraph, WorkflowNode } from '@cwb/shared';
import {
  ActionExecutor,
  ConditionExecutor,
  DelayExecutor,
  EmailExecutor,
  FetchFn,
  SmsExecutor,
  TriggerExecutor,
  WebhookExecutor,
} from './executors';
import { NodeExecutorRegistry } from './node-executor.registry';
import { MockEmailTransport, MockSmsTransport } from './transports';
import { WorkflowEngine } from './workflow-engine';

// --- test helpers ----------------------------------------------------------
const node = (id: string, type: string, data: Record<string, unknown> = {}): WorkflowNode => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data,
});
const edge = (
  id: string,
  source: string,
  target: string,
  sourceHandle?: string,
): WorkflowConnection => ({ id, source, target, sourceHandle });

function buildEngine(fetchFn?: FetchFn) {
  const registry = new NodeExecutorRegistry(
    new TriggerExecutor(),
    new ConditionExecutor(),
    new ActionExecutor(),
    new DelayExecutor(),
    new WebhookExecutor(fetchFn ?? (jest.fn() as unknown as FetchFn)),
    new EmailExecutor(new MockEmailTransport()),
    new SmsExecutor(new MockSmsTransport()),
  );
  return new WorkflowEngine(registry);
}

const status = (steps: { nodeId: string; status: string }[], id: string) =>
  steps.find((s) => s.nodeId === id)?.status;

describe('WorkflowEngine', () => {
  it('runs a linear flow and threads trigger data into an email', async () => {
    const engine = buildEngine();
    const graph: WorkflowGraph = {
      nodes: [
        node('t', 'trigger'),
        node('e', 'email', { to: '{{trigger.email}}', subject: 'Hi {{trigger.name}}' }),
      ],
      connections: [edge('c1', 't', 'e')],
    };
    const res = await engine.run(graph, { trigger: { email: 'x@y.com', name: 'Sam' } });
    expect(res.status).toBe('SUCCESS');
    expect(status(res.steps, 'e')).toBe('success');
    expect((res.outputs.e as any).accepted).toEqual(['x@y.com']);
  });

  it('follows the TRUE branch and skips the false branch', async () => {
    const engine = buildEngine();
    const graph: WorkflowGraph = {
      nodes: [
        node('t', 'trigger'),
        node('cond', 'condition', { expression: '{{trigger.amount}} > 100' }),
        node('hi', 'email', { to: 'big@spender.com' }),
        node('lo', 'sms', { to: '+15551234567' }),
      ],
      connections: [
        edge('c1', 't', 'cond'),
        edge('c2', 'cond', 'hi', 'true'),
        edge('c3', 'cond', 'lo', 'false'),
      ],
    };
    const res = await engine.run(graph, { trigger: { amount: 150 } });
    expect(status(res.steps, 'hi')).toBe('success');
    expect(status(res.steps, 'lo')).toBe('skipped');
    expect((res.outputs.cond as any).result).toBe(true);
  });

  it('follows the FALSE branch when the condition fails', async () => {
    const engine = buildEngine();
    const graph: WorkflowGraph = {
      nodes: [
        node('t', 'trigger'),
        node('cond', 'condition', { expression: '{{trigger.amount}} > 100' }),
        node('hi', 'email', { to: 'big@spender.com' }),
        node('lo', 'sms', { to: '+15551234567' }),
      ],
      connections: [
        edge('c1', 't', 'cond'),
        edge('c2', 'cond', 'hi', 'true'),
        edge('c3', 'cond', 'lo', 'false'),
      ],
    };
    const res = await engine.run(graph, { trigger: { amount: 50 } });
    expect(status(res.steps, 'hi')).toBe('skipped');
    expect(status(res.steps, 'lo')).toBe('success');
  });

  it('marks a node failed and skips everything downstream', async () => {
    const engine = buildEngine();
    const graph: WorkflowGraph = {
      nodes: [
        node('t', 'trigger'),
        node('bad', 'email', { to: 'not-an-email' }), // invalid → transport throws
        node('after', 'action', { name: 'cleanup' }),
      ],
      connections: [edge('c1', 't', 'bad'), edge('c2', 'bad', 'after')],
    };
    const res = await engine.run(graph);
    expect(res.status).toBe('FAILED');
    expect(status(res.steps, 'bad')).toBe('failed');
    expect(status(res.steps, 'after')).toBe('skipped');
  });

  it('performs a real HTTP call via the injected fetch and captures the response', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({ id: 42 }),
    }) as unknown as FetchFn;
    const engine = buildEngine(fetchMock);
    const graph: WorkflowGraph = {
      nodes: [
        node('t', 'trigger'),
        node('w', 'webhook', { url: 'https://api.test/{{trigger.id}}', method: 'POST', body: '{}' }),
      ],
      connections: [edge('c1', 't', 'w')],
    };
    const res = await engine.run(graph, { trigger: { id: 7 } });
    expect(fetchMock).toHaveBeenCalledWith('https://api.test/7', expect.objectContaining({ method: 'POST' }));
    expect(status(res.steps, 'w')).toBe('success');
    expect((res.outputs.w as any).body).toEqual({ id: 42 });
  });

  it('fails the webhook node on a non-2xx response', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: async () => 'boom',
    }) as unknown as FetchFn;
    const engine = buildEngine(fetchMock);
    const graph: WorkflowGraph = {
      nodes: [node('w', 'webhook', { url: 'https://api.test', method: 'GET' })],
      connections: [],
    };
    const res = await engine.run(graph);
    expect(res.status).toBe('FAILED');
    expect(status(res.steps, 'w')).toBe('failed');
  });
});
