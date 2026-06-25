'use client';

import { useState } from 'react';
import { Shield, Users, CheckCircle, XCircle, Info } from 'lucide-react';
import { Role, Permission, getRoleDisplayName, getRoleDescription, getRolePermissions } from '@/lib/services/rbac';

interface User {
  id: number;
  username: string;
  role: Role;
  created_at: string;
}

interface RoleManagerProps {
  users: User[];
  currentUserId: number;
  onRoleChange: (userId: number, newRole: Role) => Promise<void>;
}

export default function RoleManager({ users, currentUserId, onRoleChange }: RoleManagerProps) {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isChanging, setIsChanging] = useState(false);

  const roles = Object.values(Role);

  const handleRoleChange = async (userId: number, newRole: Role) => {
    if (userId === currentUserId) {
      alert('You cannot change your own role!');
      return;
    }
    if (confirm(`Change this user's role to ${getRoleDisplayName(newRole)}?`)) {
      setIsChanging(true);
      try {
        await onRoleChange(userId, newRole);
      } catch (error) {
        console.error('Error changing role:', error);
        alert('Failed to change role. Please try again.');
      } finally {
        setIsChanging(false);
      }
    }
  };

  const getRoleBadgeStyle = (role: Role): React.CSSProperties => {
    const map: Record<Role, { bg: string; color: string; border: string }> = {
      [Role.SUPER_ADMIN]: { bg: 'hsla(348,83%,47%,0.12)', color: '#f43f5e', border: 'hsla(348,83%,47%,0.3)' },
      [Role.ADMIN]:       { bg: 'hsla(238,81%,71%,0.12)', color: 'var(--primary)', border: 'hsla(238,81%,71%,0.3)' },
      [Role.MODERATOR]:   { bg: 'hsla(160,84%,39%,0.12)', color: '#10b981', border: 'hsla(160,84%,39%,0.3)' },
      [Role.VIEWER]:      { bg: 'hsla(0,0%,50%,0.1)',    color: 'var(--text-muted)', border: 'var(--border)' },
    };
    const s = map[role] ?? map[Role.VIEWER];
    return {
      display: 'inline-flex', alignItems: 'center',
      padding: '0.2rem 0.6rem', borderRadius: '999px',
      fontSize: '0.78rem', fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    };
  };

  return (
    <div className="admin-section">
      {/* Info banner */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
        padding: '0.9rem 1rem', borderRadius: '10px',
        background: 'hsla(238,81%,71%,0.08)', border: '1px solid hsla(238,81%,71%,0.2)',
      }}>
        <Info size={16} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>Role-Based Access Control</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
            Assign roles to users to control their permissions. Super Admins have full access, while Viewers can only view data.
          </p>
        </div>
      </div>

      {/* Users list */}
      <div className="admin-form-card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={16} /> User Roles
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Current Role</th>
                <th>Member Since</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                        background: 'hsla(238,81%,71%,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)',
                      }}>
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500 }}>
                        {user.username}
                        {user.id === currentUserId && (
                          <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>(You)</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td><span style={getRoleBadgeStyle(user.role)}>{getRoleDisplayName(user.role)}</span></td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    {user.id === currentUserId ? (
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Cannot modify own role</span>
                    ) : (
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                        disabled={isChanging}
                        style={{ fontSize: '0.85rem', padding: '0.3rem 0.5rem' }}
                      >
                        {roles.map((role) => (
                          <option key={role} value={role}>{getRoleDisplayName(role)}</option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permission matrix */}
      <div className="admin-form-card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={16} /> Permission Matrix
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          View permissions for each role
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          {roles.map((role) => (
            <button
              key={role}
              onClick={() => setSelectedRole(selectedRole === role ? null : role)}
              className={selectedRole === role ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
            >
              {getRoleDisplayName(role)}
            </button>
          ))}
        </div>

        {selectedRole && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{
              padding: '0.75rem 1rem', borderRadius: '8px',
              background: 'var(--surface)', border: '1px solid var(--border)',
            }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{getRoleDisplayName(selectedRole)}</div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>{getRoleDescription(selectedRole)}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
              {Object.values(Permission).map((permission) => {
                const has = getRolePermissions(selectedRole).includes(permission);
                return (
                  <div
                    key={permission}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.5rem 0.75rem', borderRadius: '8px',
                      background: has ? 'hsla(160,84%,39%,0.08)' : 'var(--surface)',
                      border: `1px solid ${has ? 'hsla(160,84%,39%,0.25)' : 'var(--border)'}`,
                      fontSize: '0.8rem',
                    }}
                  >
                    {has
                      ? <CheckCircle size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                      : <XCircle size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                    <span style={{ color: has ? 'var(--foreground)' : 'var(--text-muted)' }}>
                      {permission.replace(/_/g, ' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
