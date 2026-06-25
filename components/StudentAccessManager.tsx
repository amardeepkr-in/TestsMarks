'use client';

import { useState } from 'react';
import {
  requestAccessCode,
  bulkGenerateAccessCodes,
  revokeStudentAccess,
} from '@/lib/actions/student';

interface StudentAccessManagerProps {
  submissions: Array<{
    id: number;
    name: string;
    roll: string;
    category: string;
  }>;
}

export default function StudentAccessManager({ submissions }: StudentAccessManagerProps) {
  const [selectedStudent, setSelectedStudent] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [csvData, setCsvData] = useState('');

  const uniqueStudents = Array.from(
    new Map(submissions.map(s => [s.roll, { name: s.name, roll: s.roll }])).values()
  );

  const filteredStudents = uniqueStudents.filter(
    s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.roll.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendAccessCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const result = await requestAccessCode(selectedStudent, email);
      if (result.success) {
        setMessage({ type: 'success', text: 'Access code sent successfully!' });
        setEmail('');
        setSelectedStudent('');
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to send access code' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const lines = csvData.trim().split('\n');
      const students = lines
        .map(line => {
          const [rollNumber, emailAddr] = line.split(',').map(s => s.trim());
          return { rollNumber, email: emailAddr };
        })
        .filter(s => s.rollNumber && s.email);

      if (students.length === 0) {
        setMessage({ type: 'error', text: 'No valid student data found' });
        setLoading(false);
        return;
      }

      const result = await bulkGenerateAccessCodes(students);
      if (result.success && result.results) {
        const succeeded = result.results.filter(r => r.success).length;
        const failed = result.results.filter(r => !r.success).length;
        setMessage({
          type: succeeded > 0 ? 'success' : 'error',
          text: `Processed ${students.length} students: ${succeeded} succeeded, ${failed} failed`,
        });
        if (succeeded > 0) setCsvData('');
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to generate access codes' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAccess = async (rollNumber: string) => {
    if (!confirm(`Are you sure you want to revoke access for ${rollNumber}?`)) return;
    setLoading(true);
    try {
      const result = await revokeStudentAccess(rollNumber);
      if (result.success) {
        setMessage({ type: 'success', text: 'Access revoked successfully' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to revoke access' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">Student Access Management</h2>
        <button
          onClick={() => setBulkMode(!bulkMode)}
          className="btn btn-outline btn-sm"
        >
          {bulkMode ? 'Single Mode' : 'Bulk Mode'}
        </button>
      </div>

      {message && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          background: message.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
          color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
          fontSize: '0.875rem',
        }}>
          {message.text}
        </div>
      )}

      {/* Single Mode */}
      {!bulkMode && (
        <div className="admin-form-card">
          <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Generate Access Code for Student</h3>
          <form onSubmit={handleSendAccessCode}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="student-select">Select Student</label>
                <select id="student-select" value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} required disabled={loading}>
                  <option value="">— Select a student —</option>
                  {uniqueStudents.map((student) => (
                    <option key={student.roll} value={student.roll}>
                      {student.name} ({student.roll})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="student@example.com" disabled={loading} />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }}>
              {loading ? 'Sending…' : 'Generate & Send Access Code'}
            </button>
          </form>
        </div>
      )}

      {/* Bulk Mode */}
      {bulkMode && (
        <div className="admin-form-card">
          <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Bulk Generate Access Codes</h3>
          <form onSubmit={handleBulkGenerate}>
            <div className="form-group">
              <label htmlFor="csv-data">CSV Data (Roll Number, Email)</label>
              <textarea
                id="csv-data"
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                required
                rows={10}
                style={{ fontFamily: 'monospace', fontSize: '0.875rem', width: '100%' }}
                placeholder={'ROLL001,student1@example.com\nROLL002,student2@example.com'}
                disabled={loading}
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                Format: one student per line, comma-separated (rollNumber,email)
              </p>
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
              {loading ? 'Processing…' : 'Generate & Send Access Codes'}
            </button>
          </form>
        </div>
      )}

      {/* Student List */}
      <div className="admin-form-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 600, marginBottom: '0.75rem' }}>All Students</h3>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or roll number…"
          />
        </div>
        <div style={{ maxHeight: '24rem', overflowY: 'auto' }}>
          {filteredStudents.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <p>No students found</p>
            </div>
          ) : (
            filteredStudents.map((student) => (
              <div key={student.roll} style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <p style={{ fontWeight: 500 }}>{student.name}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{student.roll}</p>
                </div>
                <button
                  onClick={() => handleRevokeAccess(student.roll)}
                  disabled={loading}
                  className="btn btn-sm"
                  style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  Revoke Access
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
