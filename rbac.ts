import db from '@/lib/db';

// Define roles
export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  VIEWER = 'VIEWER',
}

// Define permissions
export enum Permission {
  // Submission permissions
  VIEW_SUBMISSIONS = 'VIEW_SUBMISSIONS',
  CREATE_SUBMISSIONS = 'CREATE_SUBMISSIONS',
  EDIT_SUBMISSIONS = 'EDIT_SUBMISSIONS',
  DELETE_SUBMISSIONS = 'DELETE_SUBMISSIONS',

  // Export permissions
  EXPORT_DATA = 'EXPORT_DATA',
  EXPORT_PDF = 'EXPORT_PDF',
  EXPORT_EXCEL = 'EXPORT_EXCEL',
  EXPORT_JSON = 'EXPORT_JSON',

  // Report permissions
  VIEW_REPORTS = 'VIEW_REPORTS',
  VIEW_ANALYTICS = 'VIEW_ANALYTICS',

  // User management permissions
  MANAGE_USERS = 'MANAGE_USERS',
  ASSIGN_ROLES = 'ASSIGN_ROLES',

  // System permissions
  MANAGE_SETTINGS = 'MANAGE_SETTINGS',
  MANAGE_BACKUPS = 'MANAGE_BACKUPS',
  VIEW_AUDIT_LOGS = 'VIEW_AUDIT_LOGS',
  MANAGE_FILTERS = 'MANAGE_FILTERS',

  // Advanced permissions
  BULK_IMPORT = 'BULK_IMPORT',
  MANAGE_STUDENT_ACCESS = 'MANAGE_STUDENT_ACCESS',
  VIEW_MONITORING = 'VIEW_MONITORING',
}

// Role-Permission mapping
const rolePermissions: Record<Role, Permission[]> = {
  [Role.SUPER_ADMIN]: [
    // All permissions
    Permission.VIEW_SUBMISSIONS,
    Permission.CREATE_SUBMISSIONS,
    Permission.EDIT_SUBMISSIONS,
    Permission.DELETE_SUBMISSIONS,
    Permission.EXPORT_DATA,
    Permission.EXPORT_PDF,
    Permission.EXPORT_EXCEL,
    Permission.EXPORT_JSON,
    Permission.VIEW_REPORTS,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_USERS,
    Permission.ASSIGN_ROLES,
    Permission.MANAGE_SETTINGS,
    Permission.MANAGE_BACKUPS,
    Permission.VIEW_AUDIT_LOGS,
    Permission.MANAGE_FILTERS,
    Permission.BULK_IMPORT,
    Permission.MANAGE_STUDENT_ACCESS,
    Permission.VIEW_MONITORING,
  ],
  [Role.ADMIN]: [
    Permission.VIEW_SUBMISSIONS,
    Permission.CREATE_SUBMISSIONS,
    Permission.EDIT_SUBMISSIONS,
    Permission.DELETE_SUBMISSIONS,
    Permission.EXPORT_DATA,
    Permission.EXPORT_PDF,
    Permission.EXPORT_EXCEL,
    Permission.EXPORT_JSON,
    Permission.VIEW_REPORTS,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_SETTINGS,
    Permission.MANAGE_BACKUPS,
    Permission.VIEW_AUDIT_LOGS,
    Permission.MANAGE_FILTERS,
    Permission.BULK_IMPORT,
    Permission.MANAGE_STUDENT_ACCESS,
  ],
  [Role.MODERATOR]: [
    Permission.VIEW_SUBMISSIONS,
    Permission.CREATE_SUBMISSIONS,
    Permission.EDIT_SUBMISSIONS,
    Permission.EXPORT_DATA,
    Permission.EXPORT_PDF,
    Permission.EXPORT_EXCEL,
    Permission.VIEW_REPORTS,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_FILTERS,
  ],
  [Role.VIEWER]: [
    Permission.VIEW_SUBMISSIONS,
    Permission.VIEW_REPORTS,
    Permission.VIEW_ANALYTICS,
  ],
};

/**
 * Get user's role from database
 */
export async function getUserRole(userId: number): Promise<Role> {
  try {
    const stmt = db.prepare(`
      SELECT role FROM admin_users WHERE id = ?
    `);

    const result = stmt.get(userId) as { role?: string } | undefined;

    // Default to VIEWER if no role is set
    return (result?.role as Role) || Role.VIEWER;
  } catch (error) {
    console.error('Error getting user role:', error);
    return Role.VIEWER;
  }
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(
  userId: number,
  permission: Permission
): Promise<boolean> {
  try {
    const role = await getUserRole(userId);
    const permissions = rolePermissions[role] || [];
    return permissions.includes(permission);
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Check if user has any of the specified permissions
 */
export async function hasAnyPermission(
  userId: number,
  permissions: Permission[]
): Promise<boolean> {
  try {
    const role = await getUserRole(userId);
    const userPermissions = rolePermissions[role] || [];
    return permissions.some(permission => userPermissions.includes(permission));
  } catch (error) {
    console.error('Error checking permissions:', error);
    return false;
  }
}

/**
 * Check if user has all of the specified permissions
 */
export async function hasAllPermissions(
  userId: number,
  permissions: Permission[]
): Promise<boolean> {
  try {
    const role = await getUserRole(userId);
    const userPermissions = rolePermissions[role] || [];
    return permissions.every(permission => userPermissions.includes(permission));
  } catch (error) {
    console.error('Error checking permissions:', error);
    return false;
  }
}

/**
 * Assign a role to a user
 */
export async function assignRole(userId: number, role: Role): Promise<boolean> {
  try {
    const stmt = db.prepare(`
      UPDATE admin_users
      SET role = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const result = stmt.run(role, userId);
    return result.changes > 0;
  } catch (error) {
    console.error('Error assigning role:', error);
    throw error;
  }
}

/**
 * Check if user has access to a specific resource with an action
 */
export async function checkAccess(
  userId: number,
  resource: string,
  action: 'view' | 'create' | 'edit' | 'delete'
): Promise<boolean> {
  try {
    // Map resource and action to permission
    const permissionMap: Record<string, Record<string, Permission>> = {
      submissions: {
        view: Permission.VIEW_SUBMISSIONS,
        create: Permission.CREATE_SUBMISSIONS,
        edit: Permission.EDIT_SUBMISSIONS,
        delete: Permission.DELETE_SUBMISSIONS,
      },
      reports: {
        view: Permission.VIEW_REPORTS,
      },
      analytics: {
        view: Permission.VIEW_ANALYTICS,
      },
      users: {
        view: Permission.MANAGE_USERS,
        create: Permission.MANAGE_USERS,
        edit: Permission.MANAGE_USERS,
        delete: Permission.MANAGE_USERS,
      },
      settings: {
        view: Permission.MANAGE_SETTINGS,
        edit: Permission.MANAGE_SETTINGS,
      },
      backups: {
        view: Permission.MANAGE_BACKUPS,
        create: Permission.MANAGE_BACKUPS,
      },
      audit_logs: {
        view: Permission.VIEW_AUDIT_LOGS,
      },
      monitoring: {
        view: Permission.VIEW_MONITORING,
      },
    };

    const permission = permissionMap[resource]?.[action];

    if (!permission) {
      return false;
    }

    return await hasPermission(userId, permission);
  } catch (error) {
    console.error('Error checking access:', error);
    return false;
  }
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: Role): Permission[] {
  return rolePermissions[role] || [];
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(userId: number): Promise<Permission[]> {
  try {
    const role = await getUserRole(userId);
    return getRolePermissions(role);
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
}

/**
 * Check if a role exists
 */
export function isValidRole(role: string): role is Role {
  return Object.values(Role).includes(role as Role);
}

/**
 * Get all available roles
 */
export function getAllRoles(): Role[] {
  return Object.values(Role);
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: Role): string {
  const displayNames: Record<Role, string> = {
    [Role.SUPER_ADMIN]: 'Super Administrator',
    [Role.ADMIN]: 'Administrator',
    [Role.MODERATOR]: 'Moderator',
    [Role.VIEWER]: 'Viewer',
  };
  return displayNames[role] || role;
}

/**
 * Get role description
 */
export function getRoleDescription(role: Role): string {
  const descriptions: Record<Role, string> = {
    [Role.SUPER_ADMIN]: 'Full system access including user management and role assignment',
    [Role.ADMIN]: 'Manage submissions, view reports, export data, and configure settings',
    [Role.MODERATOR]: 'View and edit submissions, export data, and view reports',
    [Role.VIEWER]: 'View submissions and reports only',
  };
  return descriptions[role] || '';
}

/**
 * Get users by role
 */
export async function getUsersByRole(role: Role): Promise<Array<{ id: number; username: string; role: string }>> {
  try {
    const stmt = db.prepare(`
      SELECT id, username, role
      FROM admin_users
      WHERE role = ?
      ORDER BY username
    `);

    return stmt.all(role) as Array<{ id: number; username: string; role: string }>;
  } catch (error) {
    console.error('Error getting users by role:', error);
    return [];
  }
}


