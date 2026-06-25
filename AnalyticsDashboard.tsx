'use client';

import { useState, useEffect } from 'react';
import CategoryPieChart from './charts/CategoryPieChart';
import MarksBarChart from './charts/MarksBarChart';
import TimeSeriesChart from './charts/TimeSeriesChart';
import PerformanceChart from './charts/PerformanceChart';

interface AnalyticsData {
  categoryDistribution: Array<{ name: string; value: number }>;
  marksDistribution: Array<{ range: string; count: number }>;
  timeSeriesData: Array<{ date: string; count: number; avgMarks: number }>;
  topPerformers: Array<{ name: string; roll: string; marks: number }>;
  categoryPerformance: Array<{ category: string; avg: number; min: number; max: number; count: number }>;
  passFailStats: { passed: number; failed: number; passRate: number };
  gradeDistribution: Array<{ grade: string; count: number }>;
}

export default function AnalyticsDashboard() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (category) params.append('category', category);

      const response = await fetch(`/api/analytics?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data);
        if (data.categoryDistribution) {
          setCategories(data.categoryDistribution.map((c: { name: string }) => c.name));
        }
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = async (format: 'excel' | 'pdf' | 'json') => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (category) params.append('category', category);

      const url = format === 'excel'
        ? `/api/export/excel?${params}`
        : format === 'json'
        ? `/api/export/json?${params}`
        : `/api/export/pdf?${params}`;

      const ext = format === 'excel' ? 'xlsx' : format;
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `analytics-${format}-${Date.now()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="empty-state" style={{ height: '16rem' }}>
        <div className="loading-spinner" />
        <p>Loading analytics…</p>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="empty-state" style={{ height: '16rem' }}>
        <p>No analytics data available.</p>
      </div>
    );
  }

  const totalSubmissions = analyticsData.categoryDistribution.reduce((sum, c) => sum + c.value, 0);
  const avgMarks = analyticsData.categoryPerformance.length > 0 && totalSubmissions > 0
    ? analyticsData.categoryPerformance.reduce((sum, c) => sum + c.avg * c.count, 0) / totalSubmissions
    : 0;
  const highestMarks = analyticsData.topPerformers.length > 0 ? analyticsData.topPerformers[0].marks : 0;

  return (
    <div className="admin-section">
      {/* Filters */}
      <div className="admin-form-card">
        <h3>Filters</h3>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
          <div className="form-group">
            <label>Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
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
          <div className="form-group" style={{ justifyContent: 'flex-end' }}>
            <label style={{ visibility: 'hidden' }}>_</label>
            <button className="btn btn-primary btn-sm btn-full" onClick={fetchAnalytics}>Refresh</button>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="admin-stats-grid">
        {[
          { label: 'Total Submissions', value: totalSubmissions },
          { label: 'Average Marks', value: avgMarks.toFixed(2) },
          { label: 'Highest Marks', value: highestMarks },
          { label: 'Pass Rate', value: `${analyticsData.passFailStats.passRate.toFixed(1)}%` },
        ].map(({ label, value }) => (
          <div key={label} className="admin-stat-card">
            <div className="admin-stat-info">
              <span className="admin-stat-value">{value}</span>
              <span className="admin-stat-label">{label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Export buttons */}
      <div className="admin-form-card">
        <h3>Export Data</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button className="btn btn-outline btn-sm" onClick={() => handleExport('excel')}>Export to Excel</button>
          <button className="btn btn-outline btn-sm" onClick={() => handleExport('pdf')}>Export to PDF</button>
          <button className="btn btn-outline btn-sm" onClick={() => handleExport('json')}>Export to JSON</button>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
        <div className="admin-form-card"><h3>Category Distribution</h3><CategoryPieChart data={analyticsData.categoryDistribution} /></div>
        <div className="admin-form-card"><h3>Marks Distribution</h3><MarksBarChart data={analyticsData.marksDistribution} /></div>
        <div className="admin-form-card" style={{ gridColumn: '1 / -1' }}><h3>Submissions Over Time (Last 30 Days)</h3><TimeSeriesChart data={analyticsData.timeSeriesData} /></div>
        <div className="admin-form-card" style={{ gridColumn: '1 / -1' }}><h3>Category Performance</h3><PerformanceChart data={analyticsData.categoryPerformance} /></div>
      </div>

      {/* Top performers */}
      <div className="admin-form-card">
        <h3>Top 10 Performers</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>Roll Number</th>
                <th>Marks</th>
              </tr>
            </thead>
            <tbody>
              {analyticsData.topPerformers.map((performer, index) => (
                <tr key={index}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>#{index + 1}</td>
                  <td>{performer.name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{performer.roll}</td>
                  <td style={{ fontWeight: 700 }}>{performer.marks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grade distribution */}
      <div className="admin-form-card">
        <h3>Grade Distribution</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '0.75rem' }}>
          {analyticsData.gradeDistribution.map((grade) => (
            <div key={grade.grade} className="stat-card" style={{ textAlign: 'center', padding: '0.75rem' }}>
              <span className="stat-value" style={{ fontSize: '1.4rem' }}>{grade.grade}</span>
              <span className="stat-label" style={{ fontSize: '0.75rem' }}>{grade.count} students</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
