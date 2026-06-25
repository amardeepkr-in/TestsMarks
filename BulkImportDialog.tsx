'use client';

import { useState } from 'react';
import { X, Upload, CheckCircle, AlertCircle, SkipForward } from 'lucide-react';

interface ImportRecord {
  name: string;
  category: string;
  roll: string;
  marks: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportSummary {
  success: number;
  failed: number;
  skipped: number;
  errors: ValidationError[];
}

interface BulkImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function BulkImportDialog({ isOpen, onClose, onImportComplete }: BulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportRecord[]>([]);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [sendNotifications, setSendNotifications] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setSummary(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('preview', 'true');
      const response = await fetch('/api/import', { method: 'POST', body: formData });
      if (response.ok) {
        const data = await response.json();
        setPreview(data.preview || []);
      }
    } catch (error) {
      console.error('Failed to preview file:', error);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setSummary(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('skipDuplicates', String(skipDuplicates));
      formData.append('updateExisting', String(updateExisting));
      formData.append('sendNotifications', String(sendNotifications));
      const response = await fetch('/api/import', { method: 'POST', body: formData });
      if (response.ok) {
        const result = await response.json();
        setSummary(result);
        if (result.success > 0) onImportComplete();
      } else {
        alert('Import failed. Please try again.');
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setSummary(null);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '680px', maxHeight: '90vh' }}>
        {/* Header */}
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Upload size={18} /> Bulk Import Submissions
          </h3>
          <button className="icon-btn" onClick={handleClose} disabled={importing}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* File picker */}
          <div className="form-group">
            <label>Upload CSV or Excel File</label>
            <label
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.5rem', padding: '1.5rem',
                border: '2px dashed var(--border)', borderRadius: '10px',
                cursor: importing ? 'not-allowed' : 'pointer',
                color: 'var(--text-muted)', fontSize: '0.9rem',
                background: 'var(--surface)', transition: 'border-color 0.2s ease',
              }}
            >
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                disabled={importing}
              />
              <Upload size={16} />
              {file ? file.name : 'Click to select a .csv or .xlsx file'}
            </label>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Required columns: <code>name</code>, <code>category</code>, <code>roll</code>, <code>marks</code>
            </span>
          </div>

          {/* Options */}
          <div className="form-group">
            <label>Import Options</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {[
                { state: skipDuplicates, set: setSkipDuplicates, label: 'Skip duplicate roll numbers' },
                { state: updateExisting, set: setUpdateExisting, label: 'Update existing records' },
                { state: sendNotifications, set: setSendNotifications, label: 'Send notifications (if configured)' },
              ].map(({ state, set, label }) => (
                <label key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={state}
                    onChange={(e) => set(e.target.checked)}
                    disabled={importing}
                    style={{ display: 'inline', width: 'auto', padding: 0 }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Preview table */}
          {preview.length > 0 && !summary && (
            <div className="form-group">
              <label>Preview (first {Math.min(10, preview.length)} of {preview.length} rows)</label>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <table className="admin-table" style={{ margin: 0 }}>
                  <thead>
                    <tr><th>Name</th><th>Category</th><th>Roll</th><th>Marks</th></tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((record, index) => (
                      <tr key={index}>
                        <td>{record.name}</td>
                        <td>{record.category}</td>
                        <td style={{ fontFamily: 'monospace' }}>{record.roll}</td>
                        <td>{record.marks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.length > 10 && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  … and {preview.length - 10} more rows
                </span>
              )}
            </div>
          )}

          {/* Summary */}
          {summary && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <strong style={{ fontSize: '0.9rem' }}>Import Summary</strong>
              <div className="stats-grid">
                {[
                  { icon: <CheckCircle size={20} style={{ color: '#10b981' }} />, value: summary.success, label: 'Successful', color: '#10b981' },
                  { icon: <SkipForward size={20} style={{ color: '#f59e0b' }} />, value: summary.skipped, label: 'Skipped', color: '#f59e0b' },
                  { icon: <AlertCircle size={20} style={{ color: 'var(--danger)' }} />, value: summary.failed, label: 'Failed', color: 'var(--danger)' },
                ].map(({ icon, value, label, color }) => (
                  <div key={label} className="stat-card">
                    {icon}
                    <span className="stat-value" style={{ fontSize: '1.4rem', color }}>{value}</span>
                    <span className="stat-label">{label}</span>
                  </div>
                ))}
              </div>

              {summary.errors.length > 0 && (
                <div style={{
                  maxHeight: '160px', overflowY: 'auto', padding: '0.75rem',
                  background: 'hsla(348,83%,47%,0.06)', borderRadius: '8px',
                  border: '1px solid hsla(348,83%,47%,0.2)',
                }}>
                  <strong style={{ fontSize: '0.82rem', color: 'var(--danger)' }}>Errors:</strong>
                  {summary.errors.map((error, index) => (
                    <div key={index} style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '0.25rem' }}>
                      Row {error.row}, {error.field}: {error.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Spinner */}
          {importing && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
              <div className="loading-spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Importing…</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-outline" onClick={handleClose} disabled={importing}>
            {summary ? 'Close' : 'Cancel'}
          </button>
          {!summary && (
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={!file || importing}
            >
              {importing ? 'Importing…' : 'Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
