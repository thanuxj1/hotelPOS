'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('admin@hotelpos.demo');
  const [password, setPassword] = useState('Admin@12345');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const loginRes = await authApi.login(email, password);
      const { access_token } = loginRes.data;
      localStorage.setItem('access_token', access_token);
      const meRes = await authApi.me();
      setAuth(meRes.data, access_token);
      router.replace('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 20% 50%, rgba(59,130,246,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.08) 0%, transparent 60%), var(--bg-base)',
      padding: '20px',
    }}>
      {/* Decorative blobs */}
      <div style={{
        position: 'fixed', top: '-10%', left: '-10%', width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: '-10%', right: '-10%', width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px', height: '64px', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', boxShadow: '0 8px 32px rgba(59,130,246,0.35)',
          }}>🏨</div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '4px' }}>Hotel POS</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Cloud Management System</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(17,24,39,0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          padding: '36px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>Welcome back</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '28px' }}>
            Sign in to your hotel dashboard
          </p>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '10px', padding: '12px 16px', marginBottom: '20px',
              fontSize: '14px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="label" htmlFor="email-input">Email address</label>
              <input
                id="email-input"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@hotelpos.demo"
                required
                autoComplete="email"
              />
            </div>
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="label" htmlFor="password-input">Password</label>
              <input
                id="password-input"
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              id="login-btn"
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '15px' }}
              disabled={loading}
            >
              {loading ? (
                <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Signing in…</>
              ) : 'Sign In'}
            </button>
          </form>

          <div style={{
            marginTop: '24px', padding: '14px',
            background: 'rgba(59,130,246,0.06)', borderRadius: '10px',
            border: '1px solid rgba(59,130,246,0.15)',
          }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
              Demo credentials
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              admin@hotelpos.demo / Admin@12345
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
