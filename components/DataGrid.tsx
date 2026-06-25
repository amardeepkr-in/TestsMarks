'use client'

import { useState, useMemo, useCallback, useRef } from 'react';
import { Submission } from '../lib/types';
import { deleteSubmission, updateSubmission, uploadAdmitCard, deleteAdmitCard } from '../lib/actions';
import { Download, Eye, Trash2, Check, X, Upload, ChevronLeft, ChevronRight, FileText, Printer, CheckSquare, Square, Filter, Pencil } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf'];

function SortHeader({ field, children, sortConfig, onSort }: {
  field: string;
  children: React.ReactNode;
  sortConfig: { key: string; direction: 'asc' | 'desc' };
  onSort: (field: string) => void;
}) {
  return (
    <th onClick={() => onSort(field)} className="sortable-th" title={`Sort by ${children}`}>
      {children}
      {sortConfig.key === field && (
        <span className="sort-indicator">{sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}</span>
      )}
    </th>
  );
}

export default function DataGrid({ initialSubmissions, onEdit }: { initialSubmissions: Submission[]; onEdit?: (submission: Submission) => void }) {
  const [data, setData] = useState<Submission[]>(initialSubmissions);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'id', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [previewFile, setPreviewFile] = useState<{ url: string; type: string; name: string } | null>(null);
  const [marksMin, setMarksMin] = useState('');
  const [marksMax, setMarksMax] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const categories = useMemo(() => {
    const cats = new Set(data.map(s => s.category));
    return Array.from(cats).sort();
  }, [data]);

  const filtered = useMemo(() => {
    let result = data;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(sub =>
        sub.name.toLowerCase().includes(lower) ||
        sub.category.toLowerCase().includes(lower) ||
        sub.roll.toLowerCase().includes(lower) ||
        sub.marks.toString().includes(lower)
      );
    }
    if (categoryFilter) {
      result = result.filter(sub => sub.category === categoryFilter);
    }
    if (marksMin) {
      const min = parseFloat(marksMin);
      if (!isNaN(min)) {
        result = result.filter(sub => {
          const m = parseFloat(sub.marks);
          return !isNaN(m) && m >= min;
        });
      }
    }
    if (marksMax) {
      const max = parseFloat(marksMax);
      if (!isNaN(max)) {
        result = result.filter(sub => {
          const m = parseFloat(sub.marks);
          return !isNaN(m) && m <= max;
        });
      }
    }
    return result;
  }, [data, searchTerm, categoryFilter, marksMin, marksMax]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    items.sort((a, b) => {
      const aVal = a[sortConfig.key as keyof Submission] ?? '';
      const bVal = b[sortConfig.key as keyof Submission] ?? '';
      const aNum = parseFloat(String(aVal));
      const bNum = parseFloat(String(bVal));
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }
      return sortConfig.direction === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    return items;
  }, [filtered, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const isAllSelected = page.length > 0 && page.every(sub => selectedIds.has(sub.id));
  const isSomeSelected = page.some(sub => selectedIds.has(sub.id));

  const handleSort = useCallback((key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        page.forEach(sub => next.delete(sub.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        page.forEach(sub => next.add(sub.id));
        return next;
      });
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected submission(s)? This cannot be undone.`)) return;
    setDeleting(true);
    let deleted = 0;
    for (const id of selectedIds) {
      const result = await deleteSubmission(id);
      if (result.success) deleted++;
    }
    if (deleted > 0) {
      setData(prev => prev.filter(sub => !selectedIds.has(sub.id)));
      setSelectedIds(new Set());
      toast.success(`Deleted ${deleted} submission(s)`);
    }
    setDeleting(false);
  };

  const handleExportCSV = () => {
    const rows = sorted.map(sub => ({
      ID: sub.id,
      Name: sub.name,
      Category: sub.category,
      Roll: sub.roll,
      Marks: sub.marks,
      'Admit Card': sub.admit_card_filename || '',
      'Created At': sub.created_at,
    }));
    if (rows.length === 0) {
      toast.error('No data to export');
      return;
    }
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${String(r[h as keyof typeof r] ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `submissions-filtered-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} records`);
  };

  const handleEdit = (id: number, field: string, currentValue: string) => {
    setEditingId(id);
    setEditField(field);
    setEditValue(currentValue);
  };

  const handleSave = async () => {
    if (editingId && editField) {
      const result = await updateSubmission(editingId, editField, editValue);
      if (result.error) {
        toast.error(result.error);
      } else {
        setData(prev => prev.map(sub =>
          sub.id === editingId ? { ...sub, [editField]: editValue } : sub
        ));
        toast.success('Updated successfully');
      }
    }
    setEditingId(null);
    setEditField(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditField(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this submission?')) return;
    const result = await deleteSubmission(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      setData(prev => prev.filter(sub => sub.id !== id));
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      toast.success('Deleted successfully');
    }
  };

  const handleAdmitCardUpload = async (id: number, file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error('Only JPG, PNG, or PDF files are allowed');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10MB');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    const result = await uploadAdmitCard(id, formData);
    if (result.error) {
      toast.error(result.error);
    } else {
      setData(prev => prev.map(sub =>
        sub.id === id ? { ...sub, admit_card_path: `/uploads/${file.name}`, admit_card_filename: file.name } : sub
      ));
      toast.success('Admit card uploaded!');
      router.refresh();
    }
  };

  const handleAdmitCardDelete = async (id: number) => {
    const result = await deleteAdmitCard(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      setData(prev => prev.map(sub =>
        sub.id === id ? { ...sub, admit_card_path: null, admit_card_filename: null } : sub
      ));
      toast.success('Admit card deleted');
    }
  };

  const handlePrintAdmitCard = (sub: Submission) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocked — please allow pop-ups');
      return;
    }
    const imgSrc = sub.admit_card_path || '';
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admit Card - ${sub.name}</title>
        <style>
          body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
          .card { background: white; padding: 2rem; border: 2px solid #333; border-radius: 8px; max-width: 600px; width: 100%; }
          h1 { text-align: center; font-size: 1.5rem; margin-bottom: 1rem; border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
          .info { margin: 0.5rem 0; font-size: 1.1rem; }
          .info strong { display: inline-block; width: 120px; }
          .photo { text-align: center; margin: 1.5rem 0; }
          .photo img { max-width: 200px; border: 1px solid #ccc; }
          .footer { margin-top: 2rem; text-align: center; font-size: 0.9rem; color: #666; }
          @media print { body { background: white; } }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>ADMIT CARD</h1>
          <div class="info"><strong>Name:</strong> ${sub.name}</div>
          <div class="info"><strong>Roll No:</strong> ${sub.roll}</div>
          <div class="info"><strong>Category:</strong> ${sub.category}</div>
          <div class="info"><strong>Marks:</strong> ${sub.marks}</div>
          ${imgSrc ? `<div class="photo"><img src="${imgSrc}" alt="Photo" /></div>` : ''}
          <div class="footer">Generated from Marks & Admit Card Portal</div>
        </div>
        <script>window.onload = () => { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const renderCell = (sub: Submission, field: string) => {
    const isEditing = editingId === sub.id && editField === field;
    if (isEditing) {
      return (
        <div className="edit-cell">
          <input
            type="text"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
            autoFocus
            className="inline-edit-input"
          />
          <button className="icon-btn save" onClick={handleSave}><Check size={14} /></button>
          <button className="icon-btn cancel" onClick={handleCancel}><X size={14} /></button>
        </div>
      );
    }
    const value = sub[field as keyof Submission];
    return (
      <span className="cell-content" onClick={() => handleEdit(sub.id, field, String(value ?? ''))} title="Click to edit">
        {String(value ?? '')}
      </span>
    );
  };

  return (
    <div className="data-grid-wrapper">
      <div className="grid-controls">
        <input
          type="text"
          placeholder="Search by name, roll, category, or marks..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          className="search-input"
        />
        <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setCurrentPage(1); }}>
          <option value="">All Categories</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <div className="marks-range-filter">
          <input
            type="number"
            placeholder="Min"
            value={marksMin}
            onChange={e => { setMarksMin(e.target.value); setCurrentPage(1); }}
            className="marks-range-input"
            min="0"
          />
          <span>—</span>
          <input
            type="number"
            placeholder="Max"
            value={marksMax}
            onChange={e => { setMarksMax(e.target.value); setCurrentPage(1); }}
            className="marks-range-input"
            min="0"
          />
        </div>
      </div>

      {(selectedIds.size > 0 || sorted.length > 0) && (
        <div className="bulk-actions">
          {selectedIds.size > 0 && (
            <span className="selected-count">{selectedIds.size} selected</span>
          )}
          <button className="btn btn-outline btn-sm" onClick={handleExportCSV} title="Export filtered results as CSV">
            <Download size={14} /> Export CSV
          </button>
          {selectedIds.size > 0 && (
            <button className="btn btn-danger btn-sm" onClick={handleBulkDelete} disabled={deleting}>
              <Trash2 size={14} /> {deleting ? 'Deleting...' : `Delete ${selectedIds.size}`}
            </button>
          )}
        </div>
      )}

      <div className="table-container">
        <table className="data-grid">
          <thead>
            <tr>
              <th className="select-th" onClick={handleToggleSelectAll} title="Select all on this page">
                {isAllSelected ? <CheckSquare size={16} /> : isSomeSelected ? <Square size={16} className="partial-check" /> : <Square size={16} />}
              </th>
              <th>#</th>
              <SortHeader field="name" sortConfig={sortConfig} onSort={handleSort}>Name</SortHeader>
              <SortHeader field="category" sortConfig={sortConfig} onSort={handleSort}>Category</SortHeader>
              <SortHeader field="roll" sortConfig={sortConfig} onSort={handleSort}>Roll Number</SortHeader>
              <SortHeader field="marks" sortConfig={sortConfig} onSort={handleSort}>Marks</SortHeader>
              <th>Admit Card</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {page.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-state">
                  <Filter size={32} />
                  <span>No submissions found</span>
                </td>
              </tr>
            ) : (
              page.map((sub) => (
                <tr key={sub.id} className={selectedIds.has(sub.id) ? 'row-selected' : ''}>
                  <td className="select-cell" onClick={() => handleToggleSelect(sub.id)}>
                    {selectedIds.has(sub.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                  </td>
                  <td className="id-cell">{sub.id}</td>
                  <td>{renderCell(sub, 'name')}</td>
                  <td>{renderCell(sub, 'category')}</td>
                  <td>{renderCell(sub, 'roll')}</td>
                  <td>{renderCell(sub, 'marks')}</td>
                  <td className="admit-cell">
                    {sub.admit_card_path ? (
                      <div className="admit-card-actions">
                        <button
                          className="icon-btn view"
                          onClick={() => setPreviewFile({ url: sub.admit_card_path!, type: sub.admit_card_filename?.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg', name: sub.admit_card_filename || 'Admit Card' })}
                          title="View admit card"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="icon-btn print"
                          onClick={() => handlePrintAdmitCard(sub)}
                          title="Print admit card"
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          className="icon-btn download"
                          onClick={() => {
                            const a = document.createElement('a');
                            a.href = sub.admit_card_path!;
                            a.download = sub.admit_card_filename || 'admit_card';
                            a.click();
                          }}
                          title="Download admit card"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          className="icon-btn cancel"
                          onClick={() => handleAdmitCardDelete(sub.id)}
                          title="Delete admit card"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="upload-cell">
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => fileInputRefs.current[sub.id]?.click()}
                          title="Upload admit card"
                        >
                          <Upload size={14} /> Upload
                        </button>
                        <input
                          ref={el => { fileInputRefs.current[sub.id] = el; }}
                          type="file"
                          accept=".jpg,.jpeg,.png,.pdf"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleAdmitCardUpload(sub.id, file);
                            e.target.value = '';
                          }}
                        />
                      </div>
                    )}
                  </td>
                  <td className="actions-cell">
                    {onEdit && (
                      <button className="icon-btn view" onClick={() => onEdit(sub)} title="Edit record">
                        <Pencil size={16} />
                      </button>
                    )}
                    <button className="icon-btn delete" onClick={() => handleDelete(sub.id)} title="Delete submission">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {previewFile && (
        <div className="modal-overlay" onClick={() => setPreviewFile(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><FileText size={18} /> {previewFile.name}</h3>
              <button className="icon-btn cancel" onClick={() => setPreviewFile(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {previewFile.type === 'application/pdf' ? (
                <iframe src={previewFile.url} style={{ width: '100%', height: '70vh', border: 'none' }} title="PDF Preview" />
              ) : (
                <Image src={previewFile.url} alt="Admit Card Preview" width={800} height={600} unoptimized style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
              )}
            </div>
          </div>
        </div>
      )}

      <div className="pagination">
        <div className="page-size-selector">
          <label>Show</label>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}>
            {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <label>per page</label>
        </div>
        <div className="page-info">
          Showing {sorted.length === 0 ? 0 : Math.min((currentPage - 1) * pageSize + 1, sorted.length)} to {Math.min(currentPage * pageSize, sorted.length)} of {sorted.length} records
        </div>
        <div className="page-buttons">
          <button className="icon-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
            const p = startPage + i;
            if (p > totalPages) return null;
            return (
              <button
                key={p}
                className={`page-btn ${currentPage === p ? 'active' : ''}`}
                onClick={() => setCurrentPage(p)}
              >
                {p}
              </button>
            );
          })}
          <button className="icon-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
        </div>
      </div>
    </div>
  );
}

