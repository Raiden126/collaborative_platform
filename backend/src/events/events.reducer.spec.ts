import { applyEvent, emptyGraph, makeEvent, replay, WorkflowNode } from '@cwb/shared';

const node = (id: string): WorkflowNode => ({
  id,
  type: 'action',
  position: { x: 0, y: 0 },
  data: {},
});

describe('workflow event reducer', () => {
  it('creates and moves nodes', () => {
    let g = emptyGraph();
    g = applyEvent(g, makeEvent('NODE_CREATED', { node: node('a') }));
    g = applyEvent(g, makeEvent('NODE_MOVED', { nodeId: 'a', position: { x: 10, y: 20 } }));
    expect(g.nodes).toHaveLength(1);
    expect(g.nodes[0].position).toEqual({ x: 10, y: 20 });
  });

  it('is idempotent for duplicate NODE_CREATED', () => {
    let g = emptyGraph();
    g = applyEvent(g, makeEvent('NODE_CREATED', { node: node('a') }));
    g = applyEvent(g, makeEvent('NODE_CREATED', { node: node('a') }));
    expect(g.nodes).toHaveLength(1);
  });

  it('drops dangling connections when a node is deleted', () => {
    let g = emptyGraph();
    g = applyEvent(g, makeEvent('NODE_CREATED', { node: node('a') }));
    g = applyEvent(g, makeEvent('NODE_CREATED', { node: node('b') }));
    g = applyEvent(g, makeEvent('CONNECTION_ADDED', {
      connection: { id: 'c1', source: 'a', target: 'b' },
    }));
    g = applyEvent(g, makeEvent('NODE_DELETED', { nodeId: 'a' }));
    expect(g.nodes).toHaveLength(1);
    expect(g.connections).toHaveLength(0);
  });

  it('reproduces state by replaying the event stream', () => {
    const events = [
      makeEvent('NODE_CREATED', { node: node('a') }),
      makeEvent('NODE_CREATED', { node: node('b') }),
      makeEvent('NODE_MOVED', { nodeId: 'b', position: { x: 5, y: 5 } }),
      makeEvent('NODE_DELETED', { nodeId: 'a' }),
    ];
    const g = replay(events);
    expect(g.nodes.map((n) => n.id)).toEqual(['b']);
    expect(g.nodes[0].position).toEqual({ x: 5, y: 5 });
  });
});
