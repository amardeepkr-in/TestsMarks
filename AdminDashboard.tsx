'use client'

import { useState, useMemo, useRef, useCallback } from 'react';
import { Submission, AppSettings, DashboardStats, AdminUser } from '../lib/types';
import {
  createSubmission, updateSubmissionFull, deleteSubmission, uploadAdmitCard, deleteAdmitCard,
  updateSetting, wipeDatabase, getAdminUsers, createAdminUser, deleteAdminUser, changeAdminPassword
} from '../lib/actions';
import {
  LayoutDashboard, Users, Settings, FileText, Upload, Trash2, Plus, Check, X,
  Eye, Download, AlertTriangle, ChevronLeft, ChevronRight, Pencil,
  ToggleLeft, ToggleRight, Key, RefreshCw, UserCheck, BarChart3, Database
} from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import StudentAccessManager from './StudentAccessManager';
import AnalyticsDashboard from './AnalyticsDashboard';
import BackupManager from './BackupManager';
import BulkImportDialog from './BulkImportDialog';
import ExportDialog from './ExportDialog';

type Tab = 'overview' | 'submissions' | 'analytics' | 'backups' | 'admins' | 'student-access' | 'settings';

interface AdminDashboardProps {
  submissions: Submission[];
  stats: DashboardStats;
  settings: AppSettings;
}

export default function AdminDashboard({ submissions: initialSubmissions, stats, settings: initialSettings }: AdminDashboardProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [submissions, setSubmissions] = useState<Submission[]>(initialSubmissions);
  const [settings, setSettings] = useState<AppSettings>(initialSettings);

  return (
    <div className="admin-content">
      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
          <LayoutDashboard size={16} /> Overview
        </button>
        <button className={`admin-tab ${tab === 'submissions' ? 'active' : ''}`} onClick={() => setTab('submissions')}>
          <FileText size={16} /> Submissions ({submissions.length})
        </button>
        <button className={`admin-tab ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}>
          <BarChart3 size={16} /> Analytics
        </button>
        <button className={`admin-tab ${tab === 'backups' ? 'active' : ''}`} onClick={() => setTab('backups')}>
          <Database size={16} /> Backups
        </button>
        <button className={`admin-tab ${tab === 'admins' ? 'active' : ''}`} onClick={() => setTab('admins')}>
          <Users size={16} /> Admin Users
        </button>
        <button className={`admin-tab ${tab === 'student-access' ? 'active' : ''}`} onClick={() => setTab('student-access')}>
          <UserCheck size={16} /> Student Access
        </button>
        <button className={`admin-tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
          <Settings size={16} /> Settings
        </button>
      </div>

      {tab === 'overview' && <OverviewTab stats={stats} submissions={submissions} />}
      {tab === 'submissions' && <SubmissionsTab submissions={submissions} setSubmissions={setSubmissions} />}
      {tab === 'analytics' && <AnalyticsDashboard />}
      {tab === 'backups' && <BackupManager />}
      {tab === 'admins' && <AdminsTab />}
      {tab === 'student-access' && <StudentAccessTab submissions={submissions} />}
      {tab === 'settings' && <SettingsTab settings={settings} setSettings={setSettings} />}
    </div>
  );
}

// ─── Overview Tab ───
function OverviewTab({ stats, submissions }: { stats: DashboardStats; submissions: Submission[] }) {
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; totalMarks: number }>();
    submissions.forEach(s => {
      const entry = map.get(s.category) || { count: 0, totalMarks: 0 };
      entry.count++;
      entry.totalMarks += parseFloat(s.marks) || 0;
      map.set(s.category, entry);
    });
    return Array.from(map.entries())
      .map(([cat, data]) => ({ category: cat, count: data.count, avg: data.count ? (data.totalMarks / data.count).toFixed(1) : '0' }))
      .sort((a, b) => b.count - a.count);
  }, [submissions]);

  return (
    <div className="admin-section">
      <h2 className="admin-section-title">Dashboard Overview</h2>
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--primary)' }}>
            <FileText size={24} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-value">{stats.total}</span>
            <span className="admin-stat-label">Total Records</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
            <Upload size={24} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-value">{stats.withAdmitCard}</span>
            <span className="admin-stat-label">With Admit Card</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(234,179,8,0.1)', color: '#eab308' }}>
            <FileText size={24} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-value">{stats.withoutAdmitCard}</span>
            <span className="admin-stat-label">Without Admit Card</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
            <LayoutDashboard size={24} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-value">{stats.categoryCount}</span>
            <span className="admin-stat-label">Categories</span>
          </div>
        </div>
      </div>

      <div className="admin-marks-summary">
        <h3>Marks Summary</h3>
        <div className="marks-summary-grid">
          <div className="marks-summary-item"><span className="ms-label">Highest</span><span className="ms-value">{stats.highestMarks ?? '—'}</span></div>
          <div className="marks-summary-item"><span className="ms-label">Lowest</span><span className="ms-value">{stats.lowestMarks ?? '—'}</span></div>
          <div className="marks-summary-item"><span className="ms-label">Average</span><span className="ms-value">{stats.averageMarks ?? '—'}</span></div>
          <div className="marks-summary-item"><span className="ms-label">Median</span><span className="ms-value">{stats.medianMarks ?? '—'}</span></div>
        </div>
      </div>

      {categoryBreakdown.length > 0 && (
        <div className="admin-marks-summary">
          <h3>Category Breakdown</h3>
          <table className="admin-table">
            <thead><tr><th>Category</th><th>Count</th><th>Avg Marks</th></tr></thead>
            <tbody>
              {categoryBreakdown.map(c => (
                <tr key={c.category}><td>{c.category}</td><td>{c.count}</td><td>{c.avg}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Submissions Tab ───
function SubmissionsTab({ submissions, setSubmissions }: { submissions: Submission[]; setSubmissions: React.Dispatch<React.SetStateAction<Submission[]>> }) {
  const [editingSub, setEditingSub] = useState<Submission | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; type: string; name: string } | null>(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [selectedIds] = useState<number[]>([]);
  const PAGE_SIZE = 15;
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const setFileInputRef = useCallback((id: number, el: HTMLInputElement | null) => {
    fileInputRefs.current[id] = el;
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(submissions.map(s => s.category));
    return Array.from(cats);
  }, [submissions]);

  const handleImportComplete = () => {
    window.location.reload();
  };

  const filtered = useMemo(() => {
    if (!search) return submissions;
    const lower = search.toLowerCase();
    return submissions.filter(s => s.name.toLowerCase().includes(lower) || s.roll.toLowerCase().includes(lower) || s.category.toLowerCase().includes(lower));
  }, [submissions, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function handleDelete(id: number) {
    if (!confirm('Delete this submission?')) return;
    const result = await deleteSubmission(id);
    if (result.error) { toast.error(result.error); return; }
    setSubmissions(prev => prev.filter(s => s.id !== id));
    toast.success('Deleted');
  }

  async function handleUploadAdmitCard(id: number, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const result = await uploadAdmitCard(id, formData);
    if (result.error) { toast.error(result.error); return; }
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, admit_card_path: `/uploads/${file.name}`, admit_card_filename: file.name } : s));
    toast.success('Admit card uploaded');
  }

  async function handleDeleteAdmitCard(id: number) {
    const result = await deleteAdmitCard(id);
    if (result.error) { toast.error(result.error); return; }
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, admit_card_path: null, admit_card_filename: null } : s));
    toast.success('Admit card removed');
  }

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">Manage Submissions</h2>
        <div className="admin-section-actions">
          <button className="btn btn-outline btn-sm" onClick={() => setShowImportDialog(true)}><Upload size={14} /> Import</button>
          <button className="btn btn-outline btn-sm" onClick={() => setShowExportDialog(true)}><Download size={14} /> Export</button>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditingSub(null); setShowAddForm(true); }}><Plus size={14} /> Add New</button>
        </div>
      </div>

      {(showAddForm || editingSub) && (
        <SubmissionForm
          editingSubmission={editingSub}
          onCancel={() => { setShowAddForm(false); setEditingSub(null); }}
          onSaved={(sub) => {
            if (editingSub) {
              setSubmissions(prev => prev.map(s => s.id === sub.id ? sub : s));
              toast.success('Updated');
            } else {
              setSubmissions(prev => [...prev, sub]);
              toast.success('Added');
            }
            setShowAddForm(false);
            setEditingSub(null);
          }}
        />
      )}

      <input type="text" placeholder="Search by name, roll, or category..." value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} className="search-input" style={{ marginBottom: '1rem', width: '100%' }} />

      <div className="table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Category</th>
              <th>Roll</th>
              <th>Marks</th>
              <th>Admit Card</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {page.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No submissions found</td></tr>
            ) : page.map(sub => (
              <tr key={sub.id}>
                <td>{sub.id}</td>
                <td>{sub.name}</td>
                <td>{sub.category}</td>
                <td>{sub.roll}</td>
                <td>{sub.marks}</td>
                <td>
                  {sub.admit_card_path ? (
                    <div className="table-actions">
                      <button className="icon-btn view" onClick={() => setPreviewFile({ url: sub.admit_card_path!, type: sub.admit_card_filename?.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg', name: sub.admit_card_filename || 'Card' })} title="View"><Eye size={14} /></button>
                      <button className="icon-btn cancel" onClick={() => handleDeleteAdmitCard(sub.id)} title="Remove card"><Trash2 size={14} /></button>
                    </div>
                  ) : (
                    <div className="table-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => fileInputRefs.current[sub.id]?.click()}><Upload size={12} /> Upload</button>
                      <input ref={el => setFileInputRef(sub.id, el)} type="file" accept=".jpg,.jpeg,.png,.pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadAdmitCard(sub.id, f); e.target.value = ''; }} />
                    </div>
                  )}
                </td>
                <td>
                  <div className="table-actions">
                    <button className="icon-btn view" onClick={() => { setEditingSub(sub); setShowAddForm(true); }} title="Edit"><Pencil size={14} /></button>
                    <button className="icon-btn delete" onClick={() => handleDelete(sub.id)} title="Delete"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination" style={{ marginTop: '1rem' }}>
          <button className="icon-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Page {currentPage} of {totalPages}</span>
          <button className="icon-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
        </div>
      )}

      {previewFile && (
        <div className="modal-overlay" onClick={() => setPreviewFile(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{previewFile.name}</h3>
              <button className="icon-btn cancel" onClick={() => setPreviewFile(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {previewFile.type === 'application/pdf' ? (
                <iframe src={previewFile.url} style={{ width: '100%', height: '70vh', border: 'none' }} />
              ) : (
                <Image src={previewFile.url} alt="Preview" width={800} height={600} unoptimized style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
              )}
            </div>
          </div>
        </div>
      )}

      <BulkImportDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportComplete={handleImportComplete}
      />

      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        selectedIds={selectedIds}
        categories={categories}
      />
    </div>
  );
}

// ─── Submission Form (inline for admin) ───
function SubmissionForm({ editingSubmission, onCancel, onSaved }: {
  editingSubmission: Submission | null;
  onCancel: () => void;
  onSaved: (sub: Submission) => void;
}) {
  const [loading, setLoading] = useState(false);
  const isEditing = !!editingSubmission;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    setLoading(true);
    try {
      let result;
      if (isEditing) {
        result = await updateSubmissionFull(editingSubmission.id, formData);
      } else {
        result = await createSubmission(formData);
      }
      if (result.error) { toast.error(result.error); setLoading(false); return; }
      if (isEditing) {
        onSaved({ ...editingSubmission, name: formData.get('name') as string, category: formData.get('category') as string, roll: formData.get('roll') as string, marks: formData.get('marks') as string });
      } else if ('id' in result) {
        const newSub: Submission = { id: result.id as number, name: formData.get('name') as string, category: formData.get('category') as string, roll: formData.get('roll') as string, marks: formData.get('marks') as string, admit_card_path: null, admit_card_filename: null, created_at: new Date().toISOString() };
        onSaved(newSub);
      }
      form.reset();
    } catch {
      toast.error('Failed to save');
    }
    setLoading(false);
  }

  return (
    <div className="admin-form-card">
      <h3><Pencil size={16} /> {isEditing ? `Editing #${editingSubmission.id}` : 'Add New Submission'}</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="admin-name">Full Name</label>
            <input type="text" id="admin-name" name="name" required defaultValue={editingSubmission?.name ?? ''} maxLength={200} />
          </div>
          <div className="form-group">
            <label htmlFor="admin-category">Category</label>
            <input type="text" id="admin-category" name="category" required defaultValue={editingSubmission?.category ?? ''} maxLength={100} />
          </div>
          <div className="form-group">
            <label htmlFor="admin-roll">Roll Number</label>
            <input type="text" id="admin-roll" name="roll" required defaultValue={editingSubmission?.roll ?? ''} maxLength={50} />
          </div>
          <div className="form-group">
            <label htmlFor="admin-marks">Marks</label>
            <input type="text" id="admin-marks" name="marks" required defaultValue={editingSubmission?.marks ?? ''} maxLength={20} pattern="[0-9]*\.?[0-9]*" />
          </div>
          <div className="form-group">
            <label htmlFor="admin-file">Admit Card (Optional)</label>
            <input type="file" id="admin-file" name="file" accept=".jpg,.jpeg,.png,.pdf" />
          </div>
        </div>
        <div className="form-actions-btns" style={{ marginTop: '1rem' }}>
          <button type="button" className="btn btn-outline" onClick={onCancel}><X size={14} /> Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : isEditing ? 'Update' : 'Add'} {isEditing ? <Check size={14} /> : <Plus size={14} />}</button>
        </div>
      </form>
    </div>
  );
}

// ─── Admin Users Tab ───
function AdminsTab() {
  const [users, setUsers] = useState<Omit<{ id: number; username: string; created_at: string }, 'password_hash'>[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changePassUserId, setChangePassUserId] = useState<number | null>(null);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');

  async function loadUsers() {
    try {
      const result = await getAdminUsers();
      setUsers(result as Omit<AdminUser, 'password_hash'>[]);
      setLoaded(true);
    } catch {
      toast.error('Failed to load users');
    }
  }

  if (!loaded) {
    return (
      <div className="admin-section">
        <h2 className="admin-section-title">Admin Users</h2>
        <button className="btn btn-primary btn-sm" onClick={loadUsers}><RefreshCw size={14} /> Load Users</button>
      </div>
    );
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) { toast.error('Fill in all fields'); return; }
    const result = await createAdminUser(newUsername.trim(), newPassword);
    if (result.error) { toast.error(result.error); return; }
    toast.success('User created');
    setNewUsername('');
    setNewPassword('');
    loadUsers();
  }

  async function handleDeleteUser(id: number) {
    if (!confirm('Delete this admin user?')) return;
    const result = await deleteAdminUser(id);
    if (result.error) { toast.error(result.error); return; }
    toast.success('Deleted');
    loadUsers();
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!changePassUserId || !currentPass || !newPass) { toast.error('Fill in all fields'); return; }
    const result = await changeAdminPassword(changePassUserId, currentPass, newPass);
    if (result.error) { toast.error(result.error); return; }
    toast.success('Password changed');
    setChangePassUserId(null);
    setCurrentPass('');
    setNewPass('');
  }

  return (
    <div className="admin-section">
      <h2 className="admin-section-title"><Users size={18} /> Admin Users</h2>

      <div className="admin-form-card" style={{ marginBottom: '1.5rem' }}>
        <h3><Plus size={16} /> Add New Admin</h3>
        <form onSubmit={handleCreateUser}>
          <div className="form-grid">
            <div className="form-group">
              <label>Username</label>
              <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="New username" required minLength={3} maxLength={50} />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" required minLength={4} maxLength={100} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: '0.75rem' }}><Plus size={14} /> Create User</button>
        </form>
      </div>

      {changePassUserId && (
        <div className="admin-form-card" style={{ marginBottom: '1.5rem' }}>
          <h3><Key size={16} /> Change Password for #{changePassUserId}</h3>
          <form onSubmit={handleChangePassword}>
            <div className="form-grid">
              <div className="form-group">
                <label>Current Password</label>
                <input type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} required minLength={4} />
              </div>
            </div>
            <div className="form-actions-btns" style={{ marginTop: '0.75rem' }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => { setChangePassUserId(null); setCurrentPass(''); setNewPass(''); }}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm"><Key size={14} /> Change Password</button>
            </div>
          </form>
        </div>
      )}

      <div className="table-container">
        <table className="admin-table">
          <thead><tr><th>ID</th><th>Username</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                <td>
                  <div className="table-actions">
                    <button className="icon-btn view" onClick={() => setChangePassUserId(u.id)} title="Change password"><Key size={14} /></button>
                    <button className="icon-btn delete" onClick={() => handleDeleteUser(u.id)} title="Delete user"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Settings Tab ───
function SettingsTab({ settings, setSettings }: { settings: AppSettings; setSettings: React.Dispatch<React.SetStateAction<AppSettings>> }) {
  const [loading, setLoading] = useState(false);

  async function handleToggle(field: keyof AppSettings) {
    const newValue = settings[field] === 1 ? 0 : 1;
    const result = await updateSetting(field, newValue);
    if (result.error) { toast.error(result.error); return; }
    setSettings(prev => ({ ...prev, [field]: newValue }));
    toast.success('Setting updated');
  }

  async function handleWipe() {
    if (!confirm('This will permanently delete ALL submissions and admit cards. Are you sure?')) return;
    if (!confirm('FINAL CONFIRMATION: This action cannot be undone. Delete everything?')) return;
    setLoading(true);
    const result = await wipeDatabase();
    if (result.error) { toast.error(result.error); }
    else { toast.success('Database wiped'); window.location.reload(); }
    setLoading(false);
  }

  return (
    <div className="admin-section">
      <h2 className="admin-section-title"><Settings size={18} /> Portal Settings</h2>

      <div className="admin-form-card">
        <h3>Feature Controls</h3>
        <div className="admin-settings-list">
          {([
            ['allow_submissions', 'Allow New Submissions', 'Users can submit new records'],
            ['allow_user_edits', 'Allow User Edits', 'Users can edit their own records'],
            ['allow_uploads', 'Allow Admit Card Uploads', 'Users can upload admit card files'],
          ] as const).map(([field, label, desc]) => (
            <div key={field} className="admin-setting-item" onClick={() => handleToggle(field)}>
              <div className="admin-setting-info">
                <span className="admin-setting-label">{label}</span>
                <span className="admin-setting-desc">{desc}</span>
              </div>
              {settings[field] === 1 ? <ToggleRight size={24} className="toggle-on" /> : <ToggleLeft size={24} className="toggle-off" />}
            </div>
          ))}
        </div>
      </div>

      <div className="admin-form-card danger-zone" style={{ marginTop: '1.5rem' }}>
        <h3><AlertTriangle size={16} /> Danger Zone</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          This will permanently delete all submissions, admit cards, and uploaded files. This action cannot be undone.
        </p>
        <button className="btn btn-danger btn-sm" onClick={handleWipe} disabled={loading}>
          {loading ? 'Processing...' : 'Wipe Entire Database'}
        </button>
      </div>
    </div>
  );
}

function StudentAccessTab({ submissions }: { submissions: Submission[] }) {
  return (
    <div className="admin-tab-content">
      <StudentAccessManager submissions={submissions} />
    </div>
  );
}

