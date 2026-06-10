import Dexie, { type Table } from 'dexie';
import type { AnyWorkflowEvent } from '@cwb/shared';

/** A workflow event buffered while offline, awaiting flush to the server. */
export interface QueuedEvent {
  id?: number;
  workflowId: number;
  event: AnyWorkflowEvent;
  createdAt: number;
}

/**
 * Offline-first store (feature 7). Events created while disconnected are
 * persisted here and flushed in order when connectivity returns.
 */
class CwbDatabase extends Dexie {
  queue!: Table<QueuedEvent, number>;

  constructor() {
    super('cwb-offline');
    this.version(1).stores({
      queue: '++id, workflowId, createdAt',
    });
  }
}

export const db = new CwbDatabase();

export const offlineQueue = {
  add: (item: QueuedEvent) => db.queue.add(item),
  allFor: (workflowId: number) => db.queue.where({ workflowId }).sortBy('createdAt'),
  all: () => db.queue.orderBy('createdAt').toArray(),
  count: () => db.queue.count(),
  clear: (ids: number[]) => db.queue.bulkDelete(ids),
};
