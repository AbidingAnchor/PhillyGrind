import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

function SignUp() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus('');

    try {
      const data = await signUp({ ...form, tosAgreedAt: new Date().toISOString() });
      if (data.session) {
        navigate('/', { replace: true });
        return;
      }

      setStatus('Account created. Check your email to confirm your address, then log in.');
    } catch (error) {
      setStatus(error.message || 'Could not create your account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="page-heading">
        <span className="eyebrow">Join PhillyGrind</span>
        <h1>Sign Up</h1>
        <p>Create an account to post jobs and gigs across Philadelphia.</p>
      </div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Name
          <input name="name" value={form.name} onChange={updateField} placeholder="Your name" required />
        </label>
        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={updateField} required />
        </label>
        <label>
          Password
          <input name="password" type="password" value={form.password} onChange={updateField} minLength="6" required />
        </label>
        <label className="clickwrap-label">
          <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} required />
          <span>
            I have read and agree to the <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>
          </span>
        </label>
        <button className="primary-button" type="submit" disabled={submitting || !agreed}>
          {submitting ? 'Creating account...' : 'Sign Up'}
        </button>
        {status && <p className="form-status">{status}</p>}
        <p className="auth-switch">Already have an account? <Link to="/login">Login</Link></p>
      </form>
    </section>
  );
}

export default SignUp;
