import express from 'express';
import jwt from 'jsonwebtoken';
import { User, YearGoal, MonthGoal, WeekGoal, DailyLog } from './models.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

const router = express.Router();

// Helper to get week number and year
function getWeekNumber(dateStr) {
  const parts = dateStr.split('-');
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNum = 1 + Math.ceil((firstThursday - target) / 604800000);
  return { year: target.getFullYear(), week: weekNum };
}

// Helper to calculate points for a log
function calculateLogPoints(log) {
  const tasks = log.tasks || [];
  const total = tasks.length;
  if (total === 0) return 0.0;

  const completed = tasks.filter(t => t.status === 'completed').length;
  const ratio = completed / total;

  if (ratio === 1.0) {
    return 2.0;
  } else if (ratio >= 0.70) {
    return 1.0;
  } else if (ratio >= 0.50) {
    return 0.0;
  } else if (ratio >= 0.20) {
    return -1.0;
  } else {
    return -2.0;
  }
}

// Helper to get all 7 dates YYYY-MM-DD of a week
function getDatesOfWeek(year, weekNumber) {
  // Jan 4th is always in week 1 of the year
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay();
  // Monday of week 1
  const monWeek1 = new Date(jan4);
  monWeek1.setDate(jan4.getDate() - ((jan4Day + 6) % 7));

  // Monday of target week
  const monTarget = new Date(monWeek1);
  monTarget.setDate(monWeek1.getDate() + (weekNumber - 1) * 7);

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monTarget);
    d.setDate(monTarget.getDate() + i);
    
    const dYear = d.getFullYear();
    const dMonth = String(d.getMonth() + 1).padStart(2, '0');
    const dDay = String(d.getDate()).padStart(2, '0');
    dates.push(`${dYear}-${dMonth}-${dDay}`);
  }
  return dates;
}

// Helper to generate critiques and accomplishments for a log
function generateCritique(log) {
  const critiques = [];
  const achievements = [];
  
  if (!log) return { critiques, achievements };

  const tasks = log.tasks || [];
  const expenses = log.expenses || [];
  const budget = log.dailyBudget || 500;

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const failedTasks = tasks.filter(t => t.status === 'failed' || t.status === 'rejected').length;
  const pendingTasks = tasks.filter(t => t.status === 'pending').length;

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

  // 1. Task compliance critiques
  if (totalTasks > 0) {
    if (completedTasks === totalTasks) {
      achievements.push("Legendary Routine compliance! Every single task was completed. 🌟");
    } else if (completedTasks === 0) {
      critiques.push("Absolute slacker warning! Zero tasks completed today. Stop procrastinating. ⚠️");
    } else if (pendingTasks > 0) {
      critiques.push(`Unfinished business: You left ${pendingTasks} task(s) in pending status. 💤`);
    }
  }

  // 2. Restriction critiques
  const restrictionTasks = tasks.filter(t => t.category.toLowerCase().includes('restrict'));
  const failedRestrictions = restrictionTasks.filter(t => t.status === 'failed').length;
  if (restrictionTasks.length > 0) {
    if (failedRestrictions > 0) {
      critiques.push(`Restriction Breach: You broke ${failedRestrictions} restriction task(s)! Guard your self-discipline. 🍕`);
    } else if (restrictionTasks.every(t => t.status === 'completed')) {
      achievements.push("Impenetrable shield! Kept all restriction commitments today. 🛡️");
    }
  }

  // 3. Expense critiques
  if (totalSpent > budget) {
    critiques.push(`Wallet leak detected! Spent ${totalSpent} INR which exceeds budget limit by ${totalSpent - budget} INR. 💸`);
  } else if (totalSpent === 0 && totalTasks > 0) {
    achievements.push("Zero-expense day! Exceptional financial control. 💰");
  } else {
    achievements.push("Budget safe. Good stewardship of your funds.");
  }

  return { critiques, achievements };
}

// Helper to ensure all DailyLog documents exist between minDate and todayStr
async function ensureDailyLogsExist(userId, todayStr) {
  try {
    const earliestLog = await DailyLog.findOne({ userId }).sort({ date: 1 });
    if (!earliestLog) return;

    const minDateStr = earliestLog.date;
    if (minDateStr >= todayStr) return;

    // Parse dates safely
    const minParts = minDateStr.split('-');
    let currentDate = new Date(Number(minParts[0]), Number(minParts[1]) - 1, Number(minParts[2]));
    
    const todayParts = todayStr.split('-');
    const todayDate = new Date(Number(todayParts[0]), Number(todayParts[1]) - 1, Number(todayParts[2]));

    // Limit backfill window to prevent infinite growth issues
    const maxBackfillDays = 90;
    const cutoffDate = new Date(todayDate);
    cutoffDate.setDate(cutoffDate.getDate() - maxBackfillDays);
    if (currentDate < cutoffDate) {
      currentDate = cutoffDate;
    }

    // Fetch existing logs in range
    const existingLogs = await DailyLog.find({
      userId,
      date: { $gte: minDateStr, $lte: todayStr }
    });
    const existingDatesSet = new Set(existingLogs.map(l => l.date));

    // Loop through dates and create missing ones
    while (currentDate < todayDate) {
      const cYear = currentDate.getFullYear();
      const cMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
      const cDay = String(currentDate.getDate()).padStart(2, '0');
      const checkStr = `${cYear}-${cMonth}-${cDay}`;

      if (!existingDatesSet.has(checkStr)) {
        const { year, week } = getWeekNumber(checkStr);
        const weekGoal = await WeekGoal.findOne({ userId, year, weekNumber: week });
        
        let defaultTasks = [];
        let weekGoalId = null;

        if (weekGoal) {
          weekGoalId = weekGoal._id;
          weekGoal.categories.forEach(cat => {
            cat.subTasks.forEach(taskText => {
              defaultTasks.push({
                text: taskText,
                category: cat.name,
                isMandatory: true,
                status: 'failed' // automatic fail for past unlogged day
              });
            });
          });
        }

        const newLog = new DailyLog({
          userId,
          date: checkStr,
          weekGoalId,
          tasks: defaultTasks,
          expenses: [],
          dailyBudget: 500,
          points: 0,
          isLocked: false,
          note: ''
        });

        newLog.points = calculateLogPoints(newLog);
        await newLog.save();
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }
  } catch (err) {
    console.error('Error auto-backfilling logs:', err);
  }
}

/* ==========================================================================
   AUTHENTICATION MIDDLEWARE & ENDPOINT
   ========================================================================== */

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];

  try {
    // Verify our own JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found, please login again' });
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired, please login again' });
    }
    return res.status(401).json({ error: 'Invalid token, please login again' });
  }
}

// Helper to sign a JWT for a user
function signUserToken(user) {
  return jwt.sign(
    { userId: user._id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

router.post('/auth/google', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  // Mock/demo login flow
  if (token.startsWith('mock-')) {
    const mockEmail = token.replace('mock-', '');
    try {
      let user = await User.findOne({ email: mockEmail });
      if (!user) {
        user = new User({
          googleId: `mock-${mockEmail}`,
          email: mockEmail,
          name: mockEmail.split('@')[0].toUpperCase(),
          picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'
        });
        await user.save();
      }
      const jwtToken = signUserToken(user);
      return res.json({ user, token: jwtToken });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Real Google login flow — validate Google token ONCE, then issue our own JWT
  try {
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    if (!googleRes.ok) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }
    const tokenInfo = await googleRes.json();

    if (process.env.GOOGLE_CLIENT_ID && tokenInfo.aud !== process.env.GOOGLE_CLIENT_ID) {
      return res.status(401).json({ error: 'Audience mismatch' });
    }

    let user = await User.findOne({ email: tokenInfo.email });
    if (!user) {
      user = new User({
        googleId: tokenInfo.sub,
        email: tokenInfo.email,
        name: tokenInfo.name || tokenInfo.email.split('@')[0],
        picture: tokenInfo.picture || ''
      });
      await user.save();
    }
    const jwtToken = signUserToken(user);
    res.json({ user, token: jwtToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   YEAR GOALS ENDPOINTS
   ========================================================================= */

router.get('/goals/years', authMiddleware, async (req, res) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.year) filter.year = Number(req.query.year);
    const goals = await YearGoal.find(filter).sort({ year: -1 });
    res.json(goals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/goals/years', authMiddleware, async (req, res) => {
  try {
    const { year, title, description } = req.body;
    const goal = new YearGoal({ userId: req.user._id, year, title, description });
    await goal.save();
    res.status(201).json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/goals/years/:id', authMiddleware, async (req, res) => {
  try {
    const { title, description, status } = req.body;
    const goal = await YearGoal.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { title, description, status },
      { new: true }
    );
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    res.json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/goals/years/:id', authMiddleware, async (req, res) => {
  try {
    const yearGoal = await YearGoal.findOne({ _id: req.params.id, userId: req.user._id });
    if (!yearGoal) return res.status(404).json({ error: 'Goal not found' });
    
    // Delete cascading
    const months = await MonthGoal.find({ userId: req.user._id, yearGoalId: yearGoal._id });
    for (let m of months) {
      await WeekGoal.deleteMany({ userId: req.user._id, monthGoalId: m._id });
    }
    await MonthGoal.deleteMany({ userId: req.user._id, yearGoalId: yearGoal._id });
    await YearGoal.findOneAndDelete({ _id: req.params.id, userId: req.user._id });

    res.json({ message: 'Year goal deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   MONTH GOALS ENDPOINTS
   ========================================================================== */

router.get('/goals/months', authMiddleware, async (req, res) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.yearGoalId) filter.yearGoalId = req.query.yearGoalId;
    if (req.query.year) filter.year = Number(req.query.year);
    if (req.query.month) filter.month = Number(req.query.month);
    
    const goals = await MonthGoal.find(filter).sort({ month: 1 });
    res.json(goals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/goals/months', authMiddleware, async (req, res) => {
  try {
    const { yearGoalId, month, year, title } = req.body;
    const goal = new MonthGoal({ userId: req.user._id, yearGoalId, month, year, title });
    await goal.save();
    res.status(201).json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/goals/months/:id', authMiddleware, async (req, res) => {
  try {
    const { title, status } = req.body;
    const goal = await MonthGoal.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { title, status },
      { new: true }
    );
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    res.json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/goals/months/:id', authMiddleware, async (req, res) => {
  try {
    const monthGoal = await MonthGoal.findOne({ _id: req.params.id, userId: req.user._id });
    if (!monthGoal) return res.status(404).json({ error: 'Goal not found' });

    await WeekGoal.deleteMany({ userId: req.user._id, monthGoalId: req.params.id });
    await MonthGoal.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ message: 'Month goal and weeks deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   WEEK GOALS ENDPOINTS
   ========================================================================== */

router.get('/goals/weeks', authMiddleware, async (req, res) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.monthGoalId) filter.monthGoalId = req.query.monthGoalId;
    if (req.query.year) filter.year = Number(req.query.year);
    if (req.query.weekNumber) filter.weekNumber = Number(req.query.weekNumber);

    const goals = await WeekGoal.find(filter).sort({ weekNumber: 1 });
    res.json(goals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/goals/weeks', authMiddleware, async (req, res) => {
  try {
    const { monthGoalId, weekNumber, year, title, categories } = req.body;
    const goal = new WeekGoal({ userId: req.user._id, monthGoalId, weekNumber, year, title, categories });
    await goal.save();
    res.status(201).json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/goals/weeks/:id', authMiddleware, async (req, res) => {
  try {
    const { title, categories } = req.body;
    const goal = await WeekGoal.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { title, categories },
      { new: true }
    );
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    res.json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/goals/weeks/:id', authMiddleware, async (req, res) => {
  try {
    const goal = await WeekGoal.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    res.json({ message: 'Week goal deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   DAILY LOGS ENDPOINTS
   ========================================================================== */

router.get('/goals/weekly-grid/:year/:weekNumber', authMiddleware, async (req, res) => {
  try {
    const { year, weekNumber } = req.params;
    const dates = getDatesOfWeek(Number(year), Number(weekNumber));

    // Fetch all logs for this user for these 7 dates
    const logs = await DailyLog.find({ userId: req.user._id, date: { $in: dates } });
    
    // Fetch week goals for this user for this week
    const weekGoals = await WeekGoal.find({ userId: req.user._id, year: Number(year), weekNumber: Number(weekNumber) });

    // Build grid structure
    const grid = weekGoals.map(wg => {
      const categories = wg.categories.map(cat => {
        const tasks = cat.subTasks.map(taskText => {
          const days = dates.map(dt => {
            const dayLog = logs.find(l => l.date === dt);
            if (!dayLog) return 'pending';
            const matchingTask = dayLog.tasks.find(t => t.text === taskText && t.isMandatory);
            if (!matchingTask) return 'pending';
            return matchingTask.status;
          });
          return { text: taskText, days };
        });
        return { name: cat.name, tasks };
      });
      return {
        weekGoalId: wg._id,
        title: wg.title,
        categories
      };
    });

    res.json({ dates, grid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/logs/pending-bucket', authMiddleware, async (req, res) => {
  try {
    const todayStr = req.query.today || new Date().toISOString().split('T')[0];
    await ensureDailyLogsExist(req.user._id, todayStr);
    const logs = await DailyLog.find({ userId: req.user._id, date: { $lt: todayStr } }).sort({ date: 1 });
    
    const pendingTasks = [];
    for (let log of logs) {
      let modified = false;
      log.tasks.forEach(task => {
        if (task.status === 'pending') {
          task.status = 'failed';
          modified = true;
        }
        if (task.status === 'failed') {
          pendingTasks.push({
            date: log.date,
            text: task.text,
            category: task.category,
            isMandatory: task.isMandatory
          });
        }
      });
      if (modified) {
        log.points = calculateLogPoints(log);
        await log.save();
      }
    }
    
    res.json(pendingTasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logs/resolve-pending', authMiddleware, async (req, res) => {
  try {
    const { date, text } = req.body;
    if (!date || !text) {
      return res.status(400).json({ error: 'Missing date or task text parameters' });
    }

    const log = await DailyLog.findOne({ userId: req.user._id, date });
    if (!log) {
      return res.status(404).json({ error: 'Daily log not found' });
    }

    const taskIndex = log.tasks.findIndex(t => t.text === text);
    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Task not found in daily log' });
    }

    log.tasks[taskIndex].status = 'completed';
    log.points = calculateLogPoints(log);

    await log.save();
    res.json({ success: true, log, critique: generateCritique(log) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logs/reject-pending', authMiddleware, async (req, res) => {
  try {
    const { date, text } = req.body;
    if (!date || !text) {
      return res.status(400).json({ error: 'Missing date or task text parameters' });
    }

    const log = await DailyLog.findOne({ userId: req.user._id, date });
    if (!log) {
      return res.status(404).json({ error: 'Daily log not found' });
    }

    const taskIndex = log.tasks.findIndex(t => t.text === text);
    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Task not found in daily log' });
    }

    log.tasks[taskIndex].status = 'rejected';
    log.points = calculateLogPoints(log);

    await log.save();
    res.json({ success: true, log, critique: generateCritique(log) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/logs/:date', authMiddleware, async (req, res) => {
  try {
    const { date } = req.params;
    const todayStr = req.query.today || new Date().toISOString().split('T')[0];
    let log = await DailyLog.findOne({ userId: req.user._id, date });
    
    const { year, week } = getWeekNumber(date);
    const weekGoal = await WeekGoal.findOne({ userId: req.user._id, year, weekNumber: week });

    if (log) {
      let logModified = false;
      
      // Auto fail pending tasks for past days
      if (date < todayStr) {
        log.tasks.forEach(t => {
          if (t.status === 'pending') {
            t.status = 'failed';
            logModified = true;
          }
        });
      }

      if (weekGoal) {
        if (!log.weekGoalId) {
          log.weekGoalId = weekGoal._id;
          logModified = true;
        }
        weekGoal.categories.forEach(cat => {
          cat.subTasks.forEach(taskText => {
            const exists = log.tasks.some(t => t.text === taskText && t.isMandatory);
            if (!exists) {
              log.tasks.push({
                text: taskText,
                category: cat.name,
                isMandatory: true,
                status: date < todayStr ? 'failed' : 'pending'
              });
              logModified = true;
            }
          });
        });
      }
      
      if (logModified) {
        log.points = calculateLogPoints(log);
        await log.save();
      }
      return res.json({ log, critique: generateCritique(log), isNew: false });
    }

    let defaultTasks = [];
    let weekGoalId = null;

    if (weekGoal) {
      weekGoalId = weekGoal._id;
      weekGoal.categories.forEach(cat => {
        cat.subTasks.forEach(taskText => {
          defaultTasks.push({
            text: taskText,
            category: cat.name,
            isMandatory: true,
            status: date < todayStr ? 'failed' : 'pending'
          });
        });
      });
    }

    const tempLog = {
      userId: req.user._id,
      date,
      weekGoalId,
      tasks: defaultTasks,
      expenses: [],
      dailyBudget: 500,
      points: 0,
      isLocked: false,
      note: ''
    };

    res.json({ log: tempLog, critique: generateCritique(tempLog), isNew: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logs/:date', authMiddleware, async (req, res) => {
  try {
    const { date } = req.params;
    const { tasks, expenses, dailyBudget, note, weekGoalId, isLocked } = req.body;

    if (dailyBudget <= 0) {
      return res.status(400).json({ error: 'Daily budget limit must be a positive number!' });
    }

    if (expenses && Array.isArray(expenses)) {
      for (const exp of expenses) {
        if (exp.amount <= 0) {
          return res.status(400).json({ error: `Expense "${exp.title}" amount must be a positive number!` });
        }
      }
    }

    let log = await DailyLog.findOne({ userId: req.user._id, date });

    if (log && log.isLocked) {
      if (dailyBudget > log.dailyBudget) {
        return res.status(400).json({ error: 'Commitment Error: Cannot increase daily budget limit once Locked!' });
      }

      for (const t of log.tasks) {
        const found = tasks.find(rt => rt.text === t.text && rt.category === t.category);
        if (!found) {
          return res.status(400).json({ error: `Commitment Error: Cannot delete or modify task "${t.text}" once Locked!` });
        }
      }

      for (const e of log.expenses) {
        const found = expenses.find(rt => rt.title === e.title && rt.category === e.category && rt.amount >= e.amount);
        if (!found) {
          return res.status(400).json({ error: `Commitment Error: Cannot delete or decrease expense "${e.title}" once Locked!` });
        }
      }
    }

    if (!log) {
      log = new DailyLog({ userId: req.user._id, date, weekGoalId });
    }

    log.tasks = tasks;
    log.expenses = expenses;
    log.dailyBudget = dailyBudget;
    log.note = note;
    log.isLocked = isLocked || false;
    if (weekGoalId) log.weekGoalId = weekGoalId;

    log.points = calculateLogPoints(log);

    await log.save();
    res.json({ log, critique: generateCritique(log) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   ANALYTICS & STREAKS ENDPOINTS
   ========================================================================== */

router.get('/analytics/streak', authMiddleware, async (req, res) => {
  try {
    const todayStr = req.query.today || new Date().toISOString().split('T')[0];
    await ensureDailyLogsExist(req.user._id, todayStr);
    const logs = await DailyLog.find({ userId: req.user._id }).sort({ date: 1 });
    if (logs.length === 0) {
      return res.json({ currentStreak: 0, longestStreak: 0 });
    }

    // Gather all dates with points >= 0 (score >= 0 represents keeping habit streak)
    const activeDates = new Set(
      logs.filter(log => log.points >= 0).map(log => log.date)
    );

    if (activeDates.size === 0) {
      return res.json({ currentStreak: 0, longestStreak: 0 });
    }

    // Convert Set of dates into chronological list
    const sortedDates = Array.from(activeDates).sort();

    let longest = 0;
    let current = 0;
    let tempStreak = 0;
    let lastDate = null;

    for (let i = 0; i < sortedDates.length; i++) {
      const currentDateStr = sortedDates[i];
      const curParts = currentDateStr.split('-');
      const cur = new Date(Number(curParts[0]), Number(curParts[1]) - 1, Number(curParts[2]));
      
      if (lastDate === null) {
        tempStreak = 1;
      } else {
        const diffTime = Math.abs(cur - lastDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          tempStreak++;
        } else if (diffDays > 1) {
          if (tempStreak > longest) {
            longest = tempStreak;
          }
          tempStreak = 1;
        }
      }
      lastDate = cur;
    }

    if (tempStreak > longest) {
      longest = tempStreak;
    }

    // Determine current streak.
    // Check if the latest streak day was either today or yesterday.
    const parts = todayStr.split('-');
    const today = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const yYear = yesterday.getFullYear();
    const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
    const yDay = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayStr = `${yYear}-${yMonth}-${yDay}`;

    const hasToday = activeDates.has(todayStr);
    const hasYesterday = activeDates.has(yesterdayStr);

    if (hasToday || hasYesterday) {
      // Find consecutive streak backwards from the latest log date that's active
      let checkDate = hasToday ? new Date(today) : new Date(yesterday);
      current = 0;
      while (true) {
        const cYear = checkDate.getFullYear();
        const cMonth = String(checkDate.getMonth() + 1).padStart(2, '0');
        const cDay = String(checkDate.getDate()).padStart(2, '0');
        const checkStr = `${cYear}-${cMonth}-${cDay}`;
        if (activeDates.has(checkStr)) {
          current++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    } else {
      current = 0;
    }

    res.json({ currentStreak: current, longestStreak: longest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/analytics/dashboard', authMiddleware, async (req, res) => {
  try {
    const todayStr = req.query.today || new Date().toISOString().split('T')[0];
    await ensureDailyLogsExist(req.user._id, todayStr);
    const allLogs = await DailyLog.find({ userId: req.user._id }).sort({ date: 1 });
    
    // 1. Day breakdown (latest log, if any)
    const latestLog = allLogs[allLogs.length - 1] || null;

    // 2. Week breakdown (exactly 7 consecutive calendar days ending with todayStr)
    const weekLogs = [];
    const todayParts = todayStr.split('-');
    const weekStartDate = new Date(Number(todayParts[0]), Number(todayParts[1]) - 1, Number(todayParts[2]));
    weekStartDate.setDate(weekStartDate.getDate() - 6); // start 6 days ago

    for (let i = 0; i < 7; i++) {
      const cDate = new Date(weekStartDate);
      cDate.setDate(weekStartDate.getDate() + i);
      const cYear = cDate.getFullYear();
      const cMonth = String(cDate.getMonth() + 1).padStart(2, '0');
      const cDay = String(cDate.getDate()).padStart(2, '0');
      const dateStr = `${cYear}-${cMonth}-${cDay}`;

      const foundLog = allLogs.find(l => l.date === dateStr);
      if (foundLog) {
        weekLogs.push({
          date: foundLog.date,
          points: foundLog.points,
          totalExpenses: foundLog.expenses.reduce((s, e) => s + e.amount, 0),
          dailyBudget: foundLog.dailyBudget || 500,
          tasksCompleted: foundLog.tasks.filter(t => t.status === 'completed').length,
          tasksTotal: foundLog.tasks.length
        });
      } else {
        weekLogs.push({
          date: dateStr,
          points: 0,
          totalExpenses: 0,
          dailyBudget: 500,
          tasksCompleted: 0,
          tasksTotal: 0
        });
      }
    }

    // 3. Month breakdown (consecutive calendar days starting from the user's earliest log to todayStr)
    const monthLogs = [];
    let startDateStr = todayStr;
    const earliestLog = allLogs[0]; // allLogs is sorted by date ascending
    if (earliestLog) {
      startDateStr = earliestLog.date;
    }

    if (startDateStr <= todayStr) {
      const startParts = startDateStr.split('-');
      const start = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]));
      
      const todayDate = new Date(Number(todayParts[0]), Number(todayParts[1]) - 1, Number(todayParts[2]));
      const diffTime = Math.abs(todayDate - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      for (let i = 0; i < diffDays; i++) {
        const cDate = new Date(start);
        cDate.setDate(start.getDate() + i);
        const cYear = cDate.getFullYear();
        const cMonth = String(cDate.getMonth() + 1).padStart(2, '0');
        const cDay = String(cDate.getDate()).padStart(2, '0');
        const dateStr = `${cYear}-${cMonth}-${cDay}`;

        const foundLog = allLogs.find(l => l.date === dateStr);
        if (foundLog) {
          monthLogs.push({
            date: foundLog.date,
            points: foundLog.points,
            totalExpenses: foundLog.expenses.reduce((s, e) => s + e.amount, 0),
            dailyBudget: foundLog.dailyBudget || 500,
            tasksCompleted: foundLog.tasks.filter(t => t.status === 'completed').length,
            tasksTotal: foundLog.tasks.length
          });
        } else {
          monthLogs.push({
            date: dateStr,
            points: 0,
            totalExpenses: 0,
            dailyBudget: 500,
            tasksCompleted: 0,
            tasksTotal: 0
          });
        }
      }
    }

    // 4. Year breakdown (Monthly averages)
    // Group all logs by Month (YYYY-MM)
    const monthlyGroups = {};
    allLogs.forEach(log => {
      const monthKey = log.date.substring(0, 7); // "YYYY-MM"
      if (!monthlyGroups[monthKey]) {
        monthlyGroups[monthKey] = { pointsSum: 0, count: 0, expensesSum: 0 };
      }
      monthlyGroups[monthKey].pointsSum += log.points;
      monthlyGroups[monthKey].expensesSum += log.expenses.reduce((s, e) => s + e.amount, 0);
      monthlyGroups[monthKey].count += 1;
    });

    const yearStats = Object.keys(monthlyGroups).sort().map(monthKey => {
      const group = monthlyGroups[monthKey];
      return {
        month: monthKey,
        avgPoints: parseFloat((group.pointsSum / group.count).toFixed(2)),
        totalExpenses: group.expensesSum,
        daysCount: group.count
      };
    });

    res.json({
      latestLog,
      week: weekLogs,
      month: monthLogs,
      year: yearStats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   ADMIN / MIGRATION ENDPOINTS
   ========================================================================== */

router.post('/admin/recalculate-points', authMiddleware, async (req, res) => {
  try {
    const logs = await DailyLog.find({ userId: req.user._id });
    let updated = 0;
    for (const log of logs) {
      const newPoints = calculateLogPoints(log);
      if (log.points !== newPoints) {
        log.points = newPoints;
        await log.save();
        updated++;
      }
    }
    res.json({ message: `Recalculated points for ${updated} of ${logs.length} logs.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
