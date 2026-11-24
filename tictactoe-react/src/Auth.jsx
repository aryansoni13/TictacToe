import { useState } from 'react';

// The single sign-in / sign-up screen. Each person uses their own account.
export default function Auth({ game }) {
  const [tab, setTab] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const up = tab === 'signup';

  const pick = (t) => { setTab(t); game.clearError(); };
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    await (up ? game.signup(name, email, pw) : game.login(email, pw));
    setBusy(false);
  }

  return (
    <form className="panel auth" onSubmit={submit}>
      <div className="tabs">
        <button type="button" className={!up ? 'on' : ''} onClick={() => pick('login')}>Sign in</button>
        <button type="button" className={up ? 'on' : ''} onClick={() => pick('signup')}>Sign up</button>
      </div>
      {up && <input placeholder="Your name (shown to your opponent)" value={name} maxLength={16} autoComplete="nickname" onChange={(e) => setName(e.target.value)} required />}
      <input placeholder="Email" type="email" value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} required />
      <input placeholder="Password" type="password" value={pw} autoComplete={up ? 'new-password' : 'current-password'} onChange={(e) => setPw(e.target.value)} required />
      {game.error && <p className="err" role="alert">{game.error}</p>}
      <button className="btn primary wide" disabled={busy}>{up ? 'Create account' : 'Sign in'}</button>
      <p className="or">or</p>
      <button type="button" className="btn wide" onClick={game.google}>
        <svg className="g" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
          <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
        </svg>
        Continue with Google
      </button>
    </form>
  );
}
