import { redirect } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import ResetPasswordForm from '../../../components/ResetPasswordForm';
import { validateSession } from '../../../lib/auth';
import Link from 'next/link';

export const metadata = { title: 'Reset Password — Marks & Admit Card Portal' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const user = await validateSession();
  if (user) redirect('/admin');

  const { token } = await searchParams;
  if (!token) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card">
          <div className="admin-login-header">
            <div className="admin-login-icon">
              <KeyRound size={32} />
            </div>
            <h1>Invalid Reset Link</h1>
            <p>No reset token provided. Please request a new password reset.</p>
          </div>
          <div className="admin-login-footer">
            <Link href="/admin-login">Back to Login</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <div className="admin-login-icon">
            <KeyRound size={32} />
          </div>
          <h1>Reset Password</h1>
          <p>Enter your new password below.</p>
        </div>
        <ResetPasswordForm token={token} />
        <div className="admin-login-footer">
          <p><Link href="/admin-login">Back to Login</Link></p>
        </div>
      </div>
    </div>
  );
}
