-- Migration: Add RBAC (Role-Based Access Control) system
-- Description: Adds role column to admin_users and creates saved_filters table

-- Add role column to admin_users table
ALTER TABLE admin_users ADD COLUMN role TEXT DEFAULT 'VIEWER';
ALTER TABLE admin_users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- Update existing admin users to SUPER_ADMIN role
UPDATE admin_users SET role = 'SUPER_ADMIN' WHERE role IS NULL OR role = 'VIEWER';

-- Create saved_filters table for storing user search filters
CREATE TABLE IF NOT EXISTS saved_filters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  config TEXT NOT NULL, -- JSON string of AdvancedSearchFilters
  is_default INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_saved_filters_user_id ON saved_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_filters_is_default ON saved_filters(user_id, is_default);

-- Create permissions table (for future extensibility)
CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create role_permissions junction table (for future extensibility)
CREATE TABLE IF NOT EXISTS role_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,
  permission_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE(role, permission_id)
);

-- Insert default permissions
INSERT OR IGNORE INTO permissions (name, description) VALUES
  ('VIEW_SUBMISSIONS', 'View submission records'),
  ('CREATE_SUBMISSIONS', 'Create new submissions'),
  ('EDIT_SUBMISSIONS', 'Edit existing submissions'),
  ('DELETE_SUBMISSIONS', 'Delete submissions'),
  ('EXPORT_DATA', 'Export data in various formats'),
  ('EXPORT_PDF', 'Export data as PDF'),
  ('EXPORT_EXCEL', 'Export data as Excel'),
  ('EXPORT_JSON', 'Export data as JSON'),
  ('VIEW_REPORTS', 'View reports and statistics'),
  ('VIEW_ANALYTICS', 'View analytics dashboard'),
  ('MANAGE_USERS', 'Manage user accounts'),
  ('ASSIGN_ROLES', 'Assign roles to users'),
  ('MANAGE_SETTINGS', 'Manage system settings'),
  ('MANAGE_BACKUPS', 'Create and restore backups'),
  ('VIEW_AUDIT_LOGS', 'View audit logs'),
  ('MANAGE_FILTERS', 'Manage saved filters'),
  ('BULK_IMPORT', 'Import data in bulk'),
  ('MANAGE_STUDENT_ACCESS', 'Manage student access'),
  ('VIEW_MONITORING', 'View system monitoring dashboard');

-- Made with Bob
