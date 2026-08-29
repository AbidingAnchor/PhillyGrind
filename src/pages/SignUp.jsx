import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { persistReferral } from '../lib/referral.js';
import { showToast } from '../lib/toast.js';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const EMAIL_CONFIRM_MESSAGE = 'Check your email to confirm your address, then log in to get started.';

function SignUp() {
  const [form, setForm] = useState({ name: '', email: '', password: '', birthdate: null });
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const { signUp, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  function nextPath() {
    const from = location.state?.from;
    if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return '/';
    return from;
  }

  useEffect(() => {
    persistReferral(searchParams.get('ref'));
  }, [searchParams]);

  // Redirect authenticated users away from signup page
  useEffect(() => {
    if (isLoggedIn) {
      navigate(nextPath(), { replace: true });
    }
  }, [isLoggedIn, navigate, location.state?.from]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function calculateAge(birthdate) {
    const today = new Date();
    const birthDate = new Date(birthdate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting || succeeded) return;

    setSubmitting(true);
    setStatus('');

    // Client-side age verification
    if (!form.birthdate) {
      setStatus('Please enter your date of birth.');
      setSubmitting(false);
      return;
    }

    const age = calculateAge(form.birthdate);
    if (age < 18) {
      setStatus('PhillyGrind requires users to be 18 or older.');
      setSubmitting(false);
      return;
    }

    try {
      const data = await signUp({ 
        ...form, 
        birthdate: form.birthdate.toISOString().split('T')[0],
        tosAgreedAt: new Date().toISOString() 
      });
      setSucceeded(true);
      if (data.session) {
        showToast('Your account has been created. Welcome to PhillyGrind!');
        navigate('/', { replace: true });
        return;
      }

      showToast('Your account has been created. Check your email to confirm, then log in.');
    } catch (error) {
      setStatus(error.message || 'Could not create your account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="bg-blob"></div>
      <div className="auth-wordmark-wrap">
        <div className="auth-wordmark">Philly<span>Grind</span></div>
        <div className="auth-wordmark-shine" aria-hidden="true">Philly<span>Grind</span></div>
      </div>
      <div className="auth-tagline">
        {succeeded ? 'Confirm your email to finish signing up.' : 'Join the community built by Philly, for Philly.'}
      </div>
      {succeeded ? (
        <div className="auth-success" role="status" aria-live="polite">
          <CheckCircle2 className="auth-success-icon" aria-hidden="true" />
          <h1>Your account has been created</h1>
          <p>{EMAIL_CONFIRM_MESSAGE}</p>
          <Link to="/login" state={{ from: nextPath() }} className="auth-submit-btn">Continue to Login</Link>
        </div>
      ) : (
        <>
          <form className="auth-form" onSubmit={handleSubmit}>
            <input 
              className="auth-input" 
              name="name" 
              value={form.name} 
              onChange={updateField} 
              placeholder="Name"
              required 
              disabled={submitting}
            />
            <input 
              className="auth-input" 
              name="email" 
              type="email" 
              value={form.email} 
              onChange={updateField} 
              placeholder="Email"
              required 
              disabled={submitting}
            />
            <input 
              className="auth-input" 
              name="password" 
              type="password" 
              value={form.password} 
              onChange={updateField} 
              placeholder="Password"
              minLength="6" 
              required 
              disabled={submitting}
            />
            <div className="auth-datepicker-wrapper">
              <DatePicker
                selected={form.birthdate}
                onChange={(date) => setForm({ ...form, birthdate: date })}
                placeholderText="Date of Birth"
                required
                maxDate={new Date()}
                showYearDropdown
                scrollableYearDropdown
                yearDropdownItemNumber={100}
                className="auth-input"
                popperClassName="auth-datepicker-popper"
                portalId="datepicker-portal"
                dateFormat="MMMM d, yyyy"
                disabled={submitting}
              />
            </div>
            <label className="clickwrap-label">
              <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} required disabled={submitting} />
              <span>
                I have read and agree to the <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>
              </span>
            </label>
            <button className="auth-submit-btn" type="submit" disabled={submitting || succeeded || !agreed}>
              {succeeded ? 'Account created' : submitting ? 'Creating account...' : 'Sign Up'}
            </button>
            {status && <p className="form-status error-text">{status}</p>}
          </form>
          <p className="auth-switch-link">Already have an account? <Link to="/login" state={{ from: nextPath() }}>Login</Link></p>
        </>
      )}
    </section>
  );
}

export default SignUp;
