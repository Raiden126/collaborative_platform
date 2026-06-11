import { evaluateCondition, interpolate, interpolateData, resolvePath } from './expression';
import { RunContext } from './types';

const ctx = (): RunContext => ({
  mode: 'simulate',
  trigger: { amount: 150, email: 'a@b.com', status: 'paid' },
  outputs: { node1: { ok: true, count: 3 } },
});

describe('expression engine', () => {
  it('resolves trigger, bare-id and nodes.* paths', () => {
    const c = ctx();
    expect(resolvePath('trigger.amount', c)).toBe(150);
    expect(resolvePath('node1.count', c)).toBe(3);
    expect(resolvePath('nodes.node1.ok', c)).toBe(true);
    expect(resolvePath('trigger.missing', c)).toBeUndefined();
  });

  it('interpolates {{ }} placeholders', () => {
    const c = ctx();
    expect(interpolate('Amount is {{trigger.amount}}', c)).toBe('Amount is 150');
    expect(interpolate('Hi {{trigger.email}}', c)).toBe('Hi a@b.com');
    expect(interpolate('Missing: [{{trigger.nope}}]', c)).toBe('Missing: []');
  });

  it('interpolates only string fields of data', () => {
    const c = ctx();
    const out = interpolateData({ to: '{{trigger.email}}', n: 5, on: true }, c);
    expect(out).toEqual({ to: 'a@b.com', n: 5, on: true });
  });

  it('evaluates numeric and string comparisons', () => {
    const c = ctx();
    expect(evaluateCondition('{{trigger.amount}} > 100', c)).toBe(true);
    expect(evaluateCondition('{{trigger.amount}} < 100', c)).toBe(false);
    expect(evaluateCondition('{{trigger.amount}} >= 150', c)).toBe(true);
    expect(evaluateCondition('{{trigger.status}} == "paid"', c)).toBe(true);
    expect(evaluateCondition('{{trigger.status}} != "paid"', c)).toBe(false);
    expect(evaluateCondition('{{trigger.email}} contains "@"', c)).toBe(true);
  });

  it('treats empty expressions as pass-through and bare values as truthiness', () => {
    const c = ctx();
    expect(evaluateCondition('', c)).toBe(true);
    expect(evaluateCondition(undefined, c)).toBe(true);
    expect(evaluateCondition('{{node1.ok}}', c)).toBe(true);
    expect(evaluateCondition('{{trigger.missing}}', c)).toBe(false);
  });
});
