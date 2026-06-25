'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { studentLogout } from '@/lib/actions/student';
import { toast } from 'sonner';
import { FileText, CheckCircle, BookOpen, Download, Eye, LogOut, Printer } from 'lucide-react';

interface Submission {
  id: number;
  name: string;
  category: string;
  roll: string;
  marks: string;
  admit_card_path: string | null;
  admit_card_filename: string | null;
  created_at: string;
}

interface StudentDashboardProps {
  student: {
    name: string;
    roll: string;
  };
  submissions: Submission[];
}

function parseMarks(marksStr: string): Record<string, unknown> | null {
  try {
    return JSON.parse(marksStr);
  } catch {
    return null;
  }
}

function calculateTotal(marks: Record<string, unknown>): { obtained: number; total: number } | null {
  if (!marks || typeof marks !== 'object') return null;
  let obtained = 0;
  let total = 0;
  for (const [key, value] of Object.entries(marks)) {
    if (key !== 'total' && typeof value === 'object' && value !== null) {
      const sub = value as { obtained?: number; total?: number };
      if (sub.obtained !== undefined) obtained += sub.obtained;
      if (sub.total !== undefined) total += sub.total;
    }
  }
  return { obtained, total };
}

export default function StudentDashboard({ student, submissions }: StudentDashboardProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const admitCardCount = submissions.filter(s => s.admit_card_path).length;
  const resultsCount = submissions.filter(s => s.marks && s.marks !== '{}').length;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await studentLogout();
      toast.success('Logged out successfully');
      router.push('/student/login');
      router.refresh();
    } catch {
      toast.error('Logout failed');
      setLoggingOut(false);
    }
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div>
            <h1>Student Portal</h1>
            <p className="subtitle">Welcome, {student.name} — Roll: {student.roll}</p>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <LogOut size={14} />
            {loggingOut ? 'Logging out…' : 'Logout'}
          </button>
        </div>
      </header>

      <main className="main-content">
        {/* Summary stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">
              <FileText size={16} /> Total Exams
            </span>
            <span className="stat-value">{submissions.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">
              <CheckCircle size={16} /> Results Available
            </span>
            <span className="stat-value">{resultsCount}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">
              <BookOpen size={16} /> Admit Cards
            </span>
            <span className="stat-value">{admitCardCount}</span>
          </div>
        </div>

        {/* Submissions */}
        <section className="section">
          <h2>Your Exam Submissions</h2>

          {submissions.length === 0 ? (
            <div className="form-card">
              <div className="empty-state">
                <FileText size={40} style={{ color: 'var(--text-muted)' }} />
                <p>No submissions yet</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Your exam records will appear here once they are entered.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {submissions.map((submission) => {
                const marks = parseMarks(submission.marks);
                const totals = marks ? calculateTotal(marks) : null;
                const percentage =
                  totals && totals.total > 0
                    ? ((totals.obtained / totals.total) * 100).toFixed(1)
                    : null;

                return (
                  <div key={submission.id} className="form-card">
                    {/* Card header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        flexWrap: 'wrap',
                        marginBottom: '1rem',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            flexWrap: 'wrap',
                            marginBottom: '0.35rem',
                          }}
                        >
                          <h3
                            style={{
                              fontSize: '1.05rem',
                              fontWeight: 700,
                              margin: 0,
                            }}
                          >
                            {submission.category}
                          </h3>
                          {totals && totals.total > 0 && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '999px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                background: 'hsla(160, 84%, 39%, 0.15)',
                                color: '#10b981',
                                border: '1px solid hsla(160, 84%, 39%, 0.3)',
                              }}
                            >
                              {totals.obtained} / {totals.total}
                              {percentage && ` (${percentage}%)`}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                          Submitted on{' '}
                          {new Date(submission.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      </div>

                      {/* Actions */}
                      {submission.admit_card_path && (
                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                          <a
                            href={submission.admit_card_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline btn-sm"
                            title="View admit card"
                          >
                            <Eye size={14} /> View
                          </a>
                          <a
                            href={submission.admit_card_path}
                            download={submission.admit_card_filename || 'admit-card'}
                            className="btn btn-outline btn-sm"
                            title="Download admit card"
                          >
                            <Download size={14} /> Download
                          </a>
                          <button
                            className="btn btn-outline btn-sm"
                            title="Print admit card"
                            onClick={() => window.print()}
                          >
                            <Printer size={14} /> Print
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Subject marks breakdown */}
                    {marks && Object.keys(marks).length > 0 && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                          gap: '0.5rem',
                          paddingTop: '0.75rem',
                          borderTop: '1px solid var(--border)',
                        }}
                      >
                        {Object.entries(marks).map(([subject, data]) => {
                          if (subject === 'total' || typeof data !== 'object' || data === null)
                            return null;
                          const subjectData = data as { obtained?: number; total?: number };
                          return (
                            <div
                              key={subject}
                              className="stat-card"
                              style={{ padding: '0.75rem', gap: '0.25rem' }}
                            >
                              <span
                                className="stat-label"
                                style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}
                              >
                                {subject}
                              </span>
                              <span className="stat-value" style={{ fontSize: '1.1rem' }}>
                                {subjectData.obtained ?? 0}
                                <span
                                  style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--text-muted)',
                                    fontWeight: 400,
                                  }}
                                >
                                  /{subjectData.total ?? 0}
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Plain marks string fallback */}
                    {!marks && submission.marks && submission.marks !== '{}' && (
                      <div
                        style={{
                          paddingTop: '0.75rem',
                          borderTop: '1px solid var(--border)',
                          fontSize: '0.9rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Marks: <strong style={{ color: 'var(--foreground)' }}>{submission.marks}</strong>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
