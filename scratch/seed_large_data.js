import mongoose from 'mongoose';
import { User, YearGoal, MonthGoal, WeekGoal, DailyLog } from '../backend/models.js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: '../backend/.env' });

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/routine-tracker';

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoURI);
  console.log('Connected to', mongoURI);

  // 1. Get or create fallback user
  let user = await User.findOne({ email: 'prashant@example.com' });
  if (!user) {
    user = new User({
      googleId: 'mock-default',
      email: 'prashant@example.com',
      name: 'PRASHANT CHAUHAN',
      picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'
    });
    await user.save();
  }
  const userId = user._id;

  // Clear existing logs and goals for this user to have a clean benchmark
  await YearGoal.deleteMany({ userId });
  await MonthGoal.deleteMany({ userId });
  await WeekGoal.deleteMany({ userId });
  await DailyLog.deleteMany({ userId });

  console.log('Seeding Year Goal...');
  const yearGoal = new YearGoal({
    userId,
    year: 2026,
    title: 'Achieve Peak Physical & Mental Performance',
    description: 'Establish consistent routines, maintain strict budgets, and master study lists.',
    status: 'pending'
  });
  await yearGoal.save();

  console.log('Seeding Month Goals...');
  const months = [4, 5]; // May (4), June (5)
  const monthGoals = [];
  for (let m of months) {
    const monthGoal = new MonthGoal({
      userId,
      yearGoalId: yearGoal._id,
      year: 2026,
      month: m,
      title: `Build habits in ${m === 4 ? 'May' : 'June'}`,
      status: 'pending'
    });
    await monthGoal.save();
    monthGoals.push(monthGoal);
  }

  console.log('Seeding Week Goals...');
  // June weeks: Week 23, 24
  const weekGoals = [];
  const weekNumbers = [22, 23, 24];
  for (let w of weekNumbers) {
    const weekGoal = new WeekGoal({
      userId,
      monthGoalId: monthGoals[1]._id, // June
      weekNumber: w,
      year: 2026,
      title: `Systematic habits for Week ${w}`,
      categories: [
        {
          name: 'physical task',
          subTasks: ['Drink 3L Water', '30 min HIIT Workout']
        },
        {
          name: 'study task',
          subTasks: ['Complete 2 DSA Problems', 'Read Tech Documentation']
        },
        {
          name: 'daily routine',
          subTasks: ['08:00 AM: Wake up early', '11:00 PM: Lock screens']
        },
        {
          name: 'restriction',
          subTasks: ['No Junk Food', 'No Social Media Scrolling']
        }
      ]
    });
    await weekGoal.save();
    weekGoals.push(weekGoal);
  }

  console.log('Seeding Daily Logs (50 days history)...');
  const logsCount = 50;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - logsCount);

  for (let i = 0; i < logsCount; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    const dateStr = currentDate.toISOString().split('T')[0];

    // Determine week number
    const target = new Date(currentDate.valueOf());
    const dayNr = (currentDate.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const weekNum = 1 + Math.ceil((firstThursday - target) / 604800000);

    // Matching week goal if exists
    const matchingWeekGoal = weekGoals.find(wg => wg.weekNumber === weekNum) || weekGoals[0];

    // Build tasks based on compliance probability (e.g. 75% chance of compliance for streak tests)
    const complianceRate = 0.75;
    const tasks = [];
    matchingWeekGoal.categories.forEach(cat => {
      cat.subTasks.forEach(sub => {
        const isMandatory = true;
        const rand = Math.random();
        let status = 'pending';
        
        if (cat.name === 'restriction') {
          status = rand < complianceRate ? 'completed' : 'failed'; // failed means broken restriction
        } else {
          status = rand < complianceRate ? 'completed' : 'failed';
        }

        tasks.push({
          text: sub,
          category: cat.name,
          isMandatory,
          status
        });
      });
    });

    // Seed some extra tasks
    if (Math.random() < 0.3) {
      tasks.push({
        text: 'Clean room workspace',
        category: 'extra task',
        isMandatory: false,
        status: Math.random() < 0.7 ? 'completed' : 'pending'
      });
    }

    // Seed expenses (e.g. average 250 INR, sometimes exceeding 500 budget)
    const expenses = [];
    const expenseRate = 0.6;
    if (Math.random() < expenseRate) {
      expenses.push({
        title: 'Food Delivery',
        amount: Math.round(Math.random() * 400 + 50),
        category: 'food'
      });
    }
    if (Math.random() < 0.2) {
      expenses.push({
        title: 'Textbook Purchase',
        amount: 250,
        category: 'study'
      });
    }

    const budget = 500;
    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Calculate score points (approximate matching routes.js)
    const mandatory = tasks.filter(t => t.isMandatory);
    const completedMandatory = mandatory.filter(t => t.status === 'completed').length;
    const taskPoints = mandatory.length > 0 ? (completedMandatory / mandatory.length) : 0;

    const extra = tasks.filter(t => !t.isMandatory && t.status === 'completed').length;
    const extraPoints = Math.min(extra * 0.25, 0.5);

    const restrictions = tasks.filter(t => t.category.includes('restrict'));
    const failedRestrictions = restrictions.filter(t => t.status === 'failed').length;
    const restrictionPoints = restrictions.length > 0 ? (failedRestrictions > 0 ? failedRestrictions * -0.5 : 0.5) : 0;

    let expensePoints = 0;
    if (totalSpent <= budget) {
      expensePoints = 0.5;
    } else if (totalSpent <= budget * 1.5) {
      expensePoints = -0.5;
    } else {
      expensePoints = -1.0;
    }

    const points = Math.max(-2.0, Math.min(2.0, parseFloat((taskPoints + extraPoints + restrictionPoints + expensePoints).toFixed(2))));

    const log = new DailyLog({
      userId,
      date: dateStr,
      weekGoalId: matchingWeekGoal._id,
      tasks,
      expenses,
      dailyBudget: budget,
      points,
      isLocked: Math.random() < 0.5,
      note: `Day review: complied with most rules. Points: ${points}.`
    });

    await log.save();
  }

  console.log(`[SUCCESS] Seeded ${logsCount} days of routine metrics successfully.`);
  await mongoose.disconnect();
  console.log('Database disconnected.');
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
