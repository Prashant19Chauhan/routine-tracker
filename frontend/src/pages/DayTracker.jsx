import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Check, X, ShieldAlert, Sparkles, IndianRupee, ArrowLeft, ArrowRight, Lock, Unlock } from 'lucide-react';
import DailyBoss from '../components/DailyBoss';
import { playTaskComplete, playBossDamage, playBossDefeat, playError } from '../audio';

const parseTaskText = (text) => {
  if (!text) return { timeSlot: null, description: '' };
  const match = text.match(/^([^:]+):\s*(.+)$/);
  if (match) {
    return { timeSlot: match[1].trim(), description: match[2].trim() };
  }
  return { timeSlot: null, description: text };
};

export default function DayTracker({ API_BASE, onLogSaved }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);

  // Task & Expense Forms state
  const [newExtraTask, setNewExtraTask] = useState('');
  const [expenseForm, setExpenseForm] = useState({ title: '', amount: '', category: 'general' });

  // Confetti Canvas Ref & State
  const canvasRef = useRef(null);
  const [confettiActive, setConfettiActive] = useState(false);

  // Doom timer and screen flash states
  const [showDamageFlash, setShowDamageFlash] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  // Backlog and diary review states
  const [pendingBucket, setPendingBucket] = useState([]);
  const [critique, setCritique] = useState({ critiques: [], achievements: [] });

  // For sound trigger checks
  const prevBossHPRef = useRef(100);
  const prevExpensesExceededRef = useRef(false);

  useEffect(() => {
    fetchLog();
    fetchPendingBucket();
  }, [date]);

  const fetchLog = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/logs/${date}`);
      const data = await res.json();
      setLog(data.log);
      setCritique(data.critique || { critiques: [], achievements: [] });
      
      // Reset sound checks
      prevBossHPRef.current = calculateBossHP(data.log.tasks);
      prevExpensesExceededRef.current = calculateTotalExpenses(data.log.expenses) > data.log.dailyBudget;
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingBucket = async () => {
    try {
      const res = await fetch(`${API_BASE}/logs/pending-bucket`);
      const data = await res.json();
      setPendingBucket(data);
    } catch (err) {
      console.error(err);
    }
  };

  const resolvePendingTask = async (dateStr, text) => {
    try {
      const res = await fetch(`${API_BASE}/logs/resolve-pending`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, text })
      });
      const data = await res.json();
      if (res.ok) {
        playTaskComplete();
        fetchPendingBucket();
        if (date === dateStr) {
          setLog(data.log);
          setCritique(data.critique || { critiques: [], achievements: [] });
        }
        if (onLogSaved) onLogSaved();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Doom Countdown Timer effect
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const targetDate = new Date(date);
      const isToday = now.toISOString().split('T')[0] === date;

      if (!isToday) {
        if (now > targetDate) {
          setTimeLeft("DAY RECKONED");
          setIsUrgent(false);
        } else {
          setTimeLeft("UPCOMING DAY");
          setIsUrgent(false);
        }
        return;
      }

      const midnight = new Date();
      midnight.setHours(23, 59, 59, 999);
      
      const diff = midnight - now;
      if (diff <= 0) {
        setTimeLeft("RECKONING!");
        setIsUrgent(true);
        return;
      }

      const hours = String(Math.floor(diff / 3600000)).padStart(2, '0');
      const mins = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
      const secs = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');

      setTimeLeft(`${hours}:${mins}:${secs}`);

      // Check if there are incomplete mandatory tasks
      const hasIncompleteMandatory = log?.tasks?.some(t => t.isMandatory && t.status === 'pending');
      const under6Hours = diff < 6 * 3600000;
      setIsUrgent(hasIncompleteMandatory && under6Hours);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [date, log]);

  // Canvas Confetti Effect
  useEffect(() => {
    if (!confettiActive || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height + 20,
        vx: (Math.random() - 0.5) * 15,
        vy: -Math.random() * 20 - 10,
        radius: Math.random() * 5 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity: 0.4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10
      });
    }

    let animationId;
    const update = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let active = false;

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rotation += p.rotationSpeed;

        if (p.y < canvas.height + 20) {
          active = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.radius, -p.radius, p.radius * 2, p.radius * 2);
          ctx.restore();
        }
      });

      if (active) {
        animationId = requestAnimationFrame(update);
      } else {
        setConfettiActive(false);
      }
    };

    update();
    return () => cancelAnimationFrame(animationId);
  }, [confettiActive]);

  const triggerConfetti = () => {
    setConfettiActive(true);
  };

  const triggerDamageFlash = () => {
    setShowDamageFlash(true);
    setTimeout(() => setShowDamageFlash(false), 800);
  };

  // Helper Calculations
  const calculateTotalExpenses = (expenses = []) => {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  };

  const calculateBossHP = (tasks = []) => {
    const mandatory = tasks.filter(t => t.isMandatory);
    if (mandatory.length === 0) return 0;
    const completed = mandatory.filter(t => t.status === 'completed').length;
    return 100 - (completed / mandatory.length) * 100;
  };

  const calculatePlayerHP = (expenses = [], budget = 500) => {
    const total = calculateTotalExpenses(expenses);
    if (total <= budget) return 100;
    const penaltyRatio = (total - budget) / budget;
    return Math.max(0, 100 - penaltyRatio * 100);
  };

  // Action: Add Extra Task
  const handleAddExtraTask = () => {
    if (!newExtraTask.trim()) return;
    const updatedTasks = [
      ...log.tasks,
      { text: newExtraTask.trim(), category: 'extra task', isMandatory: false, status: 'pending' }
    ];
    updateLogTasks(updatedTasks);
    setNewExtraTask('');
  };

  // Action: Toggle Task Status
  const handleTaskStatus = (taskIndex, status) => {
    const task = log.tasks[taskIndex];
    const isCategoryRestriction = task.category.toLowerCase().includes('restrict');
    
    let nextStatus = status;
    if (task.status === status) {
      nextStatus = 'pending';
    }

    const updatedTasks = log.tasks.map((t, idx) => {
      if (idx === taskIndex) {
        return { ...t, status: nextStatus };
      }
      return t;
    });

    // Sound and visual Triggers
    if (nextStatus === 'completed') {
      playTaskComplete();
    } else if (nextStatus === 'failed') {
      triggerDamageFlash();
      if (isCategoryRestriction) {
        playError(); 
      } else {
        playBossDamage();
      }
    }

    updateLogTasks(updatedTasks);
  };

  // Action: Delete Task
  const handleDeleteTask = (taskIndex) => {
    if (log.isLocked) return;
    const updatedTasks = log.tasks.filter((_, idx) => idx !== taskIndex);
    updateLogTasks(updatedTasks);
  };

  const updateLogTasks = (updatedTasks) => {
    const newBossHP = calculateBossHP(updatedTasks);
    
    // Check if boss was damaged
    if (newBossHP < prevBossHPRef.current) {
      if (newBossHP <= 0) {
        playBossDefeat();
        triggerConfetti();
      } else {
        playBossDamage();
      }
    }
    prevBossHPRef.current = newBossHP;

    const updatedLog = { ...log, tasks: updatedTasks };
    setLog(updatedLog);
    saveLog(updatedLog);
  };

  // Action: Add Expense
  const handleAddExpense = (e) => {
    e.preventDefault();
    if (!expenseForm.title.trim() || !expenseForm.amount) return;

    const newExpense = {
      title: expenseForm.title.trim(),
      amount: parseFloat(expenseForm.amount),
      category: expenseForm.category
    };

    const updatedExpenses = [...log.expenses, newExpense];
    const newTotal = calculateTotalExpenses(updatedExpenses);
    
    // Check budget limit exceeded
    if (newTotal > log.dailyBudget) {
      triggerDamageFlash();
      if (!prevExpensesExceededRef.current) {
        playError();
        prevExpensesExceededRef.current = true;
      }
    }

    const updatedLog = { ...log, expenses: updatedExpenses };
    setLog(updatedLog);
    setExpenseForm({ title: '', amount: '', category: 'general' });
    saveLog(updatedLog);
  };

  // Action: Delete Expense
  const handleDeleteExpense = (idx) => {
    if (log.isLocked) return;
    const updatedExpenses = log.expenses.filter((_, i) => i !== idx);
    const newTotal = calculateTotalExpenses(updatedExpenses);
    if (newTotal <= log.dailyBudget) {
      prevExpensesExceededRef.current = false;
    }
    const updatedLog = { ...log, expenses: updatedExpenses };
    setLog(updatedLog);
    saveLog(updatedLog);
  };

  // Action: Update Budget
  const handleUpdateBudget = (amount) => {
    const val = parseFloat(amount) || 0;
    if (log.isLocked && val > log.dailyBudget) {
      alert("Commitment Lock Active: You cannot increase the daily budget!");
      return;
    }
    const updatedLog = { ...log, dailyBudget: val };
    setLog(updatedLog);
    saveLog(updatedLog);
  };

  // Action: Activate Commitment Lock (Trapping Feature)
  const handleLockCommitment = async () => {
    if (log.isLocked) return;
    setShowLockModal(true);
  };

  const confirmLockPact = async () => {
    setShowLockModal(false);
    const updatedLog = { ...log, isLocked: true };
    setLog(updatedLog);
    playBossDamage(); // play a heavy chime
    saveLog(updatedLog);
  };

  // Action: Update Reflection Note
  const handleUpdateNote = (note) => {
    const updatedLog = { ...log, note };
    setLog(updatedLog);
  };

  const saveLog = async (logToSave) => {
    try {
      const res = await fetch(`${API_BASE}/logs/${date}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logToSave)
      });
      const savedData = await res.json();
      if (res.ok) {
        setLog(savedData.log);
        setCritique(savedData.critique || { critiques: [], achievements: [] });
        fetchPendingBucket();
        if (onLogSaved) onLogSaved(); // notify App to refresh streak
      } else {
        alert(savedData.error);
        fetchLog(); // refresh local state
      }
    } catch (err) {
      console.error('Save error', err);
    }
  };

  // Shift Date Helper
  const shiftDate = (days) => {
    const current = new Date(date);
    current.setDate(current.getDate() + days);
    setDate(current.toISOString().split('T')[0]);
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-secondary)' }}>Loading daily routine log...</div>;
  }

  const bossHP = calculateBossHP(log.tasks);
  const playerHP = calculatePlayerHP(log.expenses, log.dailyBudget);
  const totalExpenses = calculateTotalExpenses(log.expenses);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {confettiActive && <canvas ref={canvasRef} className="confetti-canvas" />}
      {showDamageFlash && <div className="screen-flash-red"></div>}

      {/* Date Selector Header */}
      <div className="glass-card date-selector-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem' }}>
        <button onClick={() => shiftDate(-1)} className="icon-btn" style={{ border: '1px solid var(--border-color)' }}>
          <ArrowLeft size={18} />
        </button>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <input 
            type="date" 
            className="input-field" 
            style={{ width: '160px', textAlign: 'center', background: 'transparent', border: 'none', fontSize: '1.25rem', fontWeight: 800, padding: 0 }}
            value={date} 
            onChange={(e) => setDate(e.target.value)} 
          />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
        </div>

        {/* Doom Countdown Timer Widget */}
        <div className={`doom-timer ${isUrgent ? 'warning' : ''}`} title="Time left until your daily routines lock and streak is scored.">
          <ShieldAlert size={16} />
          <span>{timeLeft}</span>
        </div>

        <button onClick={() => shiftDate(1)} className="icon-btn" style={{ border: '1px solid var(--border-color)' }}>
          <ArrowRight size={18} />
        </button>
      </div>

      <div className="grid-2">
        {/* GAME HUB: Boss & Live Points */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <DailyBoss bossHP={bossHP} playerHP={playerHP} />
          
          <div className="glass-card points-gauge-container" style={{ position: 'relative' }}>
            {/* Lock Status overlay indicator */}
            <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
              {log.isLocked ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                  <Lock size={12} /> LOCKED PACT
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                  <Unlock size={12} /> OPEN STATE
                </span>
              )}
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Live points score
            </h3>
            <div className="points-value">
              {log.points > 0 ? `+${log.points}` : log.points}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Formula scales based on mandatory completion, extra task rewards, expense budget, and followed restrictions.
            </p>
            
            <div className="points-gauge-track">
              <div 
                className="points-gauge-marker"
                style={{ left: `${((log.points + 2) / 4) * 100}%` }}
              ></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              <span>DREAD (-2.0)</span>
              <span>NEUTRAL (0)</span>
              <span>ASCENDED (+2.0)</span>
            </div>

            {/* Commitment lock action button */}
            <div className="lock-button-container">
              <button 
                onClick={handleLockCommitment} 
                className={`commitment-lock-btn ${log.isLocked ? 'locked' : ''}`}
                disabled={log.isLocked}
              >
                <Lock size={16} />
                <span>{log.isLocked ? 'COMMITMENT ACTIVATED' : 'LOCK COMMITMENT FOR TODAY'}</span>
              </button>
              {!log.isLocked && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Disables deleting tasks, deleting expenses, and budget extensions. Prevents cheating.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* PENDING TASKS BACKLOG BUCKET */}
        {pendingBucket.length > 0 && (
          <div className="glass-card pending-bucket-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-orange)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={18} />
                Pending Tasks Backlog ({pendingBucket.length})
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                These tasks were missed on previous days. Resolve them to clean your backlog diary!
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
              {pendingBucket.map((item, idx) => (
                <div key={idx} className="pending-item">
                  <div className="pending-item-details">
                    <span className="pending-item-date">{item.date}</span>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.text}</span>
                  </div>
                  <button 
                    onClick={() => resolvePendingTask(item.date, item.text)} 
                    className="submit-btn" 
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', background: 'linear-gradient(135deg, var(--accent-orange) 0%, var(--accent-red) 100%)' }}
                  >
                    Resolve
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* COMPLIANCE CHECKLIST */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Routine Tasks <span style={{ color: 'var(--accent-purple)' }}>({log.tasks.length})</span>
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              Complete mandatory tasks from weekly list. Mark restrictions as Done (Kept) or Failed (Broken).
            </p>
          </div>

          {/* Quick Add Extra Task */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Add custom daily extra task..." 
              value={newExtraTask}
              onChange={(e) => setNewExtraTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddExtraTask()}
            />
            <button onClick={handleAddExtraTask} className="submit-btn">
              <Plus size={18} />
            </button>
          </div>

          {/* Task Render */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '120vh', overflowY: 'auto' }}>
            {log.tasks.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', padding: '2rem' }}>
                No tasks logged. Visit Goals tab to define weekly routines or add custom tasks here!
              </p>
            ) : (
              log.tasks.map((task, idx) => (
                <div 
                  key={idx} 
                  className={`task-row ${task.status === 'completed' ? 'completed' : task.status === 'failed' ? 'failed' : ''}`}
                >
                  <div className="task-info">
                    <span className={`task-tag ${
                      task.category.includes('physical') ? 'physical' :
                      task.category.includes('study') ? 'study' :
                      task.category.includes('routine') ? 'routine' :
                      task.category.includes('restrict') ? 'restriction' : 'extra'
                    }`}>
                      {task.category}
                    </span>
                    {(() => {
                      const { timeSlot, description } = parseTaskText(task.text);
                      const isRoutine = task.category.toLowerCase().includes('routine') || task.category.toLowerCase().includes('routing');
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start' }}>
                          {isRoutine && timeSlot && (
                            <span style={{ 
                              fontSize: '0.75rem', 
                              fontWeight: 700, 
                              color: 'var(--accent-cyan)', 
                              background: 'rgba(6, 182, 212, 0.1)', 
                              padding: '0.15rem 0.4rem', 
                              borderRadius: '4px',
                              border: '1px solid rgba(6, 182, 212, 0.2)',
                              width: 'fit-content',
                              fontFamily: 'monospace'
                            }}>
                              ⏰ {timeSlot}
                            </span>
                          )}
                          <span style={{ 
                            textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                            color: task.status === 'completed' ? 'var(--text-muted)' : 'inherit',
                            fontWeight: 600
                          }}>
                            {description}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="task-btn-group">
                    <button 
                      onClick={() => handleTaskStatus(idx, 'completed')}
                      className={`icon-btn ${task.status === 'completed' ? 'active-success' : 'btn-success'}`}
                      title="Mark Success/Kept"
                    >
                      <Check size={14} />
                    </button>
                    <button 
                      onClick={() => handleTaskStatus(idx, 'failed')}
                      className={`icon-btn ${task.status === 'failed' ? 'active-danger' : 'btn-danger'}`}
                      title="Mark Failed/Broken"
                    >
                      <X size={14} />
                    </button>
                    
                    {/* Render lock icon instead of delete if log isLocked */}
                    {!task.isMandatory && (
                      log.isLocked ? (
                        <button className="icon-btn" style={{ cursor: 'not-allowed', opacity: 0.5 }} title="Locked">
                          <Lock size={14} />
                        </button>
                      ) : (
                        <button onClick={() => handleDeleteTask(idx)} className="icon-btn btn-danger">
                          <Trash2 size={14} />
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* EXPENSES TRACKING */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Daily Expense Tracker
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              Keep total spending under the threshold. Going over deals damage to your HP and hurts points.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>DAILY BUDGET LIMIT</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <IndianRupee size={16} color="var(--text-secondary)" />
                <input 
                  type="number" 
                  className="input-field" 
                  style={{ background: 'transparent', padding: '0.2rem', border: 'none', borderBottom: '1px solid var(--border-color)', borderRadius: 0, fontSize: '1.1rem', fontWeight: 700 }}
                  value={log.dailyBudget} 
                  onChange={(e) => handleUpdateBudget(e.target.value)}
                  disabled={log.isLocked}
                />
              </div>
            </div>
            
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>TOTAL SPENT</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '1.3rem', fontWeight: 800, color: totalExpenses > log.dailyBudget ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                <IndianRupee size={18} />
                <span>{totalExpenses}</span>
              </div>
            </div>
          </div>

          {/* Budget Progress Meter */}
          <div className="boss-bar-container" style={{ margin: 0 }}>
            <div className="boss-bar-label">
              <span>Budget Usage</span>
              <span>{Math.round((totalExpenses / (log.dailyBudget || 1)) * 100)}%</span>
            </div>
            <div className="hp-bar" style={{ height: '10px' }}>
              <div 
                className="hp-fill" 
                style={{ 
                  width: `${Math.min(100, (totalExpenses / (log.dailyBudget || 1)) * 100)}%`,
                  background: totalExpenses > log.dailyBudget ? 'var(--accent-red)' : 'linear-gradient(90deg, var(--accent-green), var(--accent-cyan))'
                }}
              ></div>
            </div>
          </div>

          {/* Add Expense Form */}
          <form onSubmit={handleAddExpense} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Item..."
              value={expenseForm.title}
              onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
              required 
            />
            <input 
              type="number" 
              className="input-field" 
              placeholder="Amount..."
              style={{ maxWidth: '100px' }}
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              required 
            />
            <select 
              className="input-field" 
              style={{ maxWidth: '110px' }}
              value={expenseForm.category}
              onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
            >
              <option value="food">Food</option>
              <option value="study">Study</option>
              <option value="entertainment">Fun</option>
              <option value="general">Other</option>
            </select>
            <button type="submit" className="submit-btn">
              <Plus size={18} />
            </button>
          </form>

          {/* Expense Log List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
            {log.expenses.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>No expenses logged today.</p>
            ) : (
              log.expenses.map((exp, idx) => (
                <div key={idx} className="expense-item">
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{exp.title}</span>
                    <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', background: 'rgba(255,255,255,0.05)', padding: '0.15rem 0.4rem', borderRadius: '3px', marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>
                      {exp.category}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="expense-amount">-{exp.amount}</span>
                    {log.isLocked ? (
                      <Lock size={13} style={{ color: 'var(--accent-gold)', opacity: 0.8 }} />
                    ) : (
                      <button onClick={() => handleDeleteExpense(idx)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer' }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* DAILY NOTES & SAVE CONFIRM */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Daily Notes & Reflection
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              Note down reflections, achievements, or what led to any restriction failure today.
            </p>
          </div>

          <textarea 
            className="input-field" 
            placeholder="Reflection on how you handled tasks and budget today..." 
            rows="5"
            value={log.note}
            onChange={(e) => handleUpdateNote(e.target.value)}
          />

          <button 
            onClick={() => saveLog(log)} 
            className="submit-btn" 
            style={{ width: '100%', marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem' }}
          >
            <Sparkles size={18} />
            <span>SAVE REFLECTION LOG</span>
          </button>

          {/* Critique & Review box */}
          {(critique.critiques.length > 0 || critique.achievements.length > 0) && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem', textAlign: 'left' }}>Diary Review & Critique</h4>
              <div className="critique-section">
                {critique.critiques.map((c, i) => (
                  <div key={`crit-${i}`} className="critique-box negative">
                    {c}
                  </div>
                ))}
                {critique.achievements.map((a, i) => (
                  <div key={`ach-${i}`} className="critique-box positive">
                    {a}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Commitment Lock Dialog Modal */}
      {showLockModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(7, 9, 15, 0.85)', backdropFilter: 'blur(10px)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-card" style={{ maxWidth: '450px', width: '100%', border: '2px solid var(--accent-gold)', boxShadow: '0 0 30px rgba(245, 158, 11, 0.35)', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-gold)' }}>
                <Lock size={32} style={{ margin: 'auto' }} />
              </div>
            </div>
            <div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-gold)', marginBottom: '0.5rem' }}>SEAL THE COMMITMENT PACT?</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Once you seal this pact, you <strong>cannot delete</strong> tasks, <strong>cannot delete/modify</strong> expenses, and <strong>cannot increase</strong> your daily budget limit for today.
              </p>
              <p style={{ color: 'var(--accent-red)', fontWeight: 700, fontSize: '0.85rem', marginTop: '0.75rem' }}>
                DO OR DIE. Deletion triggers will be permanently disabled until midnight.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={confirmLockPact} 
                className="submit-btn" 
                style={{ flex: 1, background: 'linear-gradient(135deg, var(--accent-gold) 0%, var(--accent-orange) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <Lock size={16} />
                <span>SEAL THE PACT</span>
              </button>
              <button 
                onClick={() => setShowLockModal(false)} 
                className="nav-btn" 
                style={{ flex: 1, border: '1px solid var(--border-color)' }}
              >
                BACK OUT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
