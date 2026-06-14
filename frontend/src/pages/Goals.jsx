import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Target, CheckCircle, ChevronDown, Check, X } from 'lucide-react';

export default function Goals({ API_BASE, token, authFetch }) {

  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();
  
  // Calculate current week number
  const getTodayWeekNumber = () => {
    const d = new Date();
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target) / 604800000);
  };
  
  const currentWeekNumber = getTodayWeekNumber();

  const parseTaskText = (text) => {
    if (!text) return { timeSlot: null, description: '' };
    const match = text.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      return { timeSlot: match[1].trim(), description: match[2].trim() };
    }
    return { timeSlot: null, description: text };
  };

  const handleAddRoutineSubTask = async (catIndex, timeSlot, taskText) => {
    if (!selectedWeek || !taskText) return;
    const formattedText = timeSlot ? `${timeSlot}: ${taskText}` : taskText;
    const updated = selectedWeek.categories.map((cat, idx) => {
      if (idx === catIndex) {
        return { ...cat, subTasks: [...cat.subTasks, formattedText] };
      }
      return cat;
    });
    updateWeek(updated);
    
    // Clear inputs
    const timeEl = document.getElementById(`time-${catIndex}`);
    const descEl = document.getElementById(`desc-${catIndex}`);
    if (timeEl) timeEl.value = '';
    if (descEl) descEl.value = '';
  };

  const [yearsList, setYearsList] = useState([]);
  const [monthsList, setMonthsList] = useState([]);
  const [weeksList, setWeeksList] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [weeklyGrid, setWeeklyGrid] = useState(null);

  useEffect(() => {
    if (selectedWeek) {
      fetchWeeklyGrid(selectedWeek);
    } else {
      setWeeklyGrid(null);
    }
  }, [selectedWeek]);

  const fetchWeeklyGrid = async (weekObj) => {
    try {
      const res = await authFetch(`${API_BASE}/goals/weekly-grid/${weekObj.year}/${weekObj.weekNumber}`);
      const data = await res.json();
      setWeeklyGrid(data);
    } catch (err) {
      console.error('Failed to fetch weekly grid', err);
    }
  };

  // Form inputs
  const [yearGoalTitle, setYearGoalTitle] = useState('');
  const [monthGoalTitle, setMonthGoalTitle] = useState('');
  const [weekGoalTitle, setWeekGoalTitle] = useState('');
  
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubTaskName, setNewSubTaskName] = useState({});

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      // 1. Fetch Year Goals for current year
      const yRes = await authFetch(`${API_BASE}/goals/years?year=${currentYear}`);
      const yData = await yRes.json();
      setYearsList(yData);

      // 2. Fetch Month Goals for current month
      const mRes = await authFetch(`${API_BASE}/goals/months?year=${currentYear}&month=${currentMonthIdx}`);
      const mData = await mRes.json();
      setMonthsList(mData);

      // 3. Fetch Week Goals for current week
      const wRes = await authFetch(`${API_BASE}/goals/weeks?year=${currentYear}&weekNumber=${currentWeekNumber}`);
      const wData = await wRes.json();
      setWeeksList(wData);
      
      if (wData.length > 0) {
        setSelectedWeek(wData[0]);
      } else {
        setSelectedWeek(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Year Add / Delete / Toggle
  const handleAddYearGoal = async (e) => {
    e.preventDefault();
    if (!yearGoalTitle.trim()) return;
    try {
      const res = await authFetch(`${API_BASE}/goals/years`, {
        method: 'POST',
        body: JSON.stringify({ year: currentYear, title: yearGoalTitle.trim(), description: 'Active Year Goal' })
      });
      if (res.ok) {
        setYearGoalTitle('');
        fetchGoals();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleYearGoal = async (goal) => {
    const nextStatus = goal.status === 'completed' ? 'pending' : 'completed';
    try {
      await authFetch(`${API_BASE}/goals/years/${goal._id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...goal, status: nextStatus })
      });
      fetchGoals();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteYearGoal = async (id) => {
    if (!confirm('Are you sure you want to delete this year goal?')) return;
    try {
      await authFetch(`${API_BASE}/goals/years/${id}`, { method: 'DELETE' });
      fetchGoals();
    } catch (err) {
      console.error(err);
    }
  };

  // Month Add / Delete / Toggle
  const handleAddMonthGoal = async (e) => {
    e.preventDefault();
    if (!monthGoalTitle.trim()) return;
    try {
      const res = await authFetch(`${API_BASE}/goals/months`, {
        method: 'POST',
        body: JSON.stringify({ year: currentYear, month: currentMonthIdx, title: monthGoalTitle.trim() })
      });
      if (res.ok) {
        setMonthGoalTitle('');
        fetchGoals();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleMonthGoal = async (goal) => {
    const nextStatus = goal.status === 'completed' ? 'pending' : 'completed';
    try {
      await authFetch(`${API_BASE}/goals/months/${goal._id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...goal, status: nextStatus })
      });
      fetchGoals();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMonthGoal = async (id) => {
    if (!confirm('Are you sure you want to delete this month goal?')) return;
    try {
      await authFetch(`${API_BASE}/goals/months/${id}`, { method: 'DELETE' });
      fetchGoals();
    } catch (err) {
      console.error(err);
    }
  };

  // Week Add / Delete
  const handleAddWeekGoal = async (e) => {
    e.preventDefault();
    if (!weekGoalTitle.trim()) return;
    try {
      const res = await authFetch(`${API_BASE}/goals/weeks`, {
        method: 'POST',
        body: JSON.stringify({
          year: currentYear,
          weekNumber: currentWeekNumber,
          title: weekGoalTitle.trim(),
          categories: [
            { name: 'physical task', subTasks: [] },
            { name: 'study task', subTasks: [] },
            { name: 'daily routine', subTasks: [] },
            { name: 'restriction', subTasks: [] }
          ]
        })
      });
      if (res.ok) {
        setWeekGoalTitle('');
        fetchGoals();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteWeekGoal = async (id) => {
    if (!confirm('Are you sure you want to delete this week routine?')) return;
    try {
      await authFetch(`${API_BASE}/goals/weeks/${id}`, { method: 'DELETE' });
      fetchGoals();
    } catch (err) {
      console.error(err);
    }
  };

  // Categories & Subtasks config for selected week
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!selectedWeek || !newCategoryName.trim()) return;
    const updated = [...selectedWeek.categories, { name: newCategoryName.trim().toLowerCase(), subTasks: [] }];
    updateWeek(updated);
    setNewCategoryName('');
  };

  const handleDeleteCategory = async (catIndex) => {
    if (!selectedWeek) return;
    const updated = selectedWeek.categories.filter((_, idx) => idx !== catIndex);
    updateWeek(updated);
  };

  const handleAddSubTask = async (catIndex) => {
    const txt = newSubTaskName[catIndex];
    if (!selectedWeek || !txt || !txt.trim()) return;
    const updated = selectedWeek.categories.map((cat, idx) => {
      if (idx === catIndex) {
        return { ...cat, subTasks: [...cat.subTasks, txt.trim()] };
      }
      return cat;
    });
    updateWeek(updated);
    setNewSubTaskName({ ...newSubTaskName, [catIndex]: '' });
  };

  const handleDeleteSubTask = async (catIndex, taskIndex) => {
    if (!selectedWeek) return;
    const updated = selectedWeek.categories.map((cat, idx) => {
      if (idx === catIndex) {
        return { ...cat, subTasks: cat.subTasks.filter((_, tIdx) => tIdx !== taskIndex) };
      }
      return cat;
    });
    updateWeek(updated);
  };

  const updateWeek = async (updatedCategories) => {
    try {
      const res = await authFetch(`${API_BASE}/goals/weeks/${selectedWeek._id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...selectedWeek, categories: updatedCategories })
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedWeek(data);
        setWeeksList(weeksList.map(w => w._id === data._id ? data : w));
        fetchWeeklyGrid(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem' }}>Active Timeline Goals</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Add your active targets directly for the current year, month, and week.</p>
      </div>

      <div className="grid-3">
        {/* YEAR TARGETS */}
        <div className="glass-card glow-purple" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <Target size={20} color="var(--accent-purple)" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Year Targets ({currentYear})</h3>
          </div>

          <form onSubmit={handleAddYearGoal} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Add year goal..."
              value={yearGoalTitle}
              onChange={(e) => setYearGoalTitle(e.target.value)}
              required 
            />
            <button type="submit" className="submit-btn" style={{ padding: '0 1rem' }}>
              <Plus size={16} />
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
            {yearsList.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>No targets added.</p>
            ) : (
              yearsList.map(y => (
                <div key={y._id} className={`task-row ${y.status === 'completed' ? 'completed' : ''}`}>
                  <span style={{ fontWeight: 600, flex: 1, textDecoration: y.status === 'completed' ? 'line-through' : 'none' }}>
                    {y.title}
                  </span>
                  <div className="task-btn-group">
                    <button onClick={() => handleToggleYearGoal(y)} className={`icon-btn ${y.status === 'completed' ? 'active-success' : ''}`}>
                      <CheckCircle size={14} />
                    </button>
                    <button onClick={() => handleDeleteYearGoal(y._id)} className="icon-btn btn-danger">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* MONTH MILESTONES */}
        <div className="glass-card glow-purple" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <Calendar size={20} color="var(--accent-blue)" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Month Milestones ({monthNames[currentMonthIdx]})</h3>
          </div>

          <form onSubmit={handleAddMonthGoal} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Add month goal..."
              value={monthGoalTitle}
              onChange={(e) => setMonthGoalTitle(e.target.value)}
              required 
            />
            <button type="submit" className="submit-btn" style={{ padding: '0 1rem', background: 'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-cyan) 100%)' }}>
              <Plus size={16} />
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
            {monthsList.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>No milestones added.</p>
            ) : (
              monthsList.map(m => (
                <div key={m._id} className={`task-row ${m.status === 'completed' ? 'completed' : ''}`}>
                  <span style={{ fontWeight: 600, flex: 1, textDecoration: m.status === 'completed' ? 'line-through' : 'none' }}>
                    {m.title}
                  </span>
                  <div className="task-btn-group">
                    <button onClick={() => handleToggleMonthGoal(m)} className={`icon-btn ${m.status === 'completed' ? 'active-success' : ''}`}>
                      <CheckCircle size={14} />
                    </button>
                    <button onClick={() => handleDeleteMonthGoal(m._id)} className="icon-btn btn-danger">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* WEEKLY ROUTINES */}
        <div className="glass-card glow-purple" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <Calendar size={20} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Weekly Routines (Wk {currentWeekNumber})</h3>
          </div>

          <form onSubmit={handleAddWeekGoal} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Add weekly routine..."
              value={weekGoalTitle}
              onChange={(e) => setWeekGoalTitle(e.target.value)}
              required 
            />
            <button type="submit" className="submit-btn" style={{ padding: '0 1rem', background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-green) 100%)' }}>
              <Plus size={16} />
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
            {weeksList.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>No routines created.</p>
            ) : (
              weeksList.map(w => (
                <div 
                  key={w._id} 
                  className={`task-row ${selectedWeek?._id === w._id ? 'completed' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedWeek(w)}
                >
                  <span style={{ fontWeight: 600, flex: 1 }}>{w.title}</span>
                  <div className="task-btn-group" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleDeleteWeekGoal(w._id)} className="icon-btn btn-danger">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* WEEKLY CATEGORIES CONFIGURATOR */}
      {selectedWeek && (
        <div className="glass-card animate-pulse" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
          <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
              Configure: {selectedWeek.title}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Tasks added here automatically map into your daily checklist as mandatory goals.
            </p>
          </div>

          <div className="grid-2">
            {selectedWeek.categories.map((cat, catIdx) => {
              const isRoutineCategory = cat.name.toLowerCase().includes('routine') || cat.name.toLowerCase().includes('routing');
              return (
                <div 
                  key={cat.name} 
                  className="glass-card" 
                  style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span className={`task-tag ${
                      cat.name.includes('physical') ? 'physical' :
                      cat.name.includes('study') ? 'study' :
                      cat.name.includes('routine') ? 'routine' :
                      cat.name.includes('restrict') ? 'restriction' : 'extra'
                    }`} style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}>
                      {cat.name}
                    </span>
                    
                    {!['physical task', 'study task', 'daily routine', 'restriction'].includes(cat.name) && (
                      <button onClick={() => handleDeleteCategory(catIdx)} className="icon-btn btn-danger">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {isRoutineCategory ? (
                    <div className="subtask-add-row" style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
                      <input 
                        type="text" 
                        className="input-field" 
                        style={{ flex: 1, minWidth: '60px' }}
                        placeholder="8-10 am"
                        id={`time-${catIdx}`}
                      />
                      <input 
                        type="text" 
                        className="input-field" 
                        style={{ flex: 2, minWidth: '120px' }}
                        placeholder="Task description..."
                        id={`desc-${catIdx}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const timeVal = document.getElementById(`time-${catIdx}`).value.trim();
                            const descVal = document.getElementById(`desc-${catIdx}`).value.trim();
                            if (descVal) {
                              handleAddRoutineSubTask(catIdx, timeVal, descVal);
                            }
                          }
                        }}
                      />
                      <button 
                        onClick={() => {
                          const timeVal = document.getElementById(`time-${catIdx}`).value.trim();
                          const descVal = document.getElementById(`desc-${catIdx}`).value.trim();
                          if (descVal) {
                            handleAddRoutineSubTask(catIdx, timeVal, descVal);
                          }
                        }} 
                        className="submit-btn" 
                        style={{ padding: '0 0.8rem' }}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="subtask-add-row" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="Add mandatory weekly sub-task..."
                        value={newSubTaskName[catIdx] || ''}
                        onChange={(e) => setNewSubTaskName({ ...newSubTaskName, [catIdx]: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddSubTask(catIdx)}
                      />
                      <button onClick={() => handleAddSubTask(catIdx)} className="submit-btn" style={{ padding: '0 1rem' }}>
                        <Plus size={16} />
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {cat.subTasks.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', padding: '0.5rem' }}>
                        No tasks. Add some to populate your daily log.
                      </p>
                    ) : (
                      cat.subTasks.map((sub, subIdx) => {
                        const { timeSlot, description } = parseTaskText(sub);
                        return (
                          <div 
                            key={subIdx} 
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.5rem 0.75rem', borderRadius: '0.35rem' }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start' }}>
                              {isRoutineCategory && timeSlot && (
                                <span style={{ 
                                  fontSize: '0.7rem', 
                                  fontWeight: 700, 
                                  color: 'var(--accent-cyan)', 
                                  background: 'rgba(6, 182, 212, 0.1)', 
                                  padding: '0.1rem 0.35rem', 
                                  borderRadius: '3px',
                                  border: '1px solid rgba(6, 182, 212, 0.2)',
                                  width: 'fit-content',
                                  fontFamily: 'monospace'
                                }}>
                                  ⏰ {timeSlot}
                                </span>
                              )}
                              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{description}</span>
                            </div>
                            <button onClick={() => handleDeleteSubTask(catIdx, subIdx)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer' }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', gap: '0.5rem', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
            <input 
              type="text" 
              className="input-field" 
              style={{ maxWidth: '250px' }}
              placeholder="Create custom category..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
            />
            <button onClick={handleAddCategory} className="submit-btn" style={{ background: 'var(--bg-grid)', border: '1px solid var(--border-color)' }}>
              Add Category
            </button>
          </div>
        </div>
      )}

      {/* WEEKLY COMPLIANCE CHECKLIST GRID */}
      {selectedWeek && weeklyGrid && (
        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-green)', marginTop: '2rem' }}>
          <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={20} color="var(--accent-green)" />
              Weekly Habit Grid (Mon - Sun Compliance)
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Shows your daily execution checklist status (Mon to Sun) for each configured weekly routine.
            </p>
          </div>

          <div className="weekly-grid-container">
            <table className="weekly-grid-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Routine Task</th>
                  <th className="weekly-grid-day-cell">Mon</th>
                  <th className="weekly-grid-day-cell">Tue</th>
                  <th className="weekly-grid-day-cell">Wed</th>
                  <th className="weekly-grid-day-cell">Thu</th>
                  <th className="weekly-grid-day-cell">Fri</th>
                  <th className="weekly-grid-day-cell">Sat</th>
                  <th className="weekly-grid-day-cell">Sun</th>
                </tr>
              </thead>
              <tbody>
                {weeklyGrid.grid && weeklyGrid.grid.length > 0 ? (
                  weeklyGrid.grid.map(wg => (
                    wg.categories.map(cat => (
                      cat.tasks.map((task, tIdx) => (
                        <tr key={`${cat.name}-${tIdx}`}>
                          <td style={{ textAlign: 'left', fontWeight: 600 }}>
                            <span className={`task-tag ${
                              cat.name.includes('physical') ? 'physical' :
                              cat.name.includes('study') ? 'study' :
                              cat.name.includes('routine') ? 'routine' :
                              cat.name.includes('restrict') ? 'restriction' : 'extra'
                            }`} style={{ fontSize: '0.65rem', marginRight: '0.5rem', padding: '0.1rem 0.35rem' }}>
                              {cat.name.split(' ')[0]}
                            </span>
                            {(() => {
                              const match = task.text.match(/^([^:]+):\s*(.+)$/);
                              const isRoutine = cat.name.toLowerCase().includes('routine') || cat.name.toLowerCase().includes('routing');
                              if (isRoutine && match) {
                                return (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.1)', padding: '0.05rem 0.25rem', borderRadius: '2px', fontFamily: 'monospace' }}>
                                      {match[1]}
                                    </span>
                                    <span>{match[2]}</span>
                                  </span>
                                );
                              }
                              return task.text;
                            })()}
                          </td>
                          {task.days.map((status, dayIdx) => (
                            <td key={dayIdx}>
                              {status === 'completed' ? (
                                <span className="weekly-grid-day-status completed">✔</span>
                              ) : status === 'failed' ? (
                                <span className="weekly-grid-day-status failed">✘</span>
                              ) : (
                                <span className="weekly-grid-day-status pending">-</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))
                    ))
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '2rem' }}>
                      No configured routines to show compliance grid.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
