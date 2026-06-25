'use client'

import { useState } from 'react';
import { resetPassword } from '../lib/actions';
import { toast } from 'sonner';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) {
      toast.error('Please enter a new password');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const result = await resetPassword(token, password);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Password reset successfully! Redirecting to login...');
        setTimeout(() => router.push('/admin-login'), 2000);
      }
    } catch {
      toast.error('Failed to reset password');
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="admin-login-form">
      <div className="form-group" style={{ position: 'relative' }}>
        <label htmlFor="password">New Password</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter new password"
            required
            autoFocus
            autoComplete="new-password"
            minLength={8}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '4px',
            }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="confirmPassword">Confirm Password</label>
        <input
          type={showPassword ? 'text' : 'password'}
          id="confirmPassword"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          required
          autoComplete="new-password"
          minLength={8}
        />
      </div>
      <button type="submit" disabled={loading} className="admin-login-btn">
        <KeyRound size={16} />
        {loading ? 'Resetting...' : 'Reset Password'}
      </button>
    </form>
  );
}
