import React, { useState, useEffect, useRef } from 'react';
import { Target, Calendar, TrendingUp, Zap, LogOut, ShieldAlert } from 'lucide-react';
import DayTracker from './pages/DayTracker';
import Goals from './pages/Goals';
import Analytics from './pages/Analytics';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

// Helper to get local YYYY-MM-DD date string taking timezone offset into account
export const getLocalDateString = (dateObj = new Date()) => {
  const offset = dateObj.getTimezoneOffset();
  const localDate = new Date(dateObj.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split('T')[0];
};

export default function App() {
  const [activeTab, setActiveTab] = useState('day'); // 'day', 'goals', 'analytics'
  const [streak, setStreak] = useState({ currentStreak: 0, longestStreak: 0 });
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [today, setToday] = useState(getLocalDateString());
  const [customEmail, setCustomEmail] = useState('');

  // Auto-checking day change every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const currentToday = getLocalDateString();
      if (currentToday !== today) {
        setToday(currentToday);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [today]);

  useEffect(() => {
    if (token) {
      fetchStreak();
    }
  }, [token, today]);

  // Google GSI script load handler
  useEffect(() => {
    if (token) return;

    let retryCount = 0;
    const initializeGsi = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id.apps.googleusercontent.com',
          callback: handleGoogleCredentialResponse
        });
        
        const btnParent = document.getElementById("google-signin-btn");
        if (btnParent) {
          window.google.accounts.id.renderButton(
            btnParent,
            { theme: "filled_blue", size: "large", width: 280 }
          );
        }
      } else if (retryCount < 20) {
        retryCount++;
        setTimeout(initializeGsi, 250);
      }
    };

    initializeGsi();
  }, [token]);

  const handleGoogleCredentialResponse = async (response) => {
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: response.credential })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
      } else {
        alert(data.error || 'Google Login Failed');
      }
    } catch (err) {
      console.error('Login error', err);
      alert('Google authentication service error');
    }
  };

  const handleDemoLogin = async (email) => {
    if (!email) return;
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: `mock-${email.trim().toLowerCase()}` })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error('Demo login error', err);
      alert('Local network connectivity error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setStreak({ currentStreak: 0, longestStreak: 0 });
  };

  const fetchStreak = async () => {
    try {
      const res = await fetch(`${API_BASE}/analytics/streak?today=${today}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setStreak(data);
    } catch (err) {
      console.error('Streak fetch failed', err);
    }
  };

  const getStreakClass = () => {
    if (streak.currentStreak >= 30) return 'streak-badge god';
    if (streak.currentStreak >= 7) return 'streak-badge gold';
    return 'streak-badge';
  };

  // If user is not authenticated, render Login view
  if (!token || !user) {
    return (
      <div className="login-screen-container">
        <div className="glass-card login-card" style={{ background: 'rgba(11, 13, 19, 0.45)', backdropFilter: 'blur(20px)', borderRadius: '1rem' }}>
          <div>
            <div className="login-logo">
              <Zap size={36} color="var(--accent-purple)" className="fire-emoji" />
              <span>Tic Track</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
              Gamified Daily Routine & Expense Tracker
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
            <div id="google-signin-btn" className="google-btn-wrapper"></div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Requires Google Client configuration in project .env.
            </p>
          </div>

          <div className="login-divider">OR USE A DEMO PROFILE</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button className="demo-profile-btn" onClick={() => handleDemoLogin('prashant@example.com')}>
              <div className="demo-avatar-fallback">👑</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800 }}>PRASHANT CHAUHAN</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>prashant@example.com</div>
              </div>
            </button>

            <button className="demo-profile-btn" onClick={() => handleDemoLogin('guest@example.com')}>
              <div className="demo-avatar-fallback" style={{ background: 'rgba(6, 182, 212, 0.2)', color: 'var(--accent-cyan)', border: '1.5px solid rgba(6, 182, 212, 0.4)' }}>👤</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800 }}>GUEST EXPLORER</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>guest@example.com</div>
              </div>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input 
              type="email" 
              className="input-field" 
              placeholder="Enter custom email for demo..."
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDemoLogin(customEmail)}
            />
            <button className="submit-btn" style={{ padding: '0.5rem 1rem' }} onClick={() => handleDemoLogin(customEmail)}>
              Join
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Navigation Header */}
      <header className="nav-header" style={{ padding: '1rem 2rem', background: 'rgba(11, 13, 19, 0.6)', backdropFilter: 'blur(20px)' }}>
        <div className="app-container" style={{ display: 'flex', width: '100%', maxWidth: '1280px', margin: '0 auto', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', padding: 0 }}>
          <div className="nav-logo" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={24} color="var(--accent-purple)" className="fire-emoji" />
            <span style={{ fontWeight: 900 }}>HabitRPG</span>
          </div>

          <nav className="nav-links">
            <button 
              onClick={() => setActiveTab('day')} 
              className={`nav-btn ${activeTab === 'day' ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0rem' }}
            >
              <Calendar size={16} />
              <span>Day Tracker</span>
            </button>
            <button 
              onClick={() => setActiveTab('goals')} 
              className={`nav-btn ${activeTab === 'goals' ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0rem' }}
            >
              <Target size={16} />
              <span>Goal Hierarchy</span>
            </button>
            <button 
              onClick={() => setActiveTab('analytics')} 
              className={`nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0rem' }}
            >
              <TrendingUp size={16} />
              <span>Analytics</span>
            </button>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }} className="header-user-section">
            <div 
              className={getStreakClass()} 
              title={`Your current consecutive habit streak is ${streak.currentStreak} days! Keep it burning.`}
              onClick={() => setActiveTab('analytics')}
            >
              <span className="fire-emoji">🔥</span>
              <span>{streak.currentStreak} DAY STREAK</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '0.35rem 0.75rem', borderRadius: '20px' }}>
              {user.picture ? (
                <img src={user.picture} alt={user.name} className="demo-avatar" style={{ width: '22px', height: '22px' }} />
              ) : (
                <div className="demo-avatar-fallback" style={{ width: '22px', height: '22px', fontSize: '0.65rem' }}>
                  {user.name[0]}
                </div>
              )}
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={user.name}>
                {user.name.split(' ')[0]}
              </span>
              <button onClick={handleLogout} className="logout-btn" style={{ padding: '0.2rem 0.4rem', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Log Out">
                <LogOut size={12} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Area */}
      <main className="app-container">
        {activeTab === 'day' && (
          <DayTracker 
            API_BASE={API_BASE} 
            token={token} 
            user={user} 
            today={today} 
            onLogSaved={fetchStreak} 
          />
        )}
        {activeTab === 'goals' && (
          <Goals 
            API_BASE={API_BASE} 
            token={token} 
            user={user} 
          />
        )}
        {activeTab === 'analytics' && (
          <Analytics 
            API_BASE={API_BASE} 
            token={token} 
            user={user} 
            today={today} 
          />
        )}
      </main>
    </div>
  );
}
