import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signIn } = useAuth();
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
      await signIn(form);
      navigate('/', { replace: true });
    } catch (error) {
      setStatus(error.message || 'Could not log in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="page-heading">
        <span className="eyebrow">Welcome back</span>
        <h1>Login</h1>
        <p>Sign in to post jobs and gigs for the PhillyGrind community.</p>
      </div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={updateField} required />
        </label>
        <label>
          Password
          <input name="password" type="password" value={form.password} onChange={updateField} required />
        </label>
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Logging in...' : 'Login'}
        </button>
        {status && <p className="form-status error-text">{status}</p>}
        <p className="auth-switch">New to PhillyGrind? <Link to="/signup">Create an account</Link></p>
      </form>
    </section>
  );
}

export default Login;
