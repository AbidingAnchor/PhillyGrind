import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { startAccountRecovery, submitAccountRecovery } from '../lib/accountRecoveryApi.js';
import { COMMUNITY_NEIGHBORHOODS } from '../lib/communityApi.js';

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

function yearOptions() {
  const current = new Date().getFullYear();
  const years = [];
  for (let year = current; year >= 2023; year -= 1) years.push(String(year));
  return years;
}

function AccountRecovery() {
  const [step, setStep] = useState('identify');
  const [identifier, setIdentifier] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const years = useMemo(() => yearOptions(), []);

  function updateAnswer(id, value) {
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  async function handleStart(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus('');
    try {
      const result = await startAccountRecovery(identifier);
      setChallengeId(result.challengeId);
      setQuestions(result.questions || []);
      setAnswers({});
      setStep('questions');
    } catch (error) {
      setStatus(error.message || 'Could not start account recovery.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (newEmail.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      setStatus('The contact emails do not match.');
      return;
    }
    setSubmitting(true);
    setStatus('');
    try {
      const result = await submitAccountRecovery({
        challengeId,
        identifier,
        answers,
        newEmail,
      });
      setStatus(result.message || 'Your request has been submitted for review');
      setStep('done');
    } catch (error) {
      setStatus(error.message || 'Could not submit your recovery request.');
    } finally {
      setSubmitting(false);
    }
  }

  function renderQuestion(question) {
    if (question.id === 'created_at') {
      const value = answers.created_at || { month: '', year: '' };
      return (
        <div className="recovery-date-row">
          <select
            className="auth-input"
            value={value.month}
            onChange={(event) => updateAnswer('created_at', { ...value, month: event.target.value })}
            required
          >
            <option value="">Month</option>
            {MONTHS.map((month) => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>
          <select
            className="auth-input"
            value={value.year}
            onChange={(event) => updateAnswer('created_at', { ...value, year: event.target.value })}
            required
          >
            <option value="">Year</option>
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      );
    }

    if (question.id === 'neighborhoods') {
      const selected = Array.isArray(answers.neighborhoods) ? answers.neighborhoods : [];
      return (
        <div className="recovery-checkboxes">
          {COMMUNITY_NEIGHBORHOODS.map((neighborhood) => (
            <label key={neighborhood} className="recovery-check">
              <input
                type="checkbox"
                checked={selected.includes(neighborhood)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...selected, neighborhood]
                    : selected.filter((item) => item !== neighborhood);
                  updateAnswer('neighborhoods', next);
                }}
              />
              <span>{neighborhood}</span>
            </label>
          ))}
        </div>
      );
    }

    const isLong = question.id === 'recent_content';
    if (isLong) {
      return (
        <textarea
          className="auth-input recovery-textarea"
          rows={4}
          value={answers[question.id] || ''}
          onChange={(event) => updateAnswer(question.id, event.target.value)}
          required
        />
      );
    }

    return (
      <input
        className="auth-input"
        value={answers[question.id] || ''}
        onChange={(event) => updateAnswer(question.id, event.target.value)}
        required
      />
    );
  }

  return (
    <section className="auth-page">
      <div className="bg-blob"></div>
      <div className="auth-wordmark-wrap">
        <div className="auth-wordmark">Philly<span>Grind</span></div>
        <div className="auth-wordmark-shine" aria-hidden="true">Philly<span>Grind</span></div>
      </div>
      <div className="auth-tagline">
        {step === 'done' ? 'Request received' : 'Recover a locked account'}
      </div>

      {step === 'identify' && (
        <form className="auth-form recovery-form" onSubmit={handleStart}>
          <p className="recovery-copy">
            Use this if you lost access to the email on the account — not if you only forgot the password.
          </p>
          <input
            className="auth-input"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="Email, display name, or PG- reference"
            required
          />
          <button className="auth-submit-btn" type="submit" disabled={submitting}>
            {submitting ? 'Checking…' : 'Continue'}
          </button>
          {status && <p className="form-status error-text">{status}</p>}
        </form>
      )}

      {step === 'questions' && (
        <form className="auth-form recovery-form" onSubmit={handleSubmit}>
          {questions.map((question) => (
            <label key={question.id} className="recovery-question">
              <span>{question.prompt}</span>
              {renderQuestion(question)}
            </label>
          ))}
          <label className="recovery-question">
            <span>New email for the reset link if this is approved</span>
            <input
              className="auth-input"
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="New email"
              required
            />
          </label>
          <label className="recovery-question">
            <span>Confirm that email</span>
            <input
              className="auth-input"
              type="email"
              value={confirmEmail}
              onChange={(event) => setConfirmEmail(event.target.value)}
              placeholder="Confirm new email"
              required
            />
          </label>
          <button className="auth-submit-btn" type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
          {status && <p className="form-status error-text">{status}</p>}
        </form>
      )}

      {step === 'done' && (
        <div className="auth-form recovery-form">
          <p className="recovery-copy">{status}</p>
          <p className="recovery-copy">We’ll email the address you gave only after a person reviews the request.</p>
        </div>
      )}

      <p className="auth-switch-link"><Link to="/login">Back to login</Link></p>
    </section>
  );
}

export default AccountRecovery;
