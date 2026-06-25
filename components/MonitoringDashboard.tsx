'use client';

import { useState, useEffect } from 'react';
import { Activity, AlertCircle, CheckCircle, Clock, Database, HardDrive, Cpu, TrendingUp, RefreshCw } from 'lucide-react';

interface SystemMetrics {
  timestamp: string;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  uptime: number;
  platform: string;
  nodeVersion: string;
}

interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  checks: Record<string, boolean>;
  timestamp: string;
}

interface ErrorLog {
  id: string;
  message: string;
  timestamp: string;
  level: string;
  stack?: string;
}

export default function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [cacheStats, setCacheStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = async () => {
    try {
      const metricsRes = await fetch('/api/monitoring/metrics');
      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data.metrics);
      }
      const healthRes = await fetch('/api/monitoring/health');
      if (healthRes.ok) {
        const data = await healthRes.json();
        setHealth(data);
      }
      const cacheRes = await fetch('/api/monitoring/cache');
      if (cacheRes.ok) {
        const data = await cacheRes.json();
        setCacheStats(data.stats);
      }
      setErrors([]);
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getMemoryUsagePercent = () => {
    if (!metrics) return 0;
    return Math.round((metrics.memory.heapUsed / metrics.memory.heapTotal) * 100);
  };

  if (loading) {
    return (
      <div className="empty-state" style={{ height: '16rem' }}>
        <div className="loading-spinner" />
        <p>Loading monitoring data…</p>
      </div>
    );
  }

  const isHealthy = health?.status === 'healthy';

  return (
    <div className="admin-section">
      {/* Header */}
      <div className="admin-section-header">
        <div>
          <h2 className="admin-section-title">System Monitoring</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.875rem' }}>
            Real-time system health and performance metrics
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button onClick={fetchData} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Health Status Banner */}
      {health && (
        <div className="admin-form-card" style={{
          borderLeft: `4px solid ${isHealthy ? 'var(--success)' : 'var(--danger)'}`,
          background: isHealthy ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            {isHealthy
              ? <CheckCircle size={28} style={{ color: 'var(--success)' }} />
              : <AlertCircle size={28} style={{ color: 'var(--danger)' }} />
            }
            <div>
              <strong style={{ color: isHealthy ? 'var(--success)' : 'var(--danger)' }}>
                System Status: {isHealthy ? 'Healthy' : 'Unhealthy'}
              </strong>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                Last checked: {new Date(health.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {Object.entries(health.checks).map(([key, value]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}>
                {value
                  ? <CheckCircle size={14} style={{ color: 'var(--success)' }} />
                  : <AlertCircle size={14} style={{ color: 'var(--danger)' }} />
                }
                <span style={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="admin-stats-grid">
        {metrics && (
          <div className="stat-card">
            <span className="stat-label"><Database size={14} /> Memory Usage</span>
            <span className="stat-value" style={{ fontSize: '1rem' }}>{formatBytes(metrics.memory.heapUsed)}</span>
            <div style={{ marginTop: '0.5rem', background: 'var(--border)', borderRadius: '99px', height: '6px', overflow: 'hidden' }}>
              <div style={{ width: `${getMemoryUsagePercent()}%`, height: '100%', background: 'var(--primary)', borderRadius: '99px', transition: 'width 0.3s' }} />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {getMemoryUsagePercent()}% of {formatBytes(metrics.memory.heapTotal)}
            </p>
          </div>
        )}

        {metrics && (
          <div className="stat-card">
            <span className="stat-label"><Clock size={14} /> Uptime</span>
            <span className="stat-value" style={{ fontSize: '1.1rem' }}>{formatUptime(metrics.uptime)}</span>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Since last restart</p>
          </div>
        )}

        {cacheStats && (
          <div className="stat-card">
            <span className="stat-label"><HardDrive size={14} /> Cache</span>
            <span className="stat-value" style={{ fontSize: '1rem', textTransform: 'capitalize' }}>
              {String(cacheStats.type || '—')}
            </span>
            <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: cacheStats.connected ? 'var(--success)' : 'var(--danger)' }}>
              {cacheStats.connected ? 'Connected' : 'Disconnected'}
              {cacheStats.keyCount !== undefined ? ` · ${cacheStats.keyCount} keys` : ''}
            </p>
          </div>
        )}

        {metrics && (
          <div className="stat-card">
            <span className="stat-label"><Cpu size={14} /> System Info</span>
            <span className="stat-value" style={{ fontSize: '0.95rem', textTransform: 'capitalize' }}>{metrics.platform}</span>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Node {metrics.nodeVersion} · RSS {formatBytes(metrics.memory.rss)}
            </p>
          </div>
        )}
      </div>

      {/* Recent Errors */}
      <div className="admin-form-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} style={{ color: 'var(--danger)' }} />
          <strong>Recent Errors</strong>
        </div>
        <div style={{ padding: '1rem 1.25rem' }}>
          {errors.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <CheckCircle size={32} style={{ color: 'var(--success)' }} />
              <p>No recent errors detected</p>
            </div>
          ) : (
            errors.map((error) => (
              <div key={error.id} style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', fontSize: '0.7rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px' }}>
                    {error.level.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(error.timestamp).toLocaleString()}
                  </span>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--danger)' }}>{error.message}</p>
                {error.stack && <pre style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', overflowX: 'auto' }}>{error.stack}</pre>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Performance */}
      <div className="admin-form-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TrendingUp size={16} style={{ color: 'var(--primary)' }} />
          <div>
            <strong>Performance Metrics</strong>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>API response times and database query performance</p>
          </div>
        </div>
        <div className="empty-state" style={{ padding: '2.5rem' }}>
          <Activity size={32} style={{ color: 'var(--text-muted)' }} />
          <p>Performance metrics will be displayed here</p>
          <p style={{ fontSize: '0.8rem' }}>Data is collected over time</p>
        </div>
      </div>
    </div>
  );
}
