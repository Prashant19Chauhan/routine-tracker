import React, { useState, useEffect } from 'react';
import { Target, Calendar, TrendingUp, Zap } from 'lucide-react';
import DayTracker from './pages/DayTracker';
import Goals from './pages/Goals';
import Analytics from './pages/Analytics';

const API_BASE = 'http://localhost:5000/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('day'); // 'day', 'goals', 'analytics'
  const [streak, setStreak] = useState({ currentStreak: 0, longestStreak: 0 });

  useEffect(() => {
    fetchStreak();
  }, []);

  const fetchStreak = async () => {
    try {
      const res = await fetch(`${API_BASE}/analytics/streak`);
      const data = await res.json();
      setStreak(data);
    } catch (err) {
      console.error('Streak fetch failed', err);
    }
  };

  // Class for streak badge based on count
  const getStreakClass = () => {
    if (streak.currentStreak >= 30) return 'streak-badge god';
    if (streak.currentStreak >= 7) return 'streak-badge gold';
    return 'streak-badge';
  };

  return (
    <div>
      {/* Navigation Header */}
      <header className="nav-header" style={{ padding: '1rem 2rem', background: 'rgba(11, 13, 19, 0.6)', backdropFilter: 'blur(20px)' }}>
        <div className="app-container" style={{ display: 'flex', width: '100%', maxWidth: '1280px', margin: '0 auto', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', padding: 0 }}>
          <div className="nav-logo">
            <Zap size={24} color="var(--accent-purple)" className="fire-emoji" />
            <span>HabitRPG</span>
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

          <div 
            className={getStreakClass()} 
            title={`Your current consecutive habit streak is ${streak.currentStreak} days! Keep it burning.`}
            onClick={() => setActiveTab('analytics')}
          >
            <span className="fire-emoji">🔥</span>
            <span>{streak.currentStreak} DAY STREAK</span>
          </div>
        </div>
      </header>

      {/* Main Page Area */}
      <main className="app-container">
        {activeTab === 'day' && <DayTracker API_BASE={API_BASE} onLogSaved={fetchStreak} />}
        {activeTab === 'goals' && <Goals API_BASE={API_BASE} />}
        {activeTab === 'analytics' && <Analytics API_BASE={API_BASE} />}
      </main>
    </div>
  );
}
