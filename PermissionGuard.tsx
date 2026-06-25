'use client';

import { ReactNode } from 'react';
import { Permission } from '@/lib/services/rbac';
import { Lock } from 'lucide-react';

interface PermissionGuardProps {
  permission: Permission | Permission[];
  requireAll?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
  userPermissions: Permission[];
}

/**
 * Permission Guard Component
 * Conditionally renders children based on user permissions
 */
export default function PermissionGuard({
  permission,
  requireAll = false,
  fallback,
  children,
  userPermissions,
}: PermissionGuardProps) {
  const permissions = Array.isArray(permission) ? permission : [permission];

  const hasPermission = requireAll
    ? permissions.every(p => userPermissions.includes(p))
    : permissions.some(p => userPermissions.includes(p));

  if (!hasPermission) {
    if (fallback !== undefined) return <>{fallback}</>;
    return null;
  }

  return <>{children}</>;
}

/**
 * Permission Guard with default "Access Denied" message
 */
export function PermissionGuardWithMessage({
  permission,
  requireAll = false,
  children,
  userPermissions,
  message = 'You do not have permission to access this feature.',
}: PermissionGuardProps & { message?: string }) {
  const permissions = Array.isArray(permission) ? permission : [permission];

  const hasPermission = requireAll
    ? permissions.every(p => userPermissions.includes(p))
    : permissions.some(p => userPermissions.includes(p));

  if (!hasPermission) {
    return (
      <div className="empty-state" style={{ padding: '2rem', border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)', borderRadius: '10px' }}>
        <Lock size={32} style={{ color: '#d97706' }} />
        <strong style={{ color: '#92400e' }}>Access Denied</strong>
        <p style={{ color: '#b45309' }}>{message}</p>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Helper function to check permissions (for use in components)
 */
export function checkPermission(
  userPermissions: Permission[],
  permission: Permission | Permission[],
  requireAll: boolean = false
): boolean {
  const permissions = Array.isArray(permission) ? permission : [permission];
  return requireAll
    ? permissions.every(p => userPermissions.includes(p))
    : permissions.some(p => userPermissions.includes(p));
}
