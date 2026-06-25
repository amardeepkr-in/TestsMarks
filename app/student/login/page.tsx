import { redirect } from 'next/navigation';
import { getStudentSession } from '@/lib/actions/student';
import StudentLoginForm from '@/components/StudentLoginForm';

export const metadata = {
  title: 'Student Login — Marks & Admit Card Portal',
  description: 'Login to view your exam results and admit cards',
};

export default async function StudentLoginPage() {
  const session = await getStudentSession();
  if (session.authenticated) {
    redirect('/student');
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <div className="admin-login-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>
          <h1>Student Portal</h1>
          <p>Login to view your exam results and admit cards</p>
        </div>
        <StudentLoginForm />
        <div className="admin-login-footer">
          <p>Enter your roll number and 8-character access code.</p>
          <p>Don&apos;t have a code? Request one with your email.</p>
        </div>
      </div>
    </div>
  );
}
