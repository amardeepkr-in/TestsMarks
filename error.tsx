'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="error-page">
      <div className="error-card">
        <AlertTriangle size={48} className="error-icon" />
        <h1>Something went wrong</h1>
        <p>An unexpected error occurred. Please try again.</p>
        {error.digest && (
          <code className="error-digest">Error: {error.digest}</code>
        )}
        <button className="btn btn-primary" onClick={reset}>
          <RefreshCw size={16} /> Try Again
        </button>
      </div>
    </div>
  );
}

