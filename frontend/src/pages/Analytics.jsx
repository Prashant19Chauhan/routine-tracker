import React, { useState, useEffect } from 'react';
import { Award, Zap, TrendingUp, Calendar, CheckCircle, Flame, ShieldAlert, Sparkles, Lock, Unlock } from 'lucide-react';

export default function Analytics({ API_BASE, token, today, authFetch }) {

  const [dashboardData, setDashboardData] = useState(null);
  const [streakData, setStreakData] = useState({ currentStreak: 0, longestStreak: 0 });
  const [activeTab, setActiveTab] = useState('month'); // default to 'month' streak calendar
  const [loading, setLoading] = useState(true);

  // Selected cell detail in the month calendar
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [selectedDetailLoading, setSelectedDetailLoading] = useState(false);
  const [chartTimeframe, setChartTimeframe] = useState('week'); // 'week' or 'month'

  useEffect(() => {
    fetchDashboard();
    fetchStreak();
  }, [today, token]);

  const fetchCellDetails = async (date) => {
    try {
      setSelectedDetailLoading(true);
      const res = await authFetch(`${API_BASE}/logs/${date}?today=${today}`);
      const data = await res.json();
      setSelectedDetail(data);
    } catch (err) {
      console.error("Failed to fetch cell details:", err);
    } finally {
      setSelectedDetailLoading(false);
    }
  };

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`${API_BASE}/analytics/dashboard?today=${today}`);
      const data = await res.json();
      setDashboardData(data);
      if (data.month && data.month.length > 0) {
        const lastCell = data.month[data.month.length - 1];
        setSelectedCell(lastCell);
        fetchCellDetails(lastCell.date);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStreak = async () => {
    try {
      const res = await authFetch(`${API_BASE}/analytics/streak?today=${today}`);
      const data = await res.json();
      setStreakData(data);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !dashboardData) {
    return <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-secondary)' }}>Compiling habit analytics data...</div>;
  }

  const { latestLog, week, month, year } = dashboardData;

  // 1. Day Math
  const dayTasks = latestLog?.tasks || [];
  const totalDayTasks = dayTasks.length;
  const completedDayTasks = dayTasks.filter(t => t.status === 'completed').length;
  const dayTasksPercent = totalDayTasks > 0 ? Math.round((completedDayTasks / totalDayTasks) * 100) : 0;
  
  const dayExpenses = latestLog?.expenses || [];
  const totalDayExpenses = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const dayBudget = latestLog?.dailyBudget || 500;
  const budgetUtilization = Math.round((totalDayExpenses / (dayBudget || 1)) * 100);

  // SVG Chart Helper calculations
  const getTaskChartData = (data) => {
    if (data.length === 0) return null;
    const width = 500;
    const height = 180;
    const padding = 30;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const maxTasks = Math.max(1, ...data.map(d => d.tasksTotal || 0));

    const points = data.map((log, idx) => {
      const x = padding + (idx / Math.max(1, data.length - 1)) * chartWidth;
      const yTotal = padding + (1 - (log.tasksTotal || 0) / maxTasks) * chartHeight;
      const yCompleted = padding + (1 - (log.tasksCompleted || 0) / maxTasks) * chartHeight;
      return { x, yTotal, yCompleted, date: log.date, completed: log.tasksCompleted || 0, total: log.tasksTotal || 0 };
    });

    return { points, maxTasks, width, height, padding };
  };

  const getSpendChartData = (data) => {
    if (data.length === 0) return null;
    const width = 500;
    const height = 180;
    const padding = 30;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const maxSpend = Math.max(1, ...data.map(d => Math.max(d.totalExpenses || 0, d.dailyBudget || 500))) * 1.1;

    const points = data.map((log, idx) => {
      const x = padding + (idx / Math.max(1, data.length - 1)) * chartWidth;
      const yExpenses = padding + (1 - (log.totalExpenses || 0) / maxSpend) * chartHeight;
      const yBudget = padding + (1 - (log.dailyBudget || 500) / maxSpend) * chartHeight;
      return { x, yExpenses, yBudget, date: log.date, totalExpenses: log.totalExpenses || 0, dailyBudget: log.dailyBudget || 500 };
    });

    return { points, maxSpend, width, height, padding };
  };

  const getPointsChartData = (data) => {
    if (data.length === 0) return null;
    const width = 500;
    const height = 180;
    const padding = 30;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const points = data.map((log, idx) => {
      const x = padding + (idx / Math.max(1, data.length - 1)) * chartWidth;
      const scoreNormalized = ((log.points || 0) + 2) / 4; 
      const y = padding + (1 - scoreNormalized) * chartHeight;
      const yZero = padding + 0.5 * chartHeight;
      return { x, y, yZero, points: log.points || 0, date: log.date };
    });

    return { points, width, height, padding };
  };

  const getPointsAreaPaths = (points) => {
    if (points.length < 2) return { posPath: '', negPath: '', linePath: '' };

    let posPath = `M ${points[0].x} ${points[0].yZero}`;
    let negPath = `M ${points[0].x} ${points[0].yZero}`;
    let linePath = `M ${points[0].x} ${points[0].y}`;

    points.forEach((p, i) => {
      posPath += ` L ${p.x} ${Math.min(p.y, p.yZero)}`;
      negPath += ` L ${p.x} ${Math.max(p.y, p.yZero)}`;
      if (i > 0) {
        linePath += ` L ${p.x} ${p.y}`;
      }
    });

    posPath += ` L ${points[points.length - 1].x} ${points[0].yZero} Z`;
    negPath += ` L ${points[points.length - 1].x} ${points[0].yZero} Z`;

    return { posPath, negPath, linePath };
  };

  // SVG Projection Chart renders
  const renderTaskChart = (data) => {
    const chartInfo = getTaskChartData(data);
    if (!chartInfo) return null;

    const { points, maxTasks, width, height, padding } = chartInfo;

    let totalLinePath = '';
    let completedLinePath = '';
    let totalAreaPath = '';
    let completedAreaPath = '';

    if (points.length >= 2) {
      totalLinePath = `M ${points[0].x} ${points[0].yTotal}`;
      completedLinePath = `M ${points[0].x} ${points[0].yCompleted}`;
      totalAreaPath = `M ${points[0].x} ${height - padding}`;
      completedAreaPath = `M ${points[0].x} ${height - padding}`;

      points.forEach(p => {
        totalLinePath += ` L ${p.x} ${p.yTotal}`;
        completedLinePath += ` L ${p.x} ${p.yCompleted}`;
        totalAreaPath += ` L ${p.x} ${p.yTotal}`;
        completedAreaPath += ` L ${p.x} ${p.yCompleted}`;
      });

      totalAreaPath += ` L ${points[points.length - 1].x} ${height - padding} Z`;
      completedAreaPath += ` L ${points[points.length - 1].x} ${height - padding} Z`;
    }

    return (
      <div className="glass-card" style={{ background: 'rgba(0,0,0,0.15)' }}>
        <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>TASK COMPLETION RATIO (DONE VS TOTAL)</span>
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-purple)' }} /> Completed
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} /> Total Tasks
            </span>
          </div>
        </h4>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
          <defs>
            <linearGradient id="taskTotalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
            <linearGradient id="taskDoneGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-purple)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--accent-purple)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <line x1={padding} y1={padding + (height - padding * 2) / 2} x2={width - padding} y2={padding + (height - padding * 2) / 2} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

          {points.length >= 2 && (
            <>
              <path d={totalAreaPath} fill="url(#taskTotalGrad)" />
              <path d={completedAreaPath} fill="url(#taskDoneGrad)" />
              <path d={totalLinePath} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeDasharray="3" />
              <path d={completedLinePath} fill="none" stroke="var(--accent-purple)" strokeWidth="3" strokeLinecap="round" />
            </>
          )}

          {points.map((p, idx) => {
            const showLabel = data.length <= 7 || idx % 5 === 0 || idx === data.length - 1;
            return (
              <g key={idx}>
                {data.length <= 15 && (
                  <circle cx={p.x} cy={p.yCompleted} r="4" fill="var(--accent-purple)" stroke="#fff" strokeWidth="1.5" />
                )}
                {showLabel && (
                  <>
                    <text x={p.x} y={p.yCompleted - 8} fill="#fff" fontSize="8" fontWeight="700" textAnchor="middle">
                      {p.completed}/{p.total}
                    </text>
                    <text x={p.x} y={height - padding + 15} fill="var(--text-secondary)" fontSize="8" textAnchor="middle">
                      {p.date.substring(5)}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const renderSpendChart = (data) => {
    const chartInfo = getSpendChartData(data);
    if (!chartInfo) return null;

    const { points, maxSpend, width, height, padding } = chartInfo;

    let expenseLinePath = '';
    let expenseAreaPath = '';

    if (points.length >= 2) {
      expenseLinePath = `M ${points[0].x} ${points[0].yExpenses}`;
      expenseAreaPath = `M ${points[0].x} ${height - padding}`;

      points.forEach(p => {
        expenseLinePath += ` L ${p.x} ${p.yExpenses}`;
        expenseAreaPath += ` L ${p.x} ${p.yExpenses}`;
      });

      expenseAreaPath += ` L ${points[points.length - 1].x} ${height - padding} Z`;
    }

    return (
      <div className="glass-card" style={{ background: 'rgba(0,0,0,0.15)' }}>
        <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>SPENDING VS BUDGET OUTLAY</span>
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-red)' }} /> Expenses
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: '8px', height: '2px', background: 'var(--accent-cyan)' }} /> Budget Limit
            </span>
          </div>
        </h4>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
          <defs>
            <linearGradient id="spendAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-red)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--accent-red)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <line x1={padding} y1={padding + (height - padding * 2) / 2} x2={width - padding} y2={padding + (height - padding * 2) / 2} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

          {points.length >= 2 && (
            <path 
              d={`M ${points[0].x} ${points[0].yBudget} ` + points.slice(1).map(p => `L ${p.x} ${p.yBudget}`).join(' ')} 
              fill="none" 
              stroke="var(--accent-cyan)" 
              strokeWidth="2" 
              strokeDasharray="4"
            />
          )}

          {points.length >= 2 && (
            <>
              <path d={expenseAreaPath} fill="url(#spendAreaGrad)" />
              <path d={expenseLinePath} fill="none" stroke="var(--accent-red)" strokeWidth="3" strokeLinecap="round" />
            </>
          )}

          {points.map((p, idx) => {
            const showLabel = data.length <= 7 || idx % 5 === 0 || idx === data.length - 1;
            const overBudget = p.totalExpenses > p.dailyBudget;
            return (
              <g key={idx}>
                {data.length <= 15 && (
                  <circle cx={p.x} cy={p.yExpenses} r="4" fill={overBudget ? 'var(--accent-red)' : 'var(--accent-green)'} stroke="#fff" strokeWidth="1.5" />
                )}
                {showLabel && (
                  <>
                    <text x={p.x} y={p.yExpenses - 8} fill="#fff" fontSize="8" fontWeight="700" textAnchor="middle">
                      {p.totalExpenses}
                    </text>
                    <text x={p.x} y={height - padding + 15} fill="var(--text-secondary)" fontSize="8" textAnchor="middle">
                      {p.date.substring(5)}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const renderPointsChart = (data) => {
    const chartInfo = getPointsChartData(data);
    if (!chartInfo) return null;

    const { points, width, height, padding } = chartInfo;
    const { posPath, negPath, linePath } = getPointsAreaPaths(points);

    return (
      <div className="glass-card" style={{ background: 'rgba(0,0,0,0.15)' }}>
        <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>DAILY POINTS GAINED TIMELINE</span>
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-green)' }} /> Positive (+ve)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-red)' }} /> Negative (-ve)
            </span>
          </div>
        </h4>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
          <defs>
            <linearGradient id="posPointsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="negPointsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-red)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--accent-red)" stopOpacity="0.25" />
            </linearGradient>
          </defs>

          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <line x1={padding} y1={padding + (height - padding * 2) / 2} x2={width - padding} y2={padding + (height - padding * 2) / 2} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="3" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

          {points.length >= 2 && (
            <>
              <path d={posPath} fill="url(#posPointsGrad)" />
              <path d={negPath} fill="url(#negPointsGrad)" />
              <path d={linePath} fill="none" stroke="var(--accent-cyan)" strokeWidth="3" strokeLinecap="round" />
            </>
          )}

          {points.map((p, idx) => {
            const showLabel = data.length <= 7 || idx % 5 === 0 || idx === data.length - 1;
            return (
              <g key={idx}>
                {data.length <= 15 && (
                  <circle cx={p.x} cy={p.y} r="4" fill={p.points >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'} stroke="#fff" strokeWidth="1.5" />
                )}
                {showLabel && (
                  <>
                    <text x={p.x} y={p.points >= 0 ? p.y - 8 : p.y + 12} fill="#fff" fontSize="8" fontWeight="700" textAnchor="middle">
                      {p.points > 0 ? `+${p.points}` : p.points}
                    </text>
                    <text x={p.x} y={height - padding + 15} fill="var(--text-secondary)" fontSize="8" textAnchor="middle">
                      {p.date.substring(5)}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const positiveDays = month.filter(c => c.points > 0).length;
  const negativeDays = month.filter(c => c.points < 0).length;
  const perfectDays = month.filter(c => c.points === 2.0).length;
  const disasterDays = month.filter(c => c.points === -2.0).length;

  const getDayRating = (pts) => {
    if (pts === 2.0) return "PERFECT ASCENDED DAY 🌟";
    if (pts === 1.0) return "VICTORIOUS DAY ⚔️";
    if (pts === 0.0) return "MAINTAINED BOUNDS 👍";
    if (pts === -1.0) return "LOST CONTROL ⚠️";
    return "CRITICAL DEFEAT 💀";
  };

  // 4. Year Designation
  const getYearlyRating = () => {
    if (year.length === 0) return 'Novice Raider';
    const sumPoints = year.reduce((sum, m) => sum + m.avgPoints, 0);
    const avg = sumPoints / year.length;

    if (avg >= 1.5) return 'Habit Overlord (Gold 🥇)';
    if (avg >= 0.8) return 'Streak Addict (Silver 🥈)';
    if (avg >= 0) return 'Routine Warrior (Bronze 🥉)';
    if (avg >= -0.8) return 'Procrastination Sufferer (Sloth)';
    return 'Chaos Lord (Danger Zone 💀)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem' }}>Addictive Habit Analytics</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Track your score trends, points history, and streak integrity closely. Do not break the chain!</p>
        </div>

        {/* Pulsing Streak counters for high engagement */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1.5rem', borderLeft: '4px solid var(--accent-orange)' }}>
            <Flame size={24} color="var(--accent-orange)" className="fire-emoji" />
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Current Streak</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-orange)' }}>{streakData.currentStreak} Days</div>
            </div>
          </div>
          
          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1.5rem', borderLeft: '4px solid var(--accent-gold)' }}>
            <Award size={24} color="var(--accent-gold)" />
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Longest Streak</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-gold)' }}>{streakData.longestStreak} Days</div>
            </div>
          </div>
        </div>
      </div>

      {/* DASHBOARD TABS */}
      <div className="tabs-container">
        <button onClick={() => setActiveTab('day')} className={`tab-btn ${activeTab === 'day' ? 'active' : ''}`}>Day Metrics</button>
        <button onClick={() => setActiveTab('week')} className={`tab-btn ${activeTab === 'week' ? 'active' : ''}`}>Week Charts</button>
        <button onClick={() => setActiveTab('month')} className={`tab-btn ${activeTab === 'month' ? 'active' : ''}`}>Streak Calendar</button>
        <button onClick={() => setActiveTab('year')} className={`tab-btn ${activeTab === 'year' ? 'active' : ''}`}>Year Milestones</button>
      </div>

      {/* DANGER ALERTS IF USER IS SLOWING DOWN */}
      {streakData.currentStreak === 0 && (
        <div className="glass-card animate-pulse" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
          <ShieldAlert size={28} color="var(--accent-red)" />
          <div>
            <h4 style={{ fontWeight: 800, color: 'var(--accent-red)', fontSize: '1rem' }}>STREAK CRITICAL: NO ACTIVE STREAK 🔥</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>You currently have a 0-day streak. Complete your mandatory routines today or your score multiplier decays!</p>
          </div>
        </div>
      )}

      {/* TAB CONTENT PANEL */}
      <div className="glass-card">
        {/* DAY VIEW */}
        {activeTab === 'day' && (
          <div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={20} color="var(--accent-purple)" />
              Daily Habit & Outlay Breakdown ({latestLog ? latestLog.date : 'No Logs Yet'})
            </h3>

            {!latestLog ? (
              <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '3rem' }}>No data logged. Save a daily log to see dashboard details!</p>
            ) : (
              <div className="grid-3" style={{ alignItems: 'start' }}>
                {/* Circular Progress Gauge */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.01)' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>ROUTINES COMPLETED</span>
                  <div style={{ position: 'relative', width: '120px', height: '120px' }}>
                    <svg width="120" height="120" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="50" fill="none" stroke="var(--bg-grid)" strokeWidth="10" />
                      <circle 
                        cx="60" 
                        cy="60" 
                        r="50" 
                        fill="none" 
                        stroke="var(--accent-purple)" 
                        strokeWidth="10" 
                        strokeDasharray={2 * Math.PI * 50}
                        strokeDashoffset={2 * Math.PI * 50 * (1 - dayTasksPercent / 100)}
                        strokeLinecap="round"
                        transform="rotate(-90 60 60)"
                        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                      />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{dayTasksPercent}%</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{completedDayTasks}/{totalDayTasks} DONE</span>
                    </div>
                  </div>
                </div>

                {/* Score slider */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.01)' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Daily Net Point Score</span>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, color: latestLog.points >= 1 ? 'var(--accent-green)' : latestLog.points >= 0 ? 'var(--accent-blue)' : 'var(--accent-red)' }}>
                    {latestLog.points > 0 ? `+${latestLog.points}` : latestLog.points}
                  </div>
                  <div style={{ background: '#1e293b', height: '8px', borderRadius: '4px', position: 'relative', margin: '0.5rem 0' }}>
                    <div style={{ position: 'absolute', top: '-4px', left: `${((latestLog.points + 2) / 4) * 100}%`, width: '16px', height: '16px', borderRadius: '50%', background: 'var(--accent-purple)', border: '2px solid #fff' }}></div>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    {latestLog.points >= 1.5 ? 'Ascended Day. Boss completely obliterated! ⚔️' :
                     latestLog.points >= 0.5 ? 'Positive loops. You defended the streak! 👍' :
                     latestLog.points >= 0 ? 'Neutral. Watch your spending and tasks.' :
                     'Loss of Streak Control. Defeated by shadow habits! ⚠️'}
                  </p>
                </div>

                {/* Spending Progress thermometer */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>WALLET COST</span>
                    <span style={{ fontWeight: 800, color: totalDayExpenses > dayBudget ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                      {totalDayExpenses} / {dayBudget} INR
                    </span>
                  </div>

                  <div className="hp-bar" style={{ height: '12px' }}>
                    <div 
                      className="hp-fill" 
                      style={{ 
                        width: `${Math.min(100, budgetUtilization)}%`,
                        background: totalDayExpenses > dayBudget ? 'var(--accent-red)' : 'linear-gradient(90deg, var(--accent-green), var(--accent-cyan))'
                      }}
                    ></div>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {totalDayExpenses > dayBudget ? 
                      "⚠️ Over Budget limit! Dealt damage to your life points." : 
                      "Safe! Staying under limit gains +0.5 points."}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* WEEK VIEW */}
        {activeTab === 'week' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={20} color="var(--accent-cyan)" />
                Performance Projections
              </h3>
              
              <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.05)', padding: '0.25rem', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                <button 
                  onClick={() => setChartTimeframe('week')}
                  style={{ 
                    border: 'none', 
                    background: chartTimeframe === 'week' ? 'var(--accent-purple)' : 'transparent',
                    color: '#fff',
                    padding: '0.4rem 1rem',
                    borderRadius: '16px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  7 Days (Week Logs)
                </button>
                <button 
                  onClick={() => setChartTimeframe('month')}
                  style={{ 
                    border: 'none', 
                    background: chartTimeframe === 'month' ? 'var(--accent-purple)' : 'transparent',
                    color: '#fff',
                    padding: '0.4rem 1rem',
                    borderRadius: '16px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  30 Days (Month Logs)
                </button>
              </div>
            </div>

            {(() => {
              const dataset = chartTimeframe === 'week' ? week : month;
              if (dataset.length === 0) {
                return <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '3rem' }}>No data logged for this timeframe. Save daily logs to generate graphs.</p>;
              }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div className="grid-2">
                    {renderTaskChart(dataset)}
                    {renderSpendChart(dataset)}
                  </div>
                  <div style={{ width: '100%' }}>
                    {renderPointsChart(dataset)}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* MONTH VIEW: Streak Calendar */}
        {activeTab === 'month' && (
          <div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={20} color="var(--accent-green)" />
              Streak Calendar Grid
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Shows daily performance ratings (+ve or -ve). Maintain positive points to protect your streak!
            </p>

            {month.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '3rem' }}>No data logged. Save daily logs to populate contribution blocks.</p>
            ) : (
              <div className="grid-2" style={{ alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="contrib-grid">
                    {month.map((cell, idx) => {
                      let scoreClass = 'score-0';
                      if (cell.points >= 1.5) scoreClass = 'score-pos-2';
                      else if (cell.points > 0) scoreClass = 'score-pos-1';
                      else if (cell.points < -1.0) scoreClass = 'score-neg-2';
                      else if (cell.points < 0) scoreClass = 'score-neg-1';

                      return (
                        <div 
                          key={idx} 
                          className={`contrib-cell ${scoreClass} ${selectedCell?.date === cell.date ? 'active-success' : ''}`}
                          data-tooltip={`${cell.date}: Score ${cell.points > 0 ? `+${cell.points}` : cell.points} | Spent: ${cell.totalExpenses}/${cell.dailyBudget} INR`}
                          onClick={() => {
                            setSelectedCell(cell);
                            fetchCellDetails(cell.date);
                          }}
                          style={{ position: 'relative' }}
                        >
                          {(() => {
                            const parts = cell.date.split('-');
                            const day = parseInt(parts[2], 10);
                            const monthIndex = parseInt(parts[1], 10) - 1;
                            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            
                            if (day === 1 || idx === 0) {
                              return (
                                <span style={{ fontSize: '0.62rem', whiteSpace: 'nowrap' }}>
                                  {months[monthIndex]} {day}
                                </span>
                              );
                            }
                            return day;
                          })()}
                          {cell.totalExpenses > cell.dailyBudget && (
                            <span 
                              style={{ 
                                position: 'absolute', 
                                top: '2px', 
                                right: '2px', 
                                width: '4px', 
                                height: '4px', 
                                borderRadius: '50%', 
                                background: 'var(--accent-red)',
                                boxShadow: '0 0 4px var(--accent-red)'
                              }} 
                              title="Budget Exceeded!"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', alignSelf: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>Defeated (-2)</span>
                    <div className="contrib-cell score-neg-2" style={{ width: '15px', height: '15px' }}></div>
                    <div className="contrib-cell score-neg-1" style={{ width: '15px', height: '15px' }}></div>
                    <div className="contrib-cell score-0" style={{ width: '15px', height: '15px' }}></div>
                    <div className="contrib-cell score-pos-1" style={{ width: '15px', height: '15px' }}></div>
                    <div className="contrib-cell score-pos-2" style={{ width: '15px', height: '15px' }}></div>
                    <span>Ascended (+2)</span>
                  </div>
                </div>

                {/* Detailed Historical Report panel on the right */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {selectedDetailLoading ? (
                    <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Loading day history details...
                    </div>
                  ) : selectedDetail ? (
                    <div className="glass-card" style={{ background: 'rgba(255,255,255,0.015)', borderLeft: '4px solid var(--accent-green)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>LOG DETAIL: {selectedDetail.log?.date}</h4>
                        <span style={{ 
                          fontSize: '0.8rem', 
                          fontWeight: 700, 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '4px',
                          background: selectedDetail.log?.points >= 1 ? 'rgba(16, 185, 129, 0.15)' : selectedDetail.log?.points >= 0 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: selectedDetail.log?.points >= 1 ? 'var(--accent-green)' : selectedDetail.log?.points >= 0 ? 'var(--accent-blue)' : 'var(--accent-red)',
                          border: '1px solid currentColor'
                        }}>
                          Score: {selectedDetail.log?.points > 0 ? `+${selectedDetail.log.points}` : selectedDetail.log?.points}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Rating:</span>
                          <span style={{ fontWeight: 700 }}>{getDayRating(selectedDetail.log?.points)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Commitment Lock:</span>
                          <span style={{ fontWeight: 700, color: selectedDetail.log?.isLocked ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
                            {selectedDetail.log?.isLocked ? 'LOCKED 🔒' : 'UNLOCKED 🔓'}
                          </span>
                        </div>
                      </div>

                      {/* DIARY NOTE */}
                      <div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Diary Note</span>
                        <div style={{ 
                          background: 'rgba(255,255,255,0.01)', 
                          border: '1px solid var(--border-color)', 
                          padding: '0.75rem', 
                          borderRadius: '4px', 
                          fontSize: '0.9rem',
                          fontStyle: selectedDetail.log?.note ? 'normal' : 'italic',
                          color: selectedDetail.log?.note ? 'var(--text-primary)' : 'var(--text-secondary)',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {selectedDetail.log?.note || "No note recorded for this day."}
                        </div>
                      </div>

                      {/* TASK CHECKLIST STATUS */}
                      <div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Routines Checklist</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {(selectedDetail.log?.tasks || []).length === 0 ? (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No tasks assigned.</p>
                          ) : (
                            selectedDetail.log.tasks.map((task, tidx) => (
                              <div key={tidx} style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                fontSize: '0.85rem', 
                                background: 'rgba(255,255,255,0.02)',
                                padding: '0.4rem 0.6rem',
                                borderRadius: '4px',
                                border: '1px solid rgba(255,255,255,0.03)'
                              }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ 
                                    width: '8px', 
                                    height: '8px', 
                                    borderRadius: '50%', 
                                    background: task.isMandatory ? 'var(--accent-purple)' : 'var(--accent-cyan)' 
                                  }} title={task.isMandatory ? 'Mandatory Task' : 'Extra Task'} />
                                  <span>{task.text}</span>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>({task.category})</span>
                                </span>
                                <span style={{ 
                                  fontWeight: 700,
                                  color: task.status === 'completed' ? 'var(--accent-green)' : (task.status === 'failed' || task.status === 'rejected') ? 'var(--accent-red)' : 'var(--accent-orange)'
                                }}>
                                  {task.status.toUpperCase()}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* BUDGET LIMIT & EXPENSES */}
                      <div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Budget & Expenses</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '4px' }}>
                          <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                            <span>Total Spend:</span>
                            <span style={{ fontWeight: 700, color: (selectedDetail.log?.expenses || []).reduce((sum, e) => sum + e.amount, 0) > (selectedDetail.log?.dailyBudget || 500) ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                              {(selectedDetail.log?.expenses || []).reduce((sum, e) => sum + e.amount, 0)} INR / {selectedDetail.log?.dailyBudget || 500} INR
                            </span>
                          </div>
                          {(selectedDetail.log?.expenses || []).length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                              {selectedDetail.log.expenses.map((exp, eidx) => (
                                <span key={eidx} style={{ 
                                  fontSize: '0.7rem', 
                                  background: 'rgba(0,0,0,0.2)', 
                                  padding: '0.2rem 0.5rem', 
                                  borderRadius: '3px',
                                  border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                  {exp.title}: {exp.amount}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* CRITIQUE ENGINE FEEDBACK */}
                      <div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Self-Critique Engine</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {selectedDetail.critique?.critiques?.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              {selectedDetail.critique.critiques.map((crit, cidx) => (
                                <div key={cidx} className="critique-box negative">
                                  {crit}
                                </div>
                              ))}
                            </div>
                          )}

                          {selectedDetail.critique?.achievements?.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              {selectedDetail.critique.achievements.map((ach, aidx) => (
                                <div key={aidx} className="critique-box positive">
                                  {ach}
                                </div>
                              ))}
                            </div>
                          )}

                          {(!selectedDetail.critique?.critiques?.length && !selectedDetail.critique?.achievements?.length) && (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No critique compiled for this entry.</p>
                          )}
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Select a day on the calendar to see details.
                    </div>
                  )}

                  {/* Tension Log - showing positive vs negative counts */}
                  <div className="glass-card" style={{ background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.75rem' }}>
                      <ShieldAlert size={16} /> TENSION HABIT AUDIT
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                        <span>Perfect Days (+2.0):</span>
                        <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{perfectDays} Days</span>
                      </div>
                      
                      <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                        <span>Critical Defeats (-2.0):</span>
                        <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>{disasterDays} Days</span>
                      </div>

                      <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                        <span>Total Streak Keepers (+ve):</span>
                        <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{positiveDays} Days</span>
                      </div>

                      <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                        <span>Total Streak Breakers (-ve):</span>
                        <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>{negativeDays} Days</span>
                      </div>
                    </div>
                    
                    {negativeDays > 0 && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.75rem', fontStyle: 'italic', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                        ⚠️ You let procrastination win {negativeDays} times! Slay the boss today to secure your streak.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* YEAR VIEW */}
        {activeTab === 'year' && (
          <div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award size={20} color="var(--accent-gold)" />
              Yearly Milestones & Designation Averages
            </h3>

            {year.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '3rem' }}>No historical logs recorded yet.</p>
            ) : (
              <div className="grid-2" style={{ alignItems: 'start' }}>
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', background: 'rgba(255,255,255,0.01)', textAlign: 'center' }}>
                  <Sparkles size={40} color="var(--accent-gold)" className="fire-emoji" />
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>YEAR DESIGNATION RATING</span>
                    <h4 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.25rem 0' }}>{getYearlyRating()}</h4>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', width: '100%', paddingTop: '1rem', display: 'flex', justifyContent: 'space-around' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Months Count</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{year.length}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Cumulative Cost</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-red)' }}>
                        {year.reduce((sum, m) => sum + m.totalExpenses, 0)} INR
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>MONTH-OVER-MONTH AVERAGE POINTS</h4>
                  <svg viewBox="0 0 500 150" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                    <line x1="30" y1="15" x2="470" y2="15" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                    <line x1="30" y1="65" x2="470" y2="65" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                    <line x1="30" y1="115" x2="470" y2="115" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                    {year.map((m, idx) => {
                      const width = 500;
                      const height = 150;
                      const padding = 30;
                      const chartWidth = width - padding * 2;
                      const barWidth = Math.max(15, chartWidth / (year.length * 2));
                      const x = padding + (idx / year.length) * chartWidth + barWidth / 2;
                      
                      const scoreRatio = m.avgPoints / 2; // -1 to 1
                      const barHeight = Math.abs(scoreRatio * 50); // max 50px high
                      const y = scoreRatio >= 0 ? 65 - barHeight : 65;

                      return (
                        <g key={idx}>
                          <rect 
                            x={x} 
                            y={y} 
                            width={barWidth} 
                            height={Math.max(2, barHeight)} 
                            fill={m.avgPoints >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}
                            rx="2"
                          />
                          <text x={x + barWidth / 2} y={scoreRatio >= 0 ? y - 5 : y + barHeight + 10} fill="#fff" fontSize="8" fontWeight="700" textAnchor="middle">
                            {m.avgPoints > 0 ? `+${m.avgPoints}` : m.avgPoints}
                          </text>
                          <text x={x + barWidth / 2} y="140" fill="var(--text-secondary)" fontSize="8" textAnchor="middle">
                            {m.month.substring(5)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
