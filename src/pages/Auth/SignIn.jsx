import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button, Input } from '../../components/ui/index.jsx';
import { useAuth, homeForRole } from '../../context/AuthContext.jsx';
import './Auth.css';

const DEMO = [
  { label: 'Matchmaker', phone: '01712345678', pw: 'ghotok123' },
  { label: 'Admin', phone: '01700000001', pw: 'admin123' },
  { label: 'Guardian', phone: '01811111111', pw: 'guardian123' },
  { label: 'Candidate', phone: '01911111111', pw: 'candidate123' },
];

export default function SignIn() {
  const { signin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await signin({ phone, password });
      const dest = location.state?.from || homeForRole(user);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const useDemo = (d) => { setPhone(d.phone); setPassword(d.pw); setError(null); };

  return (
    <div className="auth">
      <div className="auth-card">
        <aside className="auth-aside">
          <div className="auth-brand"><span className="auth-logo">স</span><span>SongiSathi</span></div>
          <div className="auth-aside-title">সঙ্গীসাথী</div>
          <p className="auth-aside-copy">Sign in to your workspace. Matchmakers, guardians, and members — everything routes through the person you trust.</p>
          <div className="auth-aside-foot">A companion for the journey.</div>
        </aside>

        <div className="auth-main">
          <h1 className="auth-title">Sign in</h1>
          <p className="auth-sub">Use the phone number families call you on.</p>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={submit}>
            <Input label="Mobile number" placeholder="01712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit" variant="primary" size="lg" disabled={busy} style={{ width: '100%', marginTop: 4 }}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="auth-alt">New to SongiSathi? <Link to="/signup">Create an account</Link></div>

          <div className="auth-demo">
            <div className="auth-demo-label">Demo accounts (from the seeded data)</div>
            <div className="auth-demo-row">
              {DEMO.map((d) => (
                <button type="button" key={d.label} className="auth-demo-chip" onClick={() => useDemo(d)}>{d.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
