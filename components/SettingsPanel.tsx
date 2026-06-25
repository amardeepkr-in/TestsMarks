'use client'

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Settings, Shield, ShieldOff, Sun, Moon, ToggleLeft, ToggleRight, AlertTriangle, LayoutDashboard } from 'lucide-react';
import { toast } from 'sonner';
import { logoutAdminUser, updateSetting, wipeDatabase } from '../lib/actions';
import { AppSettings } from '../lib/types';

export default function SettingsPanel({ initialSettings, isAdmin }: { initialSettings: AppSettings; isAdmin: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAdminState, setIsAdminState] = useState(isAdmin);
  const [settings, setSettings] = useState<AppSettings>(initialSettings);

  useEffect(() => {
    setSettings(initialSettings);
    setIsAdminState(isAdmin);
  }, [initialSettings, isAdmin]);

  const handleLogout = async () => {
    setLoading(true);
    const result = await logoutAdminUser();
    if (result.success) {
      toast.success('Logged out');
      setIsAdminState(false);
    }
    setLoading(false);
  };

  const handleToggle = async (field: keyof AppSettings) => {
    if (!isAdminState) {
      toast.error('Admin access required');
      return;
    }
    const newValue = settings[field] === 1 ? 0 : 1;
    const result = await updateSetting(field, newValue);
    if (result.error) {
      toast.error(result.error);
    } else {
      setSettings(prev => ({ ...prev, [field]: newValue }));
      toast.success('Setting updated');
    }
  };

  const handleWipeDatabase = async () => {
    if (!isAdminState) {
      toast.error('Admin access required');
      return;
    }
    if (!confirm('This will permanently delete ALL submissions and admit cards. Are you absolutely sure?')) return;
    if (!confirm('Final confirmation: This action cannot be undone. Delete everything?')) return;

    setLoading(true);
    try {
      const result = await wipeDatabase();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Database wiped');
        window.location.reload();
      }
    } catch {
      toast.error('Failed to wipe database');
    }
    setLoading(false);
  };

  const toggleTheme = () => {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    try { localStorage.setItem('app-theme', next); } catch {}
  };

  return (
    <>
      <button className="settings-toggle" onClick={() => setIsOpen(!isOpen)} title="Settings">
        <Settings size={24} />
      </button>

      <div className={`settings-panel ${isOpen ? 'open' : ''}`}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={() => setIsOpen(false)}>✕</button>
        </div>

        <div className="settings-section">
          <h3>Admin Access</h3>
          {isAdminState ? (
            <div className="admin-status">
              <div className="admin-badge">
                <Shield size={16} /> Admin Mode Active
              </div>
              <button className="btn btn-outline" onClick={handleLogout} disabled={loading}>
                <ShieldOff size={16} /> Logout
              </button>
            </div>
          ) : (
            <div className="login-form">
              <Link href="/admin-login" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}>
                <Shield size={16} /> Admin Login
              </Link>
            </div>
          )}
        </div>

        <div className="settings-section">
          <h3>Display</h3>
          <button className="btn btn-outline theme-toggle" onClick={toggleTheme}>
            <Sun size={16} /> <span>Toggle Theme</span> <Moon size={16} />
          </button>
        </div>

        <div className="settings-section">
          <h3>Feature Controls</h3>
          <div className="toggle-list">
            <div className="toggle-item" onClick={() => handleToggle('allow_submissions')}>
              {settings.allow_submissions === 1 ? <ToggleRight size={24} className="toggle-on" /> : <ToggleLeft size={24} className="toggle-off" />}
              <span>Allow New Submissions</span>
            </div>
            <div className="toggle-item" onClick={() => handleToggle('allow_user_edits')}>
              {settings.allow_user_edits === 1 ? <ToggleRight size={24} className="toggle-on" /> : <ToggleLeft size={24} className="toggle-off" />}
              <span>Allow User Edits</span>
            </div>
            <div className="toggle-item" onClick={() => handleToggle('allow_uploads')}>
              {settings.allow_uploads === 1 ? <ToggleRight size={24} className="toggle-on" /> : <ToggleLeft size={24} className="toggle-off" />}
              <span>Allow Admit Card Uploads</span>
            </div>
          </div>
        </div>

        {isAdminState && (
          <>
            <div className="settings-section">
              <h3><LayoutDashboard size={14} /> Full Admin Dashboard</h3>
              <Link href="/admin" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}>
                <LayoutDashboard size={16} /> Open Admin Dashboard
              </Link>
            </div>
            <div className="settings-section danger-zone">
              <h3><AlertTriangle size={16} /> Danger Zone</h3>
              <button className="btn btn-danger" onClick={handleWipeDatabase} disabled={loading}>
                {loading ? 'Processing...' : 'Wipe Database'}
              </button>
              <p className="danger-warning">This will permanently delete all submissions and admit cards. This action cannot be undone.</p>
            </div>
          </>
        )}
      </div>
    </>
  );
}

