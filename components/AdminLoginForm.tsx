'use client'

import { useState } from 'react';
import { loginAdminUser } from '../lib/actions';
import { toast } from 'sonner';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminLoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Please enter both username and password');
      return;
    }
    setLoading(true);
    try {
      const result = await loginAdminUser(username.trim(), password);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Welcome back, ${result.username}!`);
        router.push('/admin');
      }
    } catch {
      toast.error('Login failed');
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="admin-login-form">
      <div className="form-group">
        <label htmlFor="username">Username</label>
        <input
          type="text"
          id="username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="Enter admin username"
          required
          autoFocus
          autoComplete="username"
          maxLength={50}
        />
      </div>
      <div className="form-group" style={{ position: 'relative' }}>
        <label htmlFor="password">Password</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter admin password"
            required
            autoComplete="current-password"
            maxLength={100}
            style={{ paddingRight: '2.5rem' }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '0.25rem',
              display: 'flex',
            }}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
      <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
        {loading ? 'Logging in...' : <><Shield size={16} /> Login to Admin Dashboard</>}
      </button>
      <div style={{ textAlign: 'center', marginTop: '12px' }}>
        <a href="#" onClick={async (e) => {
          e.preventDefault();
          if (!username.trim()) {
            toast.error('Enter your username first, then click Forgot Password');
            return;
          }
          const { requestPasswordReset } = await import('../lib/actions');
          const result = await requestPasswordReset(username.trim());
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success('If the username exists, a reset link has been sent');
          }
        }} style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          Forgot password?
        </a>
      </div>
    </form>
  );
}

