'use client';

import { useState } from 'react';
import { Star, Trash2, Edit2, Copy, Check } from 'lucide-react';
import type { SavedFilter } from '@/lib/services/filters';

interface SavedFiltersManagerProps {
  filters: SavedFilter[];
  onApply: (filterId: number) => void;
  onDelete: (filterId: number) => void;
  onSetDefault: (filterId: number) => void;
  onUpdate?: (filterId: number, name: string) => void;
  onDuplicate?: (filterId: number, newName: string) => void;
}

export default function SavedFiltersManager({
  filters,
  onApply,
  onDelete,
  onSetDefault,
  onUpdate,
  onDuplicate,
}: SavedFiltersManagerProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);
  const [duplicateName, setDuplicateName] = useState('');

  const handleStartEdit = (filter: SavedFilter) => { setEditingId(filter.id); setEditName(filter.name); };
  const handleSaveEdit = () => {
    if (editingId && editName.trim() && onUpdate) {
      onUpdate(editingId, editName.trim());
      setEditingId(null);
      setEditName('');
    }
  };
  const handleCancelEdit = () => { setEditingId(null); setEditName(''); };

  const handleStartDuplicate = (filter: SavedFilter) => { setDuplicatingId(filter.id); setDuplicateName(`${filter.name} (Copy)`); };
  const handleSaveDuplicate = () => {
    if (duplicatingId && duplicateName.trim() && onDuplicate) {
      onDuplicate(duplicatingId, duplicateName.trim());
      setDuplicatingId(null);
      setDuplicateName('');
    }
  };
  const handleCancelDuplicate = () => { setDuplicatingId(null); setDuplicateName(''); };

  if (filters.length === 0) {
    return (
      <div className="admin-form-card">
        <div className="empty-state" style={{ padding: '2rem' }}>
          <p>No saved filters yet. Create one from the search panel!</p>
        </div>
      </div>
    );
  }

  const tagStyle = (bg: string, color: string) => ({
    padding: '2px 8px',
    background: bg,
    color,
    fontSize: '0.72rem',
    borderRadius: '4px',
    fontWeight: 500,
  });

  return (
    <div className="admin-form-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
        <strong>Saved Filters</strong>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Manage your saved search filters</p>
      </div>

      <div>
        {filters.map((filter) => (
          <div key={filter.id} style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingId === filter.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') handleCancelEdit(); }}
                    style={{ flex: 1 }}
                    autoFocus
                  />
                  <button onClick={handleSaveEdit} className="icon-btn" title="Save" style={{ color: 'var(--success)' }}><Check size={14} /></button>
                  <button onClick={handleCancelEdit} className="icon-btn" title="Cancel">✕</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {filter.is_default && <Star size={13} style={{ color: '#f59e0b', fill: '#f59e0b', flexShrink: 0 }} />}
                  <strong style={{ fontSize: '0.9rem' }}>{filter.name}</strong>
                </div>
              )}

              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Created: {new Date(filter.created_at).toLocaleDateString()}
                {filter.updated_at !== filter.created_at && (
                  <span style={{ marginLeft: '0.75rem' }}>Updated: {new Date(filter.updated_at).toLocaleDateString()}</span>
                )}
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.4rem' }}>
                {filter.config.query && (
                  <span style={tagStyle('rgba(59,130,246,0.1)', '#3b82f6')}>Query: {filter.config.query}</span>
                )}
                {filter.config.category && filter.config.category.length > 0 && (
                  <span style={tagStyle('rgba(139,92,246,0.1)', '#8b5cf6')}>{filter.config.category.length} categories</span>
                )}
                {(filter.config.marksMin !== undefined || filter.config.marksMax !== undefined) && (
                  <span style={tagStyle('rgba(16,185,129,0.1)', '#10b981')}>
                    Marks: {filter.config.marksMin || 0}–{filter.config.marksMax || '∞'}
                  </span>
                )}
                {(filter.config.dateFrom || filter.config.dateTo) && (
                  <span style={tagStyle('rgba(245,158,11,0.1)', '#d97706')}>Date range</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
              <button onClick={() => onApply(filter.id)} className="btn btn-primary btn-sm">Apply</button>

              {!filter.is_default && (
                <button onClick={() => onSetDefault(filter.id)} className="icon-btn" title="Set as default">
                  <Star size={14} />
                </button>
              )}

              {onUpdate && (
                <button onClick={() => handleStartEdit(filter)} className="icon-btn" title="Edit name">
                  <Edit2 size={14} />
                </button>
              )}

              {onDuplicate && (
                <button onClick={() => handleStartDuplicate(filter)} className="icon-btn" title="Duplicate">
                  <Copy size={14} />
                </button>
              )}

              <button
                onClick={() => { if (confirm(`Delete "${filter.name}"?`)) onDelete(filter.id); }}
                className="icon-btn"
                title="Delete"
                style={{ color: 'var(--danger)' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Duplicate Dialog */}
      {duplicatingId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Duplicate Filter</h3>
              <button className="icon-btn" onClick={handleCancelDuplicate}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>New Filter Name</label>
                <input
                  type="text"
                  value={duplicateName}
                  onChange={(e) => setDuplicateName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveDuplicate(); if (e.key === 'Escape') handleCancelDuplicate(); }}
                  placeholder="Enter new filter name…"
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button className="btn btn-outline" onClick={handleCancelDuplicate}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveDuplicate} disabled={!duplicateName.trim()}>Duplicate</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
