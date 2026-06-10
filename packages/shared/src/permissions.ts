/** Canonical permission keys. Keep in sync with the seeded Permission rows. */
export const PERMISSIONS = {
  WORKFLOW_CREATE: 'workflow.create',
  WORKFLOW_VIEW: 'workflow.view',
  WORKFLOW_EDIT: 'workflow.edit',
  WORKFLOW_DELETE: 'workflow.delete',
  WORKFLOW_DUPLICATE: 'workflow.duplicate',
  WORKFLOW_PUBLISH: 'workflow.publish',
  WORKFLOW_EXECUTE: 'workflow.execute',
  ANALYTICS_VIEW: 'analytics.view',
  USER_MANAGE: 'user.manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
