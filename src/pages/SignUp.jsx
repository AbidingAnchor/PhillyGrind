import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

function SignUp() {
  const [form, setForm] = useState({ name: '', email: '', password: '', birthdate: null });
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signUp, isLoggedIn } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users away from signup page
  useEffect(() => {
    if (isLoggedIn) {
      navigate('/', { replace: true });
    }
  }, [isLoggedIn, navigate]);

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
      <div className="bg-blob"></div>
      <div className="auth-wordmark-wrap">
        <div className="auth-wordmark">Philly<span>Grind</span></div>
        <div className="auth-wordmark-shine" aria-hidden="true">Philly<span>Grind</span></div>
      </div>
      <div className="auth-tagline">Join the community built by Philly, for Philly.</div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <input 
          className="auth-input" 
          name="name" 
          value={form.name} 
          onChange={updateField} 
          placeholder="Name"
          required 
        />
        <input 
          className="auth-input" 
          name="email" 
          type="email" 
          value={form.email} 
          onChange={updateField} 
          placeholder="Email"
          required 
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
        />
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
          wrapperClassName="auth-datepicker-wrapper"
          dateFormat="MMMM d, yyyy"
        />
        <label className="clickwrap-label">
          <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} required />
          <span>
            I have read and agree to the <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>
          </span>
        </label>
        <button className="auth-submit-btn" type="submit" disabled={submitting || !agreed}>
          {submitting ? 'Creating account...' : 'Sign Up'}
        </button>
        {status && <p className="form-status">{status}</p>}
      </form>
      <p className="auth-switch-link">Already have an account? <Link to="/login">Login</Link></p>
    </section>
  );
}

export default SignUp;
