import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { submitApplication } from '../lib/applicationsApi.js';
import { getResumeUrl, uploadResume } from '../lib/profileApi.js';
import { useAuth } from '../lib/auth.jsx';
import { hasSupabaseConfig, supabase } from '../lib/supabase.js';

function resumeFilename(path) {
  if (!path) return '';
  const parts = path.split('/');
  return parts[parts.length - 1] || 'resume.pdf';
}

function QuickApplyModal({ job, onClose, onApplicationSubmitted }) {
  const { user, profile } = useAuth();
  const [form, setForm] = useState({ coverNote: '' });
  const [resumePath, setResumePath] = useState('');
  const [resumePreviewUrl, setResumePreviewUrl] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);

  const applicantName = profile?.name || user?.user_metadata?.name || '';
  const applicantEmail = profile?.email || user?.email || '';

  useEffect(() => {
    if (!hasSupabaseConfig || !user?.id) return;

    let active = true;

    supabase
      .from('profiles')
      .select('resume_url,resume_path')
      .eq('id', user.id)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (!active || error) return;

        const path = data?.resume_url || data?.resume_path || '';
        setResumePath(path);

        if (path) {
          const signedUrl = await getResumeUrl(path);
          if (active) setResumePreviewUrl(signedUrl || '');
        }
      })
      .catch((error) => console.warn(error));

    return () => {
      active = false;
    };
  }, [user?.id]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleResumeUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingResume(true);
    setStatus('');

    try {
      const nextProfile = await uploadResume(file);
      const path = nextProfile.resume_url || nextProfile.resume_path || '';
      setResumePath(path);
      const signedUrl = await getResumeUrl(path);
      setResumePreviewUrl(signedUrl || '');
      setStatus('Resume attached.');
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
        jobId: job.id,
        coverNote: form.coverNote.trim(),
        resumeUrl: resumePath,
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

  return (
    <div className="chat-backdrop" role="presentation">
      <section className="payment-modal" role="dialog" aria-modal="true" aria-label="Quick apply">
        <header className="chat-header">
          <div>
            <span className="eyebrow">Quick apply</span>
            <h2>Submit Application</h2>
            <p>{job.title}</p>
          </div>
          <button type="button" className="chat-close" onClick={onClose} aria-label="Close quick apply modal">
            <X size={20} />
          </button>
        </header>
        <form className="payment-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input type="text" value={applicantName} readOnly />
          </label>
          <label>
            Email
            <input type="email" value={applicantEmail} readOnly />
          </label>
          <label>
            Resume
            {resumePath ? (
              <div className="quick-apply-resume-row">
                <span>{resumeFilename(resumePath)}</span>
                {resumePreviewUrl && (
                  <a className="text-link" href={resumePreviewUrl} target="_blank" rel="noreferrer">
                    Preview
                  </a>
                )}
              </div>
            ) : (
              <p className="detail-note">No resume on file yet. Upload one below to apply.</p>
            )}
            <input
              type="file"
              accept="application/pdf"
              onChange={handleResumeUpload}
              disabled={uploadingResume}
            />
            <span className="detail-note">
              {uploadingResume ? 'Uploading...' : 'PDF only, 5MB max. Replaces your profile resume.'}
            </span>
          </label>
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
