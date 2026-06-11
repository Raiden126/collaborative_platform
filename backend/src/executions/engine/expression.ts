import { RunContext } from './types';

/**
 * Safe expression + template helpers used by the execution engine.
 * No `eval`/`Function` — references are resolved against the run context only.
 *
 * Reference syntax (dot paths):
 *   trigger.email          → ctx.trigger.email
 *   <nodeId>.status        → ctx.outputs[nodeId].status
 *   nodes.<nodeId>.body    → ctx.outputs[nodeId].body
 */
export function resolvePath(path: string, ctx: RunContext): unknown {
  const parts = path.trim().split('.');
  if (parts.length === 0) return undefined;

  let root: unknown;
  if (parts[0] === 'trigger') {
    root = ctx.trigger;
    parts.shift();
  } else if (parts[0] === 'nodes') {
    root = ctx.outputs;
    parts.shift();
  } else {
    // Bare id → look in node outputs first, then trigger.
    root = ctx.outputs;
  }

  let value: unknown = root;
  for (const key of parts) {
    if (value == null || typeof value !== 'object') return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

/** Replace `{{ path }}` placeholders in a string with resolved values. */
export function interpolate(input: string, ctx: RunContext): string {
  return input.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, path: string) => {
    const v = resolvePath(path, ctx);
    if (v == null) return '';
    return typeof v === 'object' ? JSON.stringify(v) : String(v);
  });
}

/** Deep-interpolate all string values in a node's `data` object. */
export function interpolateData(
  data: Record<string, unknown>,
  ctx: RunContext,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data ?? {})) {
    out[k] = typeof v === 'string' ? interpolate(v, ctx) : v;
  }
  return out;
}

const OPERATORS = ['>=', '<=', '==', '!=', '>', '<', 'contains'] as const;

/** Coerce a literal token (or resolved reference) to a comparable JS value. */
function coerce(token: string, ctx: RunContext): unknown {
  const t = token.trim();
  // {{ ref }} or bare ref handled by interpolate first; here handle literals.
  if (/^".*"$/.test(t) || /^'.*'$/.test(t)) return t.slice(1, -1);
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (t !== '' && !Number.isNaN(Number(t))) return Number(t);
  return t;
}

/**
 * Evaluate a condition expression to a boolean.
 *   "{{trigger.amount}} > 100"
 *   "{{order.status}} == \"paid\""
 *   "{{user.active}}"            (bare → truthiness)
 * Empty/unparseable expressions default to `true` (pass-through).
 */
export function evaluateCondition(expression: string | undefined, ctx: RunContext): boolean {
  if (!expression || !expression.trim()) return true;
  const expr = interpolate(expression, ctx).trim();

  for (const op of OPERATORS) {
    const idx = expr.indexOf(op);
    if (idx === -1) continue;
    const left = coerce(expr.slice(0, idx), ctx);
    const right = coerce(expr.slice(idx + op.length), ctx);
    switch (op) {
      case '>=':
        return Number(left) >= Number(right);
      case '<=':
        return Number(left) <= Number(right);
      case '>':
        return Number(left) > Number(right);
      case '<':
        return Number(left) < Number(right);
      case '==':
        return String(left) === String(right);
      case '!=':
        return String(left) !== String(right);
      case 'contains':
        return String(left).includes(String(right));
    }
  }

  // No operator → truthiness of the (already interpolated) value.
  const v = expr.toLowerCase();
  return v !== '' && v !== 'false' && v !== '0' && v !== 'null' && v !== 'undefined';
}
