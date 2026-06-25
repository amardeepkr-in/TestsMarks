'use client'

import { logoutAdminUser } from '../lib/actions';
import { toast } from 'sonner';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const result = await logoutAdminUser();
    if (result.success) {
      toast.success('Logged out');
      router.push('/admin-login');
    }
  }

  return (
    <button className="btn btn-outline btn-sm" onClick={handleLogout} title="Logout">
      <LogOut size={14} /> Logout
    </button>
  );
}

