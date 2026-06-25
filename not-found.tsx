import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="error-page">
      <div className="error-card">
        <FileQuestion size={48} className="error-icon" />
        <h1>Page Not Found</h1>
        <p>The page you are looking for does not exist or has been moved.</p>
        <Link href="/" className="btn btn-primary">
          Go to Home
        </Link>
      </div>
    </div>
  );
}

