import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Main API Routes
app.use('/api', apiRouter);

// Catch-all route for status
app.get('/status', (req, res) => {
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Database Connection
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/routine-tracker';

import { User, YearGoal, MonthGoal, WeekGoal, DailyLog } from './models.js';

console.log('Connecting to MongoDB...');
mongoose.connect(mongoURI)
  .then(async () => {
    console.log(`[SUCCESS] Connected to MongoDB at ${mongoURI}`);
    
    // Drop legacy unique indexes to align with relaxed constraints
    try {
      await mongoose.connection.db.collection('yeargoals').dropIndex('year_1');
    } catch (e) {}
    try {
      await mongoose.connection.db.collection('monthgoals').dropIndex('yearGoalId_1_month_1');
    } catch (e) {}
    try {
      await mongoose.connection.db.collection('weekgoals').dropIndex('monthGoalId_1_weekNumber_1');
    } catch (e) {}
    try {
      await mongoose.connection.db.collection('dailylogs').dropIndex('date_1');
    } catch (e) {}

    // Database migration: Ensure all existing documents have a userId assigned
    try {
      const defaultUser = await User.findOne({ email: 'prashant@example.com' });
      let userId;
      if (!defaultUser) {
        const newUser = new User({
          googleId: 'mock-default',
          email: 'prashant@example.com',
          name: 'PRASHANT CHAUHAN',
          picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'
        });
        await newUser.save();
        userId = newUser._id;
        console.log('Created default fallback user:', newUser.email);
      } else {
        userId = defaultUser._id;
      }

      const yUpdate = await YearGoal.updateMany({ userId: { $exists: false } }, { $set: { userId } });
      const mUpdate = await MonthGoal.updateMany({ userId: { $exists: false } }, { $set: { userId } });
      const wUpdate = await WeekGoal.updateMany({ userId: { $exists: false } }, { $set: { userId } });
      const dUpdate = await DailyLog.updateMany({ userId: { $exists: false } }, { $set: { userId } });

      if (yUpdate.modifiedCount > 0 || mUpdate.modifiedCount > 0 || wUpdate.modifiedCount > 0 || dUpdate.modifiedCount > 0) {
        console.log(`[MIGRATION] Migration complete: updated ${yUpdate.modifiedCount} year goals, ${mUpdate.modifiedCount} month goals, ${wUpdate.modifiedCount} week goals, ${dUpdate.modifiedCount} daily logs.`);
      }
    } catch (migErr) {
      console.error('[MIGRATION ERROR] Failed to run database migration:', migErr);
    }

    app.listen(PORT, () => {
      console.log(`[SUCCESS] Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('[ERROR] Database connection failed:', err);
    console.log('\n============================================================');
    console.log('IMPORTANT: Please verify that MongoDB is installed and running locally.');
    console.log('Command to start MongoDB service (Windows Power Shell as admin):');
    console.log('  Start-Service MongoDB');
    console.log('============================================================\n');
    process.exit(1);
  });
