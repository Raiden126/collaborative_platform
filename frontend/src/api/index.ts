import type {
  AnyWorkflowEvent,
  Workflow,
  WorkflowGraph,
} from '@cwb/shared';
import { http } from './http';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}

export const authApi = {
  login: (email: string, password: string) =>
    http.post<{ user: AuthUser; accessToken: string }>('/auth/login', { email, password }).then((r) => r.data),
  refresh: () =>
    http.post<{ user: AuthUser; accessToken: string }>('/auth/refresh').then((r) => r.data),
  logout: () => http.post('/auth/logout').then((r) => r.data),
  me: () => http.get<AuthUser>('/auth/me').then((r) => r.data),
};

export const permissionsApi = {
  catalogue: () => http.get<{ id: number; key: string }[]>('/permissions').then((r) => r.data),
};

export const workflowsApi = {
  list: () => http.get<Workflow[]>('/workflows').then((r) => r.data),
  get: (id: number) => http.get<Workflow>(`/workflows/${id}`).then((r) => r.data),
  create: (payload: { name: string; description?: string }) =>
    http.post<Workflow>('/workflows', payload).then((r) => r.data),
  update: (id: number, payload: { name?: string; description?: string; graph?: WorkflowGraph }) =>
    http.put<Workflow>(`/workflows/${id}`, payload).then((r) => r.data),
  duplicate: (id: number) => http.post<Workflow>(`/workflows/${id}/duplicate`).then((r) => r.data),
  publish: (id: number) => http.post<Workflow>(`/workflows/${id}/publish`).then((r) => r.data),
  remove: (id: number) => http.delete(`/workflows/${id}`).then((r) => r.data),

  listVersions: (id: number) =>
    http.get<WorkflowVersion[]>(`/workflows/${id}/versions`).then((r) => r.data),
  createVersion: (id: number, message?: string) =>
    http.post<WorkflowVersion>(`/workflows/${id}/versions`, { message }).then((r) => r.data),
  restoreVersion: (id: number, version: number) =>
    http.post<Workflow>(`/workflows/${id}/versions/${version}/restore`).then((r) => r.data),
  compareVersions: (id: number, a: number, b: number) =>
    http
      .get<{ from: WorkflowVersion; to: WorkflowVersion }>(
        `/workflows/${id}/versions/compare?a=${a}&b=${b}`,
      )
      .then((r) => r.data),
};

export const eventsApi = {
  list: (id: number, afterSeq = 0) =>
    http.get<StoredEvent[]>(`/workflows/${id}/events?afterSeq=${afterSeq}`).then((r) => r.data),
  stateAt: (id: number, seq: number) =>
    http.get<WorkflowGraph>(`/workflows/${id}/events/at/${seq}`).then((r) => r.data),
  append: (id: number, events: AnyWorkflowEvent[]) =>
    http
      .post<{ events: AnyWorkflowEvent[]; graph: WorkflowGraph; version: number }>(
        `/workflows/${id}/events`,
        { events },
      )
      .then((r) => r.data),
};

export const executionsApi = {
  simulate: (id: number) =>
    http.post<SimulationResult>(`/workflows/${id}/executions/simulate`).then((r) => r.data),
  list: (id: number) => http.get(`/workflows/${id}/executions`).then((r) => r.data),
};

export const analyticsApi = {
  summary: () => http.get<AnalyticsSummary>('/analytics/summary').then((r) => r.data),
};

export const activityApi = {
  list: (workflowId?: number) =>
    http
      .get<ActivityItem[]>('/activity', { params: { workflowId } })
      .then((r) => r.data),
};

// --- supporting types ---
export interface WorkflowVersion {
  id: number;
  workflowId: number;
  version: number;
  name: string;
  graph: WorkflowGraph;
  message?: string;
  createdAt: string;
}
export interface StoredEvent {
  id: number;
  seq: number;
  type: AnyWorkflowEvent['type'];
  payload: unknown;
  userId?: number;
  createdAt: string;
}
export interface ExecutionStep {
  nodeId: string;
  type: string;
  status: 'success' | 'failed' | 'skipped';
  durationMs: number;
  startedAt: number;
  output?: unknown;
  error?: string;
}
export interface SimulationResult {
  execution: { id: number; status: string };
  steps: ExecutionStep[];
  status: 'SUCCESS' | 'FAILED';
}
export interface AnalyticsSummary {
  totalWorkflows: number;
  activeWorkflows: number;
  failedExecutions: number;
  successfulExecutions: number;
  successRate: number;
  trend: { date: string; success: number; failed: number }[];
}
export interface ActivityItem {
  id: number;
  type: string;
  message: string;
  createdAt: string;
  user?: { id: number; name: string };
}
