'use client'

import { useState } from 'react';
import { Submission } from '../lib/types';
import SubmissionForm from './SubmissionForm';
import DataGrid from './DataGrid';
import { Pencil } from 'lucide-react';

interface HomeContentProps {
  submissions: Submission[];
}

export default function HomeContent({ submissions }: HomeContentProps) {
  const [editingSubmission, setEditingSubmission] = useState<Submission | null>(null);

  function handleEdit(submission: Submission) {
    setEditingSubmission(submission);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancelEdit() {
    setEditingSubmission(null);
  }

  return (
    <>
      <section className="section">
        <h2>
          {editingSubmission ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Pencil size={18} /> Edit Record
            </span>
          ) : (
            'Submit New Record'
          )}
        </h2>
        <SubmissionForm
          editingSubmission={editingSubmission}
          onCancelEdit={handleCancelEdit}
        />
      </section>

      <section className="section">
        <h2>All Records ({submissions.length})</h2>
        <DataGrid initialSubmissions={submissions} onEdit={handleEdit} />
      </section>
    </>
  );
}

