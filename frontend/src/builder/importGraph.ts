import type { WorkflowConnection, WorkflowNode } from '@cwb/shared';
import { getNodeDefinition } from './nodeRegistry';
import { uid } from '@/utils/id';

export interface ParsedImport {
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  /** Node types in the file that aren't registered and were skipped. */
  skipped: string[];
}

interface RawNode {
  id?: string | number;
  type?: string;
  position?: { x?: number; y?: number };
  data?: Record<string, unknown>;
}
interface RawConnection {
  source?: string | number;
  target?: string | number;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

/**
 * Parse a user-supplied JSON file into nodes + connections ready to drop on the
 * canvas. Accepts several shapes:
 *   - a full graph: { nodes: [...], connections: [...] }
 *   - an array of nodes: [ { type, data, position? }, ... ]
 *   - a single node:   { type, data }
 *
 * All ids are regenerated (so imports never collide with existing nodes) and
 * connection endpoints are remapped to the new ids. Unknown node types are
 * skipped and reported. Missing `data` is filled from the type's defaults.
 */
export function parseWorkflowImport(
  raw: unknown,
  opts: { startIndex?: number } = {},
): ParsedImport {
  let rawNodes: RawNode[] = [];
  let rawConnections: RawConnection[] = [];

  if (Array.isArray(raw)) {
    rawNodes = raw as RawNode[];
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.nodes)) {
      rawNodes = obj.nodes as RawNode[];
      rawConnections = (obj.connections as RawConnection[]) ?? [];
    } else if (typeof obj.type === 'string') {
      rawNodes = [obj as RawNode];
    }
  }

  const start = opts.startIndex ?? 0;
  const idMap = new Map<string, string>();
  const nodes: WorkflowNode[] = [];
  const skipped: string[] = [];

  rawNodes.forEach((n, i) => {
    const type = typeof n?.type === 'string' ? n.type : '';
    const def = getNodeDefinition(type);
    if (!def) {
      skipped.push(type || 'unknown');
      return;
    }
    const newId = uid('node');
    if (n.id != null) idMap.set(String(n.id), newId);

    // Use provided position when valid, else lay out on a tidy grid below
    // whatever is already on the canvas.
    const hasPos =
      n.position && typeof n.position.x === 'number' && typeof n.position.y === 'number';
    const index = start + i;
    const position = hasPos
      ? { x: n.position!.x as number, y: n.position!.y as number }
      : { x: 120 + (index % 4) * 220, y: 120 + Math.floor(index / 4) * 140 };

    nodes.push({
      id: newId,
      type,
      position,
      data: { ...(def.defaultData ?? {}), ...(n.data ?? {}) },
    });
  });

  const connections: WorkflowConnection[] = [];
  for (const c of rawConnections) {
    const source = idMap.get(String(c.source));
    const target = idMap.get(String(c.target));
    if (!source || !target) continue; // endpoints must reference imported nodes
    connections.push({
      id: uid('edge'),
      source,
      target,
      sourceHandle: c.sourceHandle,
      targetHandle: c.targetHandle,
      label: c.label,
    });
  }

  return { nodes, connections, skipped };
}
