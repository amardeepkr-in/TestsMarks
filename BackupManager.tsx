'use client';

import { useState, useEffect } from 'react';
import { Database, Download, RotateCcw, Trash2, Plus, CheckCircle, AlertTriangle } from 'lucide-react';

interface BackupInfo {
  id: number;
  filename: string;
  size: number;
  created_at: string;
  created_by: string;
}

export default function BackupManager() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/backup');
      if (response.ok) {
        const data = await response.json();
        setBackups(data);
      }
    } catch (error) {
      console.error('Failed to fetch backups:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBackups(); }, []);

  const handleCreateBackup = async () => {
    if (!confirm('Create a new backup? This may take a few moments.')) return;
    setCreating(true);
    try {
      const response = await fetch('/api/backup', { method: 'POST' });
      if (response.ok) {
        alert('Backup created successfully!');
        fetchBackups();
      } else {
        alert('Failed to create backup. Please try again.');
      }
    } catch (error) {
      console.error('Backup creation failed:', error);
      alert('Failed to create backup. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleRestoreBackup = async (backupId: number) => {
    if (!confirm('WARNING: Restoring a backup will replace all current data. This action cannot be undone. Are you sure?')) return;
    setRestoring(backupId);
    try {
      const response = await fetch(`/api/backup/${backupId}/restore`, { method: 'POST' });
      if (response.ok) {
        alert('Backup restored successfully! The page will reload.');
        window.location.reload();
      } else {
        alert('Failed to restore backup. Please try again.');
      }
    } catch (error) {
      console.error('Backup restore failed:', error);
      alert('Failed to restore backup. Please try again.');
    } finally {
      setRestoring(null);
    }
  };

  const handleDeleteBackup = async (backupId: number) => {
    if (!confirm('Delete this backup? This action cannot be undone.')) return;
    try {
      const response = await fetch(`/api/backup/${backupId}`, { method: 'DELETE' });
      if (response.ok) {
        fetchBackups();
      } else {
        alert('Failed to delete backup. Please try again.');
      }
    } catch (error) {
      console.error('Backup deletion failed:', error);
      alert('Failed to delete backup. Please try again.');
    }
  };

  const handleDownloadBackup = async (backupId: number, filename: string) => {
    try {
      const response = await fetch(`/api/backup/${backupId}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to download backup.');
      }
    } catch (error) {
      console.error('Backup download failed:', error);
      alert('Failed to download backup.');
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <div className="empty-state" style={{ height: '12rem' }}>
        <div className="loading-spinner" />
        <p>Loading backups…</p>
      </div>
    );
  }

  return (
    <div className="admin-section">
      {/* Header row */}
      <div className="admin-section-header">
        <div>
          <h2 className="admin-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={20} /> Backup Management
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Create, restore, and manage database backups
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleCreateBackup} disabled={creating}>
          <Plus size={14} /> {creating ? 'Creating…' : 'Create Backup'}
        </button>
      </div>

      {/* Last backup banner */}
      {backups.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.75rem 1rem', borderRadius: '10px',
          background: 'hsla(160,84%,39%,0.08)', border: '1px solid hsla(160,84%,39%,0.25)',
        }}>
          <CheckCircle size={16} style={{ color: '#10b981', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Last Backup</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {new Date(backups[0].created_at).toLocaleString()} by {backups[0].created_by}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="admin-form-card" style={{ padding: 0, overflow: 'hidden' }}>
        {backups.length === 0 ? (
          <div className="empty-state" style={{ padding: '2.5rem' }}>
            <Database size={36} style={{ color: 'var(--text-muted)' }} />
            <p>No backups available.</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Create your first backup to get started.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Size</th>
                  <th>Created</th>
                  <th>Created By</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{backup.filename}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{formatSize(backup.size)}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {new Date(backup.created_at).toLocaleString()}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{backup.created_by}</td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem' }}>
                        <button
                          className="icon-btn download"
                          title="Download"
                          onClick={() => handleDownloadBackup(backup.id, backup.filename)}
                        >
                          <Download size={15} />
                        </button>
                        <button
                          className="icon-btn view"
                          title="Restore"
                          disabled={restoring !== null}
                          onClick={() => handleRestoreBackup(backup.id)}
                        >
                          <RotateCcw size={15} />
                        </button>
                        <button
                          className="icon-btn delete"
                          title="Delete"
                          onClick={() => handleDeleteBackup(backup.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Warning notice */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
        padding: '0.9rem 1rem', borderRadius: '10px',
        background: 'hsla(38,92%,50%,0.08)', border: '1px solid hsla(38,92%,50%,0.25)',
      }}>
        <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
          <strong style={{ color: 'var(--foreground)' }}>Important:</strong> Restoring a backup will replace all current data.
          Always create a new backup before restoring to ensure you can recover if needed.
        </p>
      </div>
    </div>
  );
}
