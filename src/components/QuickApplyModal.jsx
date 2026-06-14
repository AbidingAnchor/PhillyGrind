import { useEffect, useRef, useState } from 'react';
import { FileText, X } from 'lucide-react';
import { submitApplication } from '../lib/applicationsApi.js';
import { uploadResume } from '../lib/profileApi.js';
import { useAuth } from '../lib/auth.jsx';

function resumeFilename(resumePath) {
  if (!resumePath) return '';
  const parts = resumePath.split('/');
  return parts[parts.length - 1] || 'resume.pdf';
}

function QuickApplyModal({ listing, onClose, onApplicationSubmitted }) {
  const { user, profile } = useAuth();
  const fileInputRef = useRef(null);
  const [resumePath, setResumePath] = useState(profile?.resume_url || profile?.resume_path || '');
  const [form, setForm] = useState({
    name: profile?.name || user?.user_metadata?.name || '',
    email: user?.email || profile?.email || '',
    coverNote: '',
  });
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      name: profile?.name || user?.user_metadata?.name || current.name,
      email: user?.email || profile?.email || current.email,
    }));
    setResumePath(profile?.resume_url || profile?.resume_path || '');
  }, [profile, user]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleResumeSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingResume(true);
    setStatus('');

    try {
      const nextProfile = await uploadResume(file);
      const nextPath = nextProfile.resume_url || nextProfile.resume_path;
      setResumePath(nextPath);
      setStatus('Resume uploaded and ready to attach.');
    } catch (error) {
      setStatus(error.message || 'Could not upload resume.');
    } finally {
      setUploadingResume(false);
      event.target.value = '';
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus('');

    try {
      const application = await submitApplication({
        jobId: listing.id,
        resumeUrl: resumePath,
        coverNote: form.coverNote.trim(),
      });
      onApplicationSubmitted?.(application);
      setStatus('Application submitted.');
      setTimeout(onClose, 700);
    } catch (error) {
      setStatus(error.message || 'Could not submit your application.');
    } finally {
      setSubmitting(false);
    }
  }

  const attachedResumeName = resumeFilename(resumePath);

  return (
    <div className="chat-backdrop" role="presentation">
      <section className="payment-modal" role="dialog" aria-modal="true" aria-label="Quick apply">
        <header className="chat-header">
          <div>
            <span className="eyebrow">Quick apply</span>
            <h2>Submit Application</h2>
            <p>{listing.title}</p>
          </div>
          <button type="button" className="chat-close" onClick={onClose} aria-label="Close quick apply modal">
            <X size={20} />
          </button>
        </header>
        <form className="payment-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input name="name" value={form.name} onChange={updateField} readOnly />
          </label>
          <label>
            Email
            <input name="email" type="email" value={form.email} onChange={updateField} readOnly />
          </label>
          <div className="quick-apply-resume-field">
            <span>Resume</span>
            {attachedResumeName ? (
              <div className="quick-apply-resume-attached">
                <FileText size={18} />
                <span>{attachedResumeName}</span>
                <button
                  type="button"
                  className="secondary-detail-button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingResume}
                >
                  {uploadingResume ? 'Uploading...' : 'Replace'}
                </button>
              </div>
            ) : (
              <div className="quick-apply-resume-empty">
                <p className="detail-note">No resume on file. Upload a PDF to apply.</p>
                <button
                  type="button"
                  className="secondary-detail-button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingResume}
                >
                  {uploadingResume ? 'Uploading...' : 'Upload Resume PDF'}
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleResumeSelect}
              hidden
            />
            <span className="detail-note">PDF only, 5MB max.</span>
          </div>
          <label>
            Cover note (optional)
            <textarea
              name="coverNote"
              value={form.coverNote}
              onChange={updateField}
              rows="5"
              placeholder="Share why you are a good fit for this role."
            />
          </label>
          {status && <p className="form-status">{status}</p>}
          <button className="primary-button" type="submit" disabled={submitting || uploadingResume || !resumePath}>
            {submitting ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>
      </section>
    </div>
  );
}

export default QuickApplyModal;
