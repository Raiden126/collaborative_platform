import { describe, expect, it } from 'vitest';
import { parseWorkflowImport } from '@/builder/importGraph';

describe('parseWorkflowImport', () => {
  it('imports a graph, regenerates ids and remaps connections', () => {
    const raw = {
      nodes: [
        { id: 'a', type: 'trigger' },
        { id: 'b', type: 'email', data: { to: 'x@y.com' } },
      ],
      connections: [{ source: 'a', target: 'b' }],
    };
    const r = parseWorkflowImport(raw);
    expect(r.nodes).toHaveLength(2);
    expect(r.connections).toHaveLength(1);
    // ids are regenerated (no collisions with existing canvas)
    expect(r.nodes[0].id).not.toBe('a');
    // connection endpoints remapped to the new ids
    expect(r.connections[0].source).toBe(r.nodes[0].id);
    expect(r.connections[0].target).toBe(r.nodes[1].id);
    // provided data merged over the type defaults
    expect(r.nodes[1].data.to).toBe('x@y.com');
  });

  it('accepts an array of nodes and a single node object', () => {
    expect(parseWorkflowImport([{ type: 'action', data: { name: 'x' } }]).nodes).toHaveLength(1);
    expect(parseWorkflowImport({ type: 'sms', data: {} }).nodes).toHaveLength(1);
  });

  it('skips unknown node types and reports them', () => {
    const r = parseWorkflowImport({ nodes: [{ type: 'frobnicate' }, { type: 'email' }] });
    expect(r.nodes).toHaveLength(1);
    expect(r.skipped).toContain('frobnicate');
  });

  it('drops connections that reference unknown/skipped nodes', () => {
    const r = parseWorkflowImport({
      nodes: [{ id: 'a', type: 'trigger' }],
      connections: [{ source: 'a', target: 'zzz' }],
    });
    expect(r.connections).toHaveLength(0);
  });

  it('lays out nodes without positions below existing canvas content', () => {
    const r = parseWorkflowImport([{ type: 'action' }], { startIndex: 4 });
    expect(typeof r.nodes[0].position.x).toBe('number');
    expect(typeof r.nodes[0].position.y).toBe('number');
  });
});
