import type { AuthState } from './modules/auth';
import type { PermissionsState } from './modules/permissions';
import type { WorkflowState } from './modules/workflow';
import type { NodesState } from './modules/nodes';
import type { ConnectionsState } from './modules/connections';
import type { NotificationsState } from './modules/notifications';
import type { RealtimeState } from './modules/realtime';
import type { DebuggerState } from './modules/debugger';
import type { AnalyticsState } from './modules/analytics';
import type { OfflineState } from './modules/offline';

export interface RootState {
  auth: AuthState;
  permissions: PermissionsState;
  workflow: WorkflowState;
  nodes: NodesState;
  connections: ConnectionsState;
  notifications: NotificationsState;
  realtime: RealtimeState;
  debugger: DebuggerState;
  analytics: AnalyticsState;
  offline: OfflineState;
}
