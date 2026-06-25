import { redirect } from 'next/navigation';
import AdminLoginForm from '../../components/AdminLoginForm';
import { Shield } from 'lucide-react';
import { validateSession } from '../../lib/auth';

export const metadata = { title: 'Admin Login — Marks & Admit Card Portal' };

export default async function AdminLoginPage() {
  const user = await validateSession();
  if (user) redirect('/admin');

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <div className="admin-login-icon">
            <Shield size={32} />
          </div>
          <h1>Admin Login</h1>
          <p>Sign in to access the admin dashboard</p>
        </div>
        <AdminLoginForm />
        <div className="admin-login-footer">
          <p>Enter your admin credentials to sign in.</p>
        </div>
      </div>
    </div>
  );
}

