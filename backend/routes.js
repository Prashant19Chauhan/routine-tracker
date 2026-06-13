import express from 'express';
import { YearGoal, MonthGoal, WeekGoal, DailyLog } from './models.js';

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
  const expenses = log.expenses || [];
  const budget = log.dailyBudget || 500;

  // 1. Mandatory tasks
  const mandatoryTasks = tasks.filter(t => t.isMandatory);
  const totalMandatory = mandatoryTasks.length;
  const completedMandatory = mandatoryTasks.filter(t => t.status === 'completed').length;

  let taskPoints = 0;
  if (totalMandatory > 0) {
    if (completedMandatory === 0) {
      taskPoints = -0.5; // Penalty for zero mandatory tasks done
    } else {
      taskPoints = completedMandatory / totalMandatory; // Scale from 0 to 1
    }
  }

  // 2. Extra tasks (+0.25 each, max +0.5)
  const extraTasks = tasks.filter(t => !t.isMandatory);
  const completedExtra = extraTasks.filter(t => t.status === 'completed').length;
  const extraPoints = Math.min(completedExtra * 0.25, 0.5);

  // 3. Restrictions
  const restrictionTasks = tasks.filter(t => t.category.toLowerCase().includes('restrict'));
  const totalRestrictions = restrictionTasks.length;
  const failedRestrictions = restrictionTasks.filter(t => t.status === 'failed').length;

  let restrictionPoints = 0;
  if (totalRestrictions > 0) {
    if (failedRestrictions > 0) {
      restrictionPoints = failedRestrictions * -0.5; // Deduct for each failed restriction
    } else {
      restrictionPoints = 0.5; // Reward for maintaining all restrictions
    }
  }

  // 4. Expenses
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  let expensePoints = 0;
  if (totalExpenses <= budget) {
    expensePoints = 0.5; // Under budget reward
  } else if (totalExpenses <= budget * 1.5) {
    expensePoints = -0.5; // Mildly over budget
  } else {
    expensePoints = -1.0; // Heavily over budget
  }

  // Final Points clamped between -2.0 and +2.0
  const finalPoints = Math.max(-2.0, Math.min(2.0, taskPoints + extraPoints + restrictionPoints + expensePoints));
  return parseFloat(finalPoints.toFixed(2));
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
    dates.push(d.toISOString().split('T')[0]);
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
  const failedTasks = tasks.filter(t => t.status === 'failed').length;
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

/* ==========================================================================
   YEAR GOALS ENDPOINTS
   ========================================================================= */

router.get('/goals/years', async (req, res) => {
  try {
    const filter = {};
    if (req.query.year) filter.year = Number(req.query.year);
    const goals = await YearGoal.find(filter).sort({ year: -1 });
    res.json(goals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/goals/years', async (req, res) => {
  try {
    const { year, title, description } = req.body;
    const goal = new YearGoal({ year, title, description });
    await goal.save();
    res.status(201).json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/goals/years/:id', async (req, res) => {
  try {
    const { title, description, status } = req.body;
    const goal = await YearGoal.findByIdAndUpdate(
      req.params.id,
      { title, description, status },
      { new: true }
    );
    res.json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/goals/years/:id', async (req, res) => {
  try {
    const yearGoal = await YearGoal.findById(req.params.id);
    if (!yearGoal) return res.status(404).json({ error: 'Goal not found' });
    
    // Delete cascading
    if (yearGoal._id) {
      const months = await MonthGoal.find({ yearGoalId: yearGoal._id });
      for (let m of months) {
        await WeekGoal.deleteMany({ monthGoalId: m._id });
      }
      await MonthGoal.deleteMany({ yearGoalId: yearGoal._id });
    }
    await YearGoal.findByIdAndDelete(req.params.id);

    res.json({ message: 'Year goal deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   MONTH GOALS ENDPOINTS
   ========================================================================== */

router.get('/goals/months', async (req, res) => {
  try {
    const filter = {};
    if (req.query.yearGoalId) filter.yearGoalId = req.query.yearGoalId;
    if (req.query.year) filter.year = Number(req.query.year);
    if (req.query.month) filter.month = Number(req.query.month);
    
    const goals = await MonthGoal.find(filter).sort({ month: 1 });
    res.json(goals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/goals/months', async (req, res) => {
  try {
    const { yearGoalId, month, year, title } = req.body;
    const goal = new MonthGoal({ yearGoalId, month, year, title });
    await goal.save();
    res.status(201).json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/goals/months/:id', async (req, res) => {
  try {
    const { title, status } = req.body;
    const goal = await MonthGoal.findByIdAndUpdate(
      req.params.id,
      { title, status },
      { new: true }
    );
    res.json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/goals/months/:id', async (req, res) => {
  try {
    await WeekGoal.deleteMany({ monthGoalId: req.params.id });
    await MonthGoal.findByIdAndDelete(req.params.id);
    res.json({ message: 'Month goal and weeks deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   WEEK GOALS ENDPOINTS
   ========================================================================== */

router.get('/goals/weeks', async (req, res) => {
  try {
    const filter = {};
    if (req.query.monthGoalId) filter.monthGoalId = req.query.monthGoalId;
    if (req.query.year) filter.year = Number(req.query.year);
    if (req.query.weekNumber) filter.weekNumber = Number(req.query.weekNumber);

    const goals = await WeekGoal.find(filter).sort({ weekNumber: 1 });
    res.json(goals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/goals/weeks', async (req, res) => {
  try {
    const { monthGoalId, weekNumber, year, title, categories } = req.body;
    const goal = new WeekGoal({ monthGoalId, weekNumber, year, title, categories });
    await goal.save();
    res.status(201).json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/goals/weeks/:id', async (req, res) => {
  try {
    const { title, categories } = req.body;
    const goal = await WeekGoal.findByIdAndUpdate(
      req.params.id,
      { title, categories },
      { new: true }
    );
    res.json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/goals/weeks/:id', async (req, res) => {
  try {
    await WeekGoal.findByIdAndDelete(req.params.id);
    res.json({ message: 'Week goal deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   DAILY LOGS ENDPOINTS
   ========================================================================== */

router.get('/goals/weekly-grid/:year/:weekNumber', async (req, res) => {
  try {
    const { year, weekNumber } = req.params;
    const dates = getDatesOfWeek(Number(year), Number(weekNumber));

    // Fetch all logs for these 7 dates
    const logs = await DailyLog.find({ date: { $in: dates } });
    
    // Fetch week goals for this week
    const weekGoals = await WeekGoal.find({ year: Number(year), weekNumber: Number(weekNumber) });

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

router.get('/logs/pending-bucket', async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const logs = await DailyLog.find({ date: { $lt: todayStr } }).sort({ date: 1 });
    
    const pendingTasks = [];
    logs.forEach(log => {
      log.tasks.forEach(task => {
        if (task.status === 'pending' || task.status === 'failed') {
          pendingTasks.push({
            date: log.date,
            text: task.text,
            category: task.category,
            isMandatory: task.isMandatory
          });
        }
      });
    });
    
    res.json(pendingTasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logs/resolve-pending', async (req, res) => {
  try {
    const { date, text } = req.body;
    if (!date || !text) {
      return res.status(400).json({ error: 'Missing date or task text parameters' });
    }

    const log = await DailyLog.findOne({ date });
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

router.get('/logs/:date', async (req, res) => {
  try {
    const { date } = req.params;
    let log = await DailyLog.findOne({ date });
    
    const { year, week } = getWeekNumber(date);
    const weekGoal = await WeekGoal.findOne({ year, weekNumber: week });

    if (log) {
      if (weekGoal) {
        let modified = false;
        if (!log.weekGoalId) {
          log.weekGoalId = weekGoal._id;
          modified = true;
        }
        weekGoal.categories.forEach(cat => {
          cat.subTasks.forEach(taskText => {
            const exists = log.tasks.some(t => t.text === taskText && t.isMandatory);
            if (!exists) {
              log.tasks.push({
                text: taskText,
                category: cat.name,
                isMandatory: true,
                status: 'pending'
              });
              modified = true;
            }
          });
        });
        if (modified) {
          log.points = calculateLogPoints(log);
          await log.save();
        }
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
            status: 'pending'
          });
        });
      });
    }

    const tempLog = {
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

router.post('/logs/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const { tasks, expenses, dailyBudget, note, weekGoalId, isLocked } = req.body;

    let log = await DailyLog.findOne({ date });

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
      log = new DailyLog({ date, weekGoalId });
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

router.get('/analytics/streak', async (req, res) => {
  try {
    const logs = await DailyLog.find().sort({ date: 1 });
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
      const cur = new Date(currentDateStr);
      
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
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const hasToday = activeDates.has(todayStr);
    const hasYesterday = activeDates.has(yesterdayStr);

    if (hasToday || hasYesterday) {
      // Find consecutive streak backwards from the latest log date that's active
      let checkDate = hasToday ? new Date(todayStr) : new Date(yesterdayStr);
      current = 0;
      while (true) {
        const checkStr = checkDate.toISOString().split('T')[0];
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

router.get('/analytics/dashboard', async (req, res) => {
  try {
    const allLogs = await DailyLog.find().sort({ date: 1 });
    
    // 1. Day breakdown (latest log, if any)
    const latestLog = allLogs[allLogs.length - 1] || null;

    // 2. Week breakdown (last 7 logs)
    const weekLogs = allLogs.slice(-7).map(log => ({
      date: log.date,
      points: log.points,
      totalExpenses: log.expenses.reduce((s, e) => s + e.amount, 0),
      dailyBudget: log.dailyBudget || 500,
      tasksCompleted: log.tasks.filter(t => t.status === 'completed').length,
      tasksTotal: log.tasks.length
    }));

    // 3. Month breakdown (last 30 logs for contribution grid)
    const monthLogs = allLogs.slice(-30).map(log => ({
      date: log.date,
      points: log.points,
      totalExpenses: log.expenses.reduce((s, e) => s + e.amount, 0),
      dailyBudget: log.dailyBudget || 500,
      tasksCompleted: log.tasks.filter(t => t.status === 'completed').length,
      tasksTotal: log.tasks.length
    }));

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

export default router;
