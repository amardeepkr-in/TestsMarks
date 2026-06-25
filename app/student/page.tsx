import { redirect } from 'next/navigation';
import { getStudentSession, getStudentSubmissions } from '@/lib/actions/student';
import StudentDashboard from '@/components/StudentDashboard';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Student Dashboard — Marks & Admit Card Portal',
  description: 'View your exam results and admit cards',
};

export default async function StudentDashboardPage() {
  const session = await getStudentSession();

  if (!session.authenticated || !session.student) {
    redirect('/student/login');
  }

  const submissionsResult = await getStudentSubmissions(session.student.roll);

  if (!submissionsResult.success) {
    return (
      <div className="error-page">
        <div className="error-card">
          <AlertTriangle size={48} className="error-icon" />
          <h1>Error Loading Data</h1>
          <p>{submissionsResult.error || 'Failed to load your submissions'}</p>
          <Link href="/student/login" className="btn btn-primary">
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <StudentDashboard
      student={session.student}
      submissions={submissionsResult.submissions || []}
    />
  );
}
