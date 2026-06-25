import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => {
  const mockGet = vi.fn();
  const mockRun = vi.fn();
  const mockAll = vi.fn();
  return {
    default: {
      prepare: vi.fn(() => ({
        get: mockGet,
        run: mockRun,
        all: mockAll,
      })),
    },
  };
});

import db from '@/lib/db';
import {
  getUserRole,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  assignRole,
  checkAccess,
  getRolePermissions,
  getUserPermissions,
  isValidRole,
  getAllRoles,
  getRoleDisplayName,
  getRoleDescription,
  getUsersByRole,
  Role,
  Permission,
} from '@/lib/services/rbac';

const mockPrepare = vi.mocked(db.prepare);

function setupDbMock(returnValue: unknown) {
  const mockGet = vi.fn().mockReturnValue(returnValue);
  const mockRun = vi.fn().mockReturnValue({ changes: 1 });
  const mockAll = vi.fn().mockReturnValue(Array.isArray(returnValue) ? returnValue : []);
  mockPrepare.mockReturnValue({
    get: mockGet,
    run: mockRun,
    all: mockAll,
  } as unknown as ReturnType<typeof db.prepare>);
  return { mockGet, mockRun, mockAll };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getUserRole', () => {
  it('returns role for existing user', async () => {
    setupDbMock({ role: Role.ADMIN });
    const role = await getUserRole(1);
    expect(role).toBe(Role.ADMIN);
  });

  it('returns VIEWER when no role is set', async () => {
    setupDbMock({});
    const role = await getUserRole(1);
    expect(role).toBe(Role.VIEWER);
  });

  it('returns VIEWER when result is undefined', async () => {
    setupDbMock(undefined);
    const role = await getUserRole(999);
    expect(role).toBe(Role.VIEWER);
  });

  it('returns VIEWER on database error', async () => {
    mockPrepare.mockImplementation(() => {
      throw new Error('DB error');
    });
    const role = await getUserRole(1);
    expect(role).toBe(Role.VIEWER);
  });

  it('queries with correct userId', async () => {
    const { mockGet } = setupDbMock({ role: Role.VIEWER });
    await getUserRole(42);
    expect(mockGet).toHaveBeenCalledWith(42);
  });
});

describe('hasPermission', () => {
  it('returns true for granted permission (ADMIN has VIEW_SUBMISSIONS)', async () => {
    setupDbMock({ role: Role.ADMIN });
    const result = await hasPermission(1, Permission.VIEW_SUBMISSIONS);
    expect(result).toBe(true);
  });

  it('returns false for denied permission (VIEWER cannot EDIT_SUBMISSIONS)', async () => {
    setupDbMock({ role: Role.VIEWER });
    const result = await hasPermission(1, Permission.EDIT_SUBMISSIONS);
    expect(result).toBe(false);
  });

  it('returns true for SUPER_ADMIN with all permissions', async () => {
    setupDbMock({ role: Role.SUPER_ADMIN });
    const result = await hasPermission(1, Permission.MANAGE_USERS);
    expect(result).toBe(true);
  });

  it('returns false on database error (VIEWER fallback lacks non-view permission)', async () => {
    mockPrepare.mockImplementation(() => {
      throw new Error('DB error');
    });
    const result = await hasPermission(1, Permission.DELETE_SUBMISSIONS);
    expect(result).toBe(false);
  });

  it('returns false for unknown role', async () => {
    setupDbMock({ role: 'UNKNOWN_ROLE' });
    const result = await hasPermission(1, Permission.VIEW_SUBMISSIONS);
    expect(result).toBe(false);
  });
});

describe('hasAnyPermission', () => {
  it('returns true when user has at least one permission', async () => {
    setupDbMock({ role: Role.VIEWER });
    const result = await hasAnyPermission(1, [
      Permission.VIEW_SUBMISSIONS,
      Permission.DELETE_SUBMISSIONS,
    ]);
    expect(result).toBe(true);
  });

  it('returns false when user has none of the permissions', async () => {
    setupDbMock({ role: Role.VIEWER });
    const result = await hasAnyPermission(1, [
      Permission.DELETE_SUBMISSIONS,
      Permission.MANAGE_USERS,
    ]);
    expect(result).toBe(false);
  });

  it('returns false on database error (VIEWER fallback lacks non-view permission)', async () => {
    mockPrepare.mockImplementation(() => {
      throw new Error('DB error');
    });
    const result = await hasAnyPermission(1, [Permission.DELETE_SUBMISSIONS, Permission.MANAGE_USERS]);
    expect(result).toBe(false);
  });
});

describe('hasAllPermissions', () => {
  it('returns true when user has all permissions', async () => {
    setupDbMock({ role: Role.ADMIN });
    const result = await hasAllPermissions(1, [
      Permission.VIEW_SUBMISSIONS,
      Permission.CREATE_SUBMISSIONS,
      Permission.EDIT_SUBMISSIONS,
    ]);
    expect(result).toBe(true);
  });

  it('returns false when user is missing at least one permission', async () => {
    setupDbMock({ role: Role.MODERATOR });
    const result = await hasAllPermissions(1, [
      Permission.VIEW_SUBMISSIONS,
      Permission.DELETE_SUBMISSIONS,
    ]);
    expect(result).toBe(false);
  });

  it('returns false on database error (VIEWER fallback lacks non-view permission)', async () => {
    mockPrepare.mockImplementation(() => {
      throw new Error('DB error');
    });
    const result = await hasAllPermissions(1, [Permission.DELETE_SUBMISSIONS]);
    expect(result).toBe(false);
  });
});

describe('assignRole', () => {
  it('updates user role and returns true', async () => {
    setupDbMock(null);
    const result = await assignRole(1, Role.ADMIN);
    expect(result).toBe(true);
  });

  it('returns false when no rows are updated', async () => {
    const mockRun = vi.fn().mockReturnValue({ changes: 0 });
    mockPrepare.mockReturnValue({
      get: vi.fn(),
      run: mockRun,
      all: vi.fn(),
    } as unknown as ReturnType<typeof db.prepare>);
    const result = await assignRole(999, Role.ADMIN);
    expect(result).toBe(false);
  });

  it('throws on database error', async () => {
    mockPrepare.mockImplementation(() => {
      throw new Error('DB error');
    });
    await expect(assignRole(1, Role.ADMIN)).rejects.toThrow('DB error');
  });
});

describe('checkAccess', () => {
  it('returns true for allowed resource/action', async () => {
    setupDbMock({ role: Role.ADMIN });
    const result = await checkAccess(1, 'submissions', 'view');
    expect(result).toBe(true);
  });

  it('returns false for denied resource/action', async () => {
    setupDbMock({ role: Role.VIEWER });
    const result = await checkAccess(1, 'submissions', 'delete');
    expect(result).toBe(false);
  });

  it('returns false for unknown resource', async () => {
    setupDbMock({ role: Role.ADMIN });
    const result = await checkAccess(1, 'unknown_resource', 'view');
    expect(result).toBe(false);
  });

  it('returns false for unknown action', async () => {
    setupDbMock({ role: Role.ADMIN });
    const result = await checkAccess(1, 'submissions', 'unknown' as 'view');
    expect(result).toBe(false);
  });

  it('returns false on database error (VIEWER fallback lacks non-view permission)', async () => {
    mockPrepare.mockImplementation(() => {
      throw new Error('DB error');
    });
    const result = await checkAccess(1, 'submissions', 'delete');
    expect(result).toBe(false);
  });
});

describe('getRolePermissions', () => {
  it('returns permissions for SUPER_ADMIN', () => {
    const perms = getRolePermissions(Role.SUPER_ADMIN);
    expect(perms).toContain(Permission.MANAGE_USERS);
    expect(perms).toContain(Permission.ASSIGN_ROLES);
    expect(perms).toContain(Permission.VIEW_SUBMISSIONS);
    expect(perms.length).toBe(19);
  });

  it('returns permissions for ADMIN', () => {
    const perms = getRolePermissions(Role.ADMIN);
    expect(perms).toContain(Permission.VIEW_SUBMISSIONS);
    expect(perms).toContain(Permission.MANAGE_SETTINGS);
    expect(perms).not.toContain(Permission.ASSIGN_ROLES);
  });

  it('returns permissions for MODERATOR', () => {
    const perms = getRolePermissions(Role.MODERATOR);
    expect(perms).toContain(Permission.VIEW_SUBMISSIONS);
    expect(perms).toContain(Permission.CREATE_SUBMISSIONS);
    expect(perms).toContain(Permission.EDIT_SUBMISSIONS);
    expect(perms).not.toContain(Permission.DELETE_SUBMISSIONS);
    expect(perms).not.toContain(Permission.MANAGE_USERS);
  });

  it('returns permissions for VIEWER', () => {
    const perms = getRolePermissions(Role.VIEWER);
    expect(perms).toContain(Permission.VIEW_SUBMISSIONS);
    expect(perms).toContain(Permission.VIEW_REPORTS);
    expect(perms).toContain(Permission.VIEW_ANALYTICS);
    expect(perms.length).toBe(3);
  });

  it('returns empty array for unknown role', () => {
    const perms = getRolePermissions('UNKNOWN' as Role);
    expect(perms).toEqual([]);
  });
});

describe('getUserPermissions', () => {
  it('returns permissions for user with known role', async () => {
    setupDbMock({ role: Role.ADMIN });
    const perms = await getUserPermissions(1);
    expect(perms).toContain(Permission.VIEW_SUBMISSIONS);
    expect(perms).toContain(Permission.MANAGE_SETTINGS);
  });

  it('returns VIEWER permissions on database error (graceful fallback)', async () => {
    mockPrepare.mockImplementation(() => {
      throw new Error('DB error');
    });
    const perms = await getUserPermissions(1);
    expect(perms).toEqual(getRolePermissions(Role.VIEWER));
  });
});

describe('permission hierarchy', () => {
  it('SUPER_ADMIN has all permissions that ADMIN has', async () => {
    setupDbMock({ role: Role.SUPER_ADMIN });
    const superAdminPerms = await getUserPermissions(1);
    setupDbMock({ role: Role.ADMIN });
    const adminPerms = await getUserPermissions(2);
    for (const perm of adminPerms) {
      expect(superAdminPerms).toContain(perm);
    }
  });

  it('ADMIN has all permissions that MODERATOR has', async () => {
    setupDbMock({ role: Role.ADMIN });
    const adminPerms = await getUserPermissions(1);
    setupDbMock({ role: Role.MODERATOR });
    const modPerms = await getUserPermissions(2);
    for (const perm of modPerms) {
      expect(adminPerms).toContain(perm);
    }
  });

  it('MODERATOR has all permissions that VIEWER has', async () => {
    setupDbMock({ role: Role.MODERATOR });
    const modPerms = await getUserPermissions(1);
    setupDbMock({ role: Role.VIEWER });
    const viewerPerms = await getUserPermissions(2);
    for (const perm of viewerPerms) {
      expect(modPerms).toContain(perm);
    }
  });

  it('SUPER_ADMIN has more permissions than ADMIN', () => {
    const superAdminPerms = getRolePermissions(Role.SUPER_ADMIN);
    const adminPerms = getRolePermissions(Role.ADMIN);
    expect(superAdminPerms.length).toBeGreaterThan(adminPerms.length);
  });

  it('ADMIN has more permissions than MODERATOR', () => {
    const adminPerms = getRolePermissions(Role.ADMIN);
    const modPerms = getRolePermissions(Role.MODERATOR);
    expect(adminPerms.length).toBeGreaterThan(modPerms.length);
  });

  it('MODERATOR has more permissions than VIEWER', () => {
    const modPerms = getRolePermissions(Role.MODERATOR);
    const viewerPerms = getRolePermissions(Role.VIEWER);
    expect(modPerms.length).toBeGreaterThan(viewerPerms.length);
  });
});

describe('isValidRole', () => {
  it('returns true for valid roles', () => {
    expect(isValidRole(Role.SUPER_ADMIN)).toBe(true);
    expect(isValidRole(Role.ADMIN)).toBe(true);
    expect(isValidRole(Role.MODERATOR)).toBe(true);
    expect(isValidRole(Role.VIEWER)).toBe(true);
  });

  it('returns false for invalid role', () => {
    expect(isValidRole('INVALID')).toBe(false);
    expect(isValidRole('')).toBe(false);
    expect(isValidRole('admin')).toBe(false);
  });
});

describe('getAllRoles', () => {
  it('returns all 4 roles', () => {
    const roles = getAllRoles();
    expect(roles).toHaveLength(4);
    expect(roles).toContain(Role.SUPER_ADMIN);
    expect(roles).toContain(Role.ADMIN);
    expect(roles).toContain(Role.MODERATOR);
    expect(roles).toContain(Role.VIEWER);
  });
});

describe('getRoleDisplayName', () => {
  it('returns correct display names', () => {
    expect(getRoleDisplayName(Role.SUPER_ADMIN)).toBe('Super Administrator');
    expect(getRoleDisplayName(Role.ADMIN)).toBe('Administrator');
    expect(getRoleDisplayName(Role.MODERATOR)).toBe('Moderator');
    expect(getRoleDisplayName(Role.VIEWER)).toBe('Viewer');
  });

  it('returns role string for unknown role', () => {
    expect(getRoleDisplayName('UNKNOWN' as Role)).toBe('UNKNOWN');
  });
});

describe('getRoleDescription', () => {
  it('returns non-empty descriptions for all roles', () => {
    for (const role of Object.values(Role)) {
      const desc = getRoleDescription(role);
      expect(desc).toBeTruthy();
      expect(typeof desc).toBe('string');
    }
  });

  it('returns empty string for unknown role', () => {
    expect(getRoleDescription('UNKNOWN' as Role)).toBe('');
  });
});

describe('getUsersByRole', () => {
  it('returns users for a given role', async () => {
    const users = [{ id: 1, username: 'admin', role: Role.ADMIN }];
    setupDbMock(users);
    const result = await getUsersByRole(Role.ADMIN);
    expect(result).toEqual(users);
  });

  it('returns empty array on database error', async () => {
    mockPrepare.mockImplementation(() => {
      throw new Error('DB error');
    });
    const result = await getUsersByRole(Role.ADMIN);
    expect(result).toEqual([]);
  });

  it('queries with correct role', async () => {
    const { mockAll } = setupDbMock([]);
    await getUsersByRole(Role.VIEWER);
    expect(mockAll).toHaveBeenCalledWith(Role.VIEWER);
  });
});
