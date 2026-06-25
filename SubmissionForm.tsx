'use client'

import { useState, useRef, useEffect } from 'react';
import { createSubmission, updateSubmissionFull } from '../lib/actions';
import { Submission } from '../lib/types';
import { Upload, CheckCircle2, X, Pencil } from 'lucide-react';
import { toast } from 'sonner';

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf'];

interface SubmissionFormProps {
  editingSubmission?: Submission | null;
  onCancelEdit?: () => void;
}

export default function SubmissionForm({ editingSubmission, onCancelEdit }: SubmissionFormProps) {
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitted, setSubmitted] = useState(false);

  const isEditing = !!editingSubmission;

  useEffect(() => {
    if (editingSubmission && formRef.current) {
      formRef.current.querySelector<HTMLInputElement>('#name')!.value = editingSubmission.name;
      formRef.current.querySelector<HTMLInputElement>('#category')!.value = editingSubmission.category;
      formRef.current.querySelector<HTMLInputElement>('#roll')!.value = editingSubmission.roll;
      formRef.current.querySelector<HTMLInputElement>('#marks')!.value = editingSubmission.marks;
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [editingSubmission]);

  function validateFile(file: File): string | null {
    if (file.size > 10 * 1024 * 1024) {
      return 'File must be under 10MB';
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return 'Only JPG, PNG, or PDF files are allowed';
    }
    return null;
  }

  function resetForm() {
    formRef.current?.reset();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setFileName(null);
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setSubmitted(false);
    try {
      const file = formData.get('file') as File | null;
      if (file && file.size > 0) {
        const fileError = validateFile(file);
        if (fileError) {
          toast.error(fileError);
          setLoading(false);
          return;
        }
      }

      let result;
      if (isEditing) {
        result = await updateSubmissionFull(editingSubmission.id, formData);
      } else {
        result = await createSubmission(formData);
      }

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isEditing ? 'Record updated successfully!' : 'Record added successfully!');
        resetForm();
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 2000);
        if (isEditing) onCancelEdit?.();
      }
    } catch {
      toast.error(isEditing ? 'Failed to update record' : 'Failed to add record');
    }
    setLoading(false);
  }

  function handleCancel() {
    resetForm();
    onCancelEdit?.();
  }

  return (
    <div className="form-card" style={isEditing ? { borderColor: 'var(--primary)', borderWidth: '2px', borderStyle: 'solid', boxShadow: '0 0 20px var(--primary-focus)' } : undefined}>
      {isEditing && (
        <div className="edit-mode-banner" style={{ background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.1), transparent)', borderLeft: '4px solid var(--primary)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontWeight: 600 }}>
            <Pencil size={16} />
            <span>Editing record #{editingSubmission.id}</span>
          </div>
          <button type="button" className="icon-btn cancel" onClick={handleCancel} title="Cancel editing" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '50%', padding: '0.4rem', color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        </div>
      )}
      <form action={handleSubmit} ref={formRef}>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              required
              placeholder="Enter your full name"
              maxLength={200}
              defaultValue={editingSubmission?.name ?? ''}
            />
          </div>
          <div className="form-group">
            <label htmlFor="category">Category</label>
            <input
              type="text"
              id="category"
              name="category"
              required
              placeholder="e.g. General, OBC, SC/ST"
              maxLength={100}
              defaultValue={editingSubmission?.category ?? ''}
            />
          </div>
          <div className="form-group">
            <label htmlFor="roll">Roll Number</label>
            <input
              type="text"
              id="roll"
              name="roll"
              required
              placeholder="ROLL123"
              maxLength={50}
              defaultValue={editingSubmission?.roll ?? ''}
            />
          </div>
          <div className="form-group">
            <label htmlFor="marks">Marks</label>
            <input
              type="text"
              id="marks"
              name="marks"
              required
              placeholder="95"
              maxLength={20}
              pattern="[0-9]*\.?[0-9]*"
              title="Please enter a valid number"
              defaultValue={editingSubmission?.marks ?? ''}
            />
          </div>
        </div>
        <div className="form-actions" style={{ marginTop: '1.5rem', padding: '1.5rem', background: 'hsla(0,0%,100%,0.02)', borderRadius: '12px', border: '1px solid hsla(0,0%,100%,0.05)', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, flex: '1', minWidth: '250px' }}>
            <label htmlFor="file">Admit Card (Optional)</label>
            <label className="btn btn-outline" style={{ display: 'flex', cursor: 'pointer', width: '100%', justifyContent: 'center', borderStyle: 'dashed' }}>
              <Upload size={16} />
              <span style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {fileName || (isEditing ? 'Replace file (JPG/PNG/PDF, max 10MB)' : 'Choose File (JPG/PNG/PDF, max 10MB)')}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                id="file"
                name="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={(e) => setFileName(e.target.files?.[0]?.name || null)}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          <div className="form-actions-btns" style={{ display: 'flex', gap: '1rem', flex: '1', justifyContent: 'flex-end', minWidth: '250px' }}>
            {isEditing && (
              <button type="button" className="btn btn-outline" onClick={handleCancel} style={{ flex: 1 }}>
                Cancel
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 2 }}>
              {loading
                ? (isEditing ? 'Updating Record...' : 'Adding Record...')
                : submitted
                  ? <><CheckCircle2 size={16} /> {isEditing ? 'Updated!' : 'Added!'}</>
                  : (isEditing ? 'Update Record' : 'Add Record')
              }
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

