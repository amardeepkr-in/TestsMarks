'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { studentLogin, requestAccessCode } from '@/lib/actions/student';
import { toast } from 'sonner';
import { BookOpen, Send, ArrowLeft } from 'lucide-react';

export default function StudentLoginForm() {
  const router = useRouter();
  const [rollNumber, setRollNumber] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollNumber.trim() || !accessCode.trim()) {
      toast.error('Please enter your roll number and access code');
      return;
    }
    setLoading(true);
    try {
      const result = await studentLogin(rollNumber.trim(), accessCode.trim());
      if (result.success) {
        toast.success('Login successful!');
        router.push('/student');
        router.refresh();
      } else {
        toast.error(result.error || 'Login failed');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccessCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollNumber.trim() || !email.trim()) {
      toast.error('Please enter your roll number and email');
      return;
    }
    setLoading(true);
    try {
      const result = await requestAccessCode(rollNumber.trim(), email.trim());
      if (result.success) {
        toast.success('Access code sent to your email! Please check your inbox.');
        setShowRequestForm(false);
        setEmail('');
      } else {
        toast.error(result.error || 'Failed to send access code');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (showRequestForm) {
    return (
      <form onSubmit={handleRequestAccessCode} className="admin-login-form">
        <div className="form-group">
          <label htmlFor="request-roll">Roll Number</label>
          <input
            id="request-roll"
            type="text"
            value={rollNumber}
            onChange={(e) => setRollNumber(e.target.value)}
            placeholder="Enter your roll number"
            required
            disabled={loading}
            autoFocus
          />
        </div>
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your registered email"
            required
            disabled={loading}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
          {loading ? 'Sending…' : <><Send size={16} /> Send Access Code</>}
        </button>
        <button
          type="button"
          className="btn btn-full"
          style={{ marginTop: '0.5rem' }}
          onClick={() => {
            setShowRequestForm(false);
            setEmail('');
          }}
          disabled={loading}
        >
          <ArrowLeft size={16} /> Back to Login
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleLogin} className="admin-login-form">
      <div className="form-group">
        <label htmlFor="roll-number">Roll Number</label>
        <input
          id="roll-number"
          type="text"
          value={rollNumber}
          onChange={(e) => setRollNumber(e.target.value)}
          placeholder="Enter your roll number"
          required
          autoFocus
          disabled={loading}
        />
      </div>
      <div className="form-group">
        <label htmlFor="access-code">Access Code</label>
        <input
          id="access-code"
          type="text"
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value)}
          placeholder="8-character access code"
          required
          maxLength={8}
          style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }}
          disabled={loading}
        />
      </div>
      <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
        {loading ? 'Logging in…' : <><BookOpen size={16} /> Login to Portal</>}
      </button>
      <button
        type="button"
        className="btn btn-full"
        style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}
        onClick={() => setShowRequestForm(true)}
        disabled={loading}
      >
        Don&apos;t have an access code? Request one
      </button>
    </form>
  );
}
