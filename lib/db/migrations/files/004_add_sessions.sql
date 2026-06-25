-- Migration: 004_add_sessions
-- Description: Add sessions table for secure cookie-based auth (replaces plaintext PIN cookie)

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,           -- cryptographically random token
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'VIEWER',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,  -- 24h from creation
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Made with Bob
