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
