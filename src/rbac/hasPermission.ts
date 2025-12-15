import { JWTUser } from '../types';

/**
 * Check if user has a specific permission
 * @param user - User object with permissions array
 * @param permissionName - Permission name to check (e.g., 'student:read', 'bus:create')
 * @returns boolean - true if user has the permission
 */
export function hasPermission(user: JWTUser | undefined, permissionName: string): boolean {
  if (!user) {
    return false;
  }

  if (user.role === 'superadmin') {
    return true;
  }

  if (!user.permissions || !Array.isArray(user.permissions)) {
    return false;
  }

  return user.permissions.includes(permissionName);
}

/**
 * Check if user has any of the specified permissions
 * @param user - User object with permissions array
 * @param permissionNames - Array of permission names to check
 * @returns boolean - true if user has at least one of the permissions
 */
export function hasAnyPermission(user: JWTUser | undefined, permissionNames: string[]): boolean {
  if (!user) {
    return false;
  }

  if (user.role === 'superadmin') {
    return true;
  }

  if (!user.permissions || !Array.isArray(user.permissions)) {
    return false;
  }

  return permissionNames.some(permission => user.permissions!.includes(permission));
}

/**
 * Check if user has all of the specified permissions
 * @param user - User object with permissions array
 * @param permissionNames - Array of permission names to check
 * @returns boolean - true if user has all of the permissions
 */
export function hasAllPermissions(user: JWTUser | undefined, permissionNames: string[]): boolean {
  if (!user) {
    return false;
  }

  // Superadmin has all permissions
  if (user.role === 'superadmin') {
    return true;
  }

  if (!user.permissions || !Array.isArray(user.permissions)) {
    return false;
  }

  return permissionNames.every(permission => user.permissions!.includes(permission));
}

