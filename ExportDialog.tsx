'use client';

import { useState } from 'react';
import { X, Download } from 'lucide-react';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds?: number[];
  categories?: string[];
}

export default function ExportDialog({ isOpen, onClose, selectedIds = [], categories = [] }: ExportDialogProps) {
  const [format, setFormat] = useState<'excel' | 'pdf' | 'json'>('excel');
  const [exportType, setExportType] = useState<'all' | 'filtered' | 'selected'>('all');
  const [pdfType, setPdfType] = useState<'admit-card' | 'mark-sheet' | 'report' | 'bulk-admit-cards'>('report');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [category, setCategory] = useState('');
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();

      if (exportType === 'filtered') {
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (category) params.append('category', category);
      } else if (exportType === 'selected' && selectedIds.length > 0) {
        params.append('ids', selectedIds.join(','));
      }

      let url = '';
      let filename = '';

      if (format === 'excel') {
        url = `/api/export/excel?${params.toString()}`;
        filename = `export-${Date.now()}.xlsx`;
      } else if (format === 'json') {
        url = `/api/export/json?${params.toString()}`;
        filename = `export-${Date.now()}.json`;
      } else if (format === 'pdf') {
        params.append('type', pdfType);
        url = `/api/export/pdf?${params.toString()}`;
        filename = `export-${pdfType}-${Date.now()}.pdf`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
        onClose();
      } else {
        alert('Export failed. Please try again.');
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '560px' }}>
        {/* Header */}
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={18} /> Export Data
          </h3>
          <button className="icon-btn" onClick={onClose} disabled={exporting}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Format selector */}
          <div className="form-group">
            <label>Export Format</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {(['excel', 'pdf', 'json'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  style={{
                    padding: '0.75rem',
                    border: `1px solid ${format === fmt ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: '8px',
                    background: format === fmt ? 'hsla(238,81%,71%,0.12)' : 'transparent',
                    color: format === fmt ? 'var(--primary)' : 'var(--foreground)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontWeight: format === fmt ? 600 : 400,
                    fontSize: '0.9rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{fmt.toUpperCase()}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {fmt === 'excel' ? '.xlsx' : fmt === 'pdf' ? '.pdf' : '.json'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* PDF sub-type */}
          {format === 'pdf' && (
            <div className="form-group">
              <label>PDF Type</label>
              <select value={pdfType} onChange={(e) => setPdfType(e.target.value as typeof pdfType)}>
                <option value="report">Full Report</option>
                <option value="admit-card">Admit Card (Single)</option>
                <option value="mark-sheet">Mark Sheet (Single)</option>
                <option value="bulk-admit-cards">Bulk Admit Cards</option>
              </select>
            </div>
          )}

          {/* Export type */}
          <div className="form-group">
            <label>Export Type</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {[
                { value: 'all', label: 'All Submissions' },
                { value: 'filtered', label: 'Filtered Submissions' },
                ...(selectedIds.length > 0 ? [{ value: 'selected', label: `Selected (${selectedIds.length})` }] : []),
              ].map(({ value, label }) => (
                <label key={value} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="radio"
                    value={value}
                    checked={exportType === value}
                    onChange={(e) => setExportType(e.target.value as typeof exportType)}
                    style={{ display: 'inline', width: 'auto', padding: 0 }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Date / category filters */}
          {exportType === 'filtered' && (
            <div className="form-card" style={{ padding: '1rem', gap: '0.75rem', display: 'flex', flexDirection: 'column' }}>
              <strong style={{ fontSize: '0.85rem' }}>Filters</strong>
              <div className="form-grid">
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Spinner */}
          {exporting && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '0.5rem 0' }}>
              <div className="loading-spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Exporting…</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-outline" onClick={onClose} disabled={exporting}>Cancel</button>
          <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
