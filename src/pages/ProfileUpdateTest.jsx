import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

function formatResult(payload) {
  return JSON.stringify(payload, null, 2);
}

export default function ProfileUpdateTest() {
  const { user } = useAuth();
  const [bioResult, setBioResult] = useState('');
  const [roleResult, setRoleResult] = useState('');
  const [bioBusy, setBioBusy] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);

  async function runBioUpdate() {
    setBioBusy(true);
    setBioResult('');
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ bio: 'test' })
        .eq('id', user.id)
        .select('id, bio')
        .maybeSingle();

      setBioResult(formatResult({
        ok: !error,
        error: error ? { message: error.message, code: error.code, details: error.details } : null,
        data,
      }));
    } catch (error) {
      setBioResult(formatResult({ ok: false, error: { message: error.message } }));
    } finally {
      setBioBusy(false);
    }
  }

  async function runRoleUpdate() {
    setRoleBusy(true);
    setRoleResult('');
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', user.id)
        .select('id, role')
        .maybeSingle();

      setRoleResult(formatResult({
        ok: !error,
        error: error ? { message: error.message, code: error.code, details: error.details } : null,
        data,
      }));
    } catch (error) {
      setRoleResult(formatResult({ ok: false, error: { message: error.message } }));
    } finally {
      setRoleBusy(false);
    }
  }

  return (
    <section className="page-section">
      <div className="page-heading">
        <span className="eyebrow">Temporary</span>
        <h1>Profile UPDATE grant test</h1>
        <p>
          Logged in as <code>{user?.id}</code>. Bio PATCH should succeed. Role PATCH
          should fail with a permission error. Remove this page after confirming.
        </p>
      </div>

      <div className="settings-card" style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
        <div>
          <button type="button" className="primary-button" onClick={runBioUpdate} disabled={bioBusy}>
            {bioBusy ? 'Running…' : "Update bio to 'test'"}
          </button>
          {bioResult && (
            <pre style={{ marginTop: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{bioResult}</pre>
          )}
        </div>

        <div>
          <button type="button" className="primary-button" onClick={runRoleUpdate} disabled={roleBusy}>
            {roleBusy ? 'Running…' : "Update role to 'admin'"}
          </button>
          {roleResult && (
            <pre style={{ marginTop: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{roleResult}</pre>
          )}
        </div>
      </div>
    </section>
  );
}
