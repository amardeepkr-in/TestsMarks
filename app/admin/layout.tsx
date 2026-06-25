import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AdminLogoutButton from '../../components/AdminLogoutButton';
import { validateSession, rotateSessionIfNeeded } from '../../lib/auth';

export const metadata = { title: 'Admin Dashboard — Marks & Admit Card Portal' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await validateSession();
  if (!user) {
    redirect('/admin-login');
  }
  await rotateSessionIfNeeded();

  return (
    <div className="admin-layout">
      <nav className="admin-nav">
        <div className="admin-nav-left">
          <Link href="/" className="admin-nav-link">
            <ArrowLeft size={16} /> Back to Portal
          </Link>
        </div>
        <div className="admin-nav-center">
          <Link href="/admin" className="admin-nav-brand">Admin Dashboard</Link>
        </div>
        <div className="admin-nav-right">
          <AdminLogoutButton />
        </div>
      </nav>
      <main className="admin-main">{children}</main>
    </div>
  );
}

