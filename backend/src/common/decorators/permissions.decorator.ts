import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Declares the permission keys required to access a route.
 * The PermissionsGuard checks them against the authenticated user's permissions.
 *
 * @example
 *   @RequirePermissions('workflow.publish')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
