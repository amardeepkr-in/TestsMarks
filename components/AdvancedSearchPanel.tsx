'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Save, X, Calendar, TrendingUp } from 'lucide-react';
import type { AdvancedSearchFilters } from '@/lib/services/search';

interface AdvancedSearchPanelProps {
  onSearch: (filters: AdvancedSearchFilters) => void;
  onSaveFilter?: (name: string, filters: AdvancedSearchFilters) => void;
  savedFilters?: Array<{ id: number; name: string; config: AdvancedSearchFilters }>;
  categories?: string[];
}

const DEFAULT_FILTERS: AdvancedSearchFilters = {
  query: '',
  name: '',
  category: [],
  rollNumber: '',
  marksMin: undefined,
  marksMax: undefined,
  dateFrom: '',
  dateTo: '',
  admitCardStatus: 'all',
  sortBy: 'date',
  sortOrder: 'desc',
};

export default function AdvancedSearchPanel({
  onSearch,
  onSaveFilter,
  savedFilters = [],
  categories = [],
}: AdvancedSearchPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filters, setFilters] = useState<AdvancedSearchFilters>(DEFAULT_FILTERS);
  const [saveFilterName, setSaveFilterName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) { setSuggestions([]); return; }
    try {
      const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) fetchSuggestions(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchSuggestions]);

  const handleSearch = () => {
    onSearch({ ...filters, query: searchQuery });
    setShowSuggestions(false);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setFilters(DEFAULT_FILTERS);
    onSearch({});
  };

  const handleSaveFilter = () => {
    if (saveFilterName.trim() && onSaveFilter) {
      onSaveFilter(saveFilterName, { ...filters, query: searchQuery });
      setSaveFilterName('');
      setShowSaveDialog(false);
    }
  };

  const handleApplyFilter = (savedFilter: { config: AdvancedSearchFilters }) => {
    setFilters(savedFilter.config);
    setSearchQuery(savedFilter.config.query || '');
    onSearch(savedFilter.config);
  };

  const handleCategoryToggle = (category: string) => {
    const newCategories = filters.category?.includes(category)
      ? filters.category.filter(c => c !== category)
      : [...(filters.category || []), category];
    setFilters({ ...filters, category: newCategories });
  };

  return (
    <div className="admin-form-card" style={{ marginBottom: '1.5rem' }}>
      {/* Search Bar */}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by name, roll number, or category…"
              style={{ width: '100%', paddingLeft: '2.25rem' }}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div style={{ position: 'absolute', zIndex: 20, width: '100%', marginTop: '2px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', maxHeight: '14rem', overflowY: 'auto' }}>
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onMouseDown={() => { setSearchQuery(suggestion); setShowSuggestions(false); handleSearch(); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 1rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={handleSearch} className="btn btn-primary">Search</button>
          <button onClick={() => setShowAdvanced(!showAdvanced)} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Filter size={14} /> {showAdvanced ? 'Hide' : 'Filters'}
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
          <div className="form-grid">
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={filters.name || ''} onChange={(e) => setFilters({ ...filters, name: e.target.value })} placeholder="Filter by name…" />
            </div>
            <div className="form-group">
              <label>Roll Number</label>
              <input type="text" value={filters.rollNumber || ''} onChange={(e) => setFilters({ ...filters, rollNumber: e.target.value })} placeholder="Filter by roll number…" />
            </div>
            <div className="form-group">
              <label>Admit Card Status</label>
              <select value={filters.admitCardStatus || 'all'} onChange={(e) => setFilters({ ...filters, admitCardStatus: e.target.value as AdvancedSearchFilters['admitCardStatus'] })}>
                <option value="all">All</option>
                <option value="uploaded">Uploaded</option>
                <option value="not_uploaded">Not Uploaded</option>
              </select>
            </div>
            <div className="form-group">
              <label>Marks (Min)</label>
              <input type="number" value={filters.marksMin ?? ''} onChange={(e) => setFilters({ ...filters, marksMin: e.target.value ? Number(e.target.value) : undefined })} placeholder="Min marks…" />
            </div>
            <div className="form-group">
              <label>Marks (Max)</label>
              <input type="number" value={filters.marksMax ?? ''} onChange={(e) => setFilters({ ...filters, marksMax: e.target.value ? Number(e.target.value) : undefined })} placeholder="Max marks…" />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Calendar size={13} /> Date From</label>
              <input type="date" value={filters.dateFrom || ''} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Calendar size={13} /> Date To</label>
              <input type="date" value={filters.dateTo || ''} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><TrendingUp size={13} /> Sort By</label>
              <select value={filters.sortBy || 'date'} onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as AdvancedSearchFilters['sortBy'] })}>
                <option value="date">Date</option>
                <option value="marks">Marks</option>
                <option value="name">Name</option>
                <option value="roll">Roll Number</option>
              </select>
            </div>
            <div className="form-group">
              <label>Sort Order</label>
              <select value={filters.sortOrder || 'desc'} onChange={(e) => setFilters({ ...filters, sortOrder: e.target.value as AdvancedSearchFilters['sortOrder'] })}>
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>

          {/* Categories */}
          {categories.length > 0 && (
            <div className="form-group" style={{ marginTop: '0.75rem' }}>
              <label>Categories</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.35rem' }}>
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleCategoryToggle(category)}
                    className={filters.category?.includes(category) ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button onClick={handleSearch} className="btn btn-primary">Apply Filters</button>
            <button onClick={handleClearFilters} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <X size={14} /> Clear All
            </button>
            {onSaveFilter && (
              <button onClick={() => setShowSaveDialog(true)} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Save size={14} /> Save Filter
              </button>
            )}
          </div>

          {/* Saved Filters */}
          {savedFilters.length > 0 && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Saved Filters</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {savedFilters.map((filter) => (
                  <button key={filter.id} type="button" onClick={() => handleApplyFilter(filter)} className="btn btn-outline btn-sm">
                    {filter.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save Filter Dialog */}
      {showSaveDialog && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Save Filter</h3>
              <button className="icon-btn" onClick={() => { setShowSaveDialog(false); setSaveFilterName(''); }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Filter Name</label>
                <input
                  type="text"
                  value={saveFilterName}
                  onChange={(e) => setSaveFilterName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveFilter()}
                  placeholder="Enter filter name…"
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button className="btn btn-outline" onClick={() => { setShowSaveDialog(false); setSaveFilterName(''); }}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveFilter} disabled={!saveFilterName.trim()}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
