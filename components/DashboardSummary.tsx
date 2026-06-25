import { FileText, FileCheck, FileX, Hash, TrendingUp, TrendingDown, BarChart3, Award } from 'lucide-react';
import { DashboardStats } from '../lib/types';

export default function DashboardSummary({ stats }: { stats: DashboardStats }) {
  return (
    <div className="stats-grid">
      <div className="stat-card" style={{ '--primary': '#3b82f6' } as React.CSSProperties}>
        <span className="stat-label">
          <div className="icon-wrapper" style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.15)', padding: '6px', borderRadius: '8px' }}><FileText size={16} /></div>
          Total Records
        </span>
        <span className="stat-value">{stats.total}</span>
      </div>
      <div className="stat-card" style={{ '--primary': '#10b981' } as React.CSSProperties}>
        <span className="stat-label">
          <div className="icon-wrapper" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '6px', borderRadius: '8px' }}><FileCheck size={16} /></div>
          With Admit Card
        </span>
        <span className="stat-value">{stats.withAdmitCard}</span>
      </div>
      <div className="stat-card" style={{ '--primary': '#f43f5e' } as React.CSSProperties}>
        <span className="stat-label">
          <div className="icon-wrapper" style={{ color: '#f43f5e', background: 'rgba(244, 63, 94, 0.15)', padding: '6px', borderRadius: '8px' }}><FileX size={16} /></div>
          Without Admit Card
        </span>
        <span className="stat-value">{stats.withoutAdmitCard}</span>
      </div>
      <div className="stat-card" style={{ '--primary': '#8b5cf6' } as React.CSSProperties}>
        <span className="stat-label">
          <div className="icon-wrapper" style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.15)', padding: '6px', borderRadius: '8px' }}><TrendingUp size={16} /></div>
          Highest Marks
        </span>
        <span className="stat-value">{stats.highestMarks ?? '—'}</span>
      </div>
      <div className="stat-card" style={{ '--primary': '#06b6d4' } as React.CSSProperties}>
        <span className="stat-label">
          <div className="icon-wrapper" style={{ color: '#06b6d4', background: 'rgba(6, 182, 212, 0.15)', padding: '6px', borderRadius: '8px' }}><BarChart3 size={16} /></div>
          Average Marks
        </span>
        <span className="stat-value">{stats.averageMarks ?? '—'}</span>
      </div>
      <div className="stat-card" style={{ '--primary': '#f59e0b' } as React.CSSProperties}>
        <span className="stat-label">
          <div className="icon-wrapper" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '6px', borderRadius: '8px' }}><TrendingDown size={16} /></div>
          Lowest Marks
        </span>
        <span className="stat-value">{stats.lowestMarks ?? '—'}</span>
      </div>
      <div className="stat-card" style={{ '--primary': '#6366f1' } as React.CSSProperties}>
        <span className="stat-label">
          <div className="icon-wrapper" style={{ color: '#6366f1', background: 'rgba(99, 102, 241, 0.15)', padding: '6px', borderRadius: '8px' }}><Hash size={16} /></div>
          Median Marks
        </span>
        <span className="stat-value">{stats.medianMarks ?? '—'}</span>
      </div>
      <div className="stat-card" style={{ '--primary': '#ec4899' } as React.CSSProperties}>
        <span className="stat-label">
          <div className="icon-wrapper" style={{ color: '#ec4899', background: 'rgba(236, 72, 153, 0.15)', padding: '6px', borderRadius: '8px' }}><Award size={16} /></div>
          Top Category
        </span>
        <span className="stat-value stat-value-sm">{stats.topCategory ? `${stats.topCategory} (${stats.topCategoryAvg})` : '—'}</span>
      </div>
    </div>
  );
}

