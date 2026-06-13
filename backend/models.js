import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  googleId: { type: String, unique: true, sparse: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  picture: { type: String, default: '' }
}, { timestamps: true });

const YearGoalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  year: { type: Number, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' }
}, { timestamps: true });

const MonthGoalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  yearGoalId: { type: mongoose.Schema.Types.ObjectId, ref: 'YearGoal' },
  month: { type: Number, required: true, min: 0, max: 11 }, // 0 = Jan, 11 = Dec
  year: { type: Number, required: true },
  title: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' }
}, { timestamps: true });

const WeekGoalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  monthGoalId: { type: mongoose.Schema.Types.ObjectId, ref: 'MonthGoal' },
  weekNumber: { type: Number, required: true, min: 1, max: 53 },
  year: { type: Number, required: true },
  title: { type: String, required: true },
  categories: [{
    name: { type: String, required: true }, // e.g. 'physical task', 'study task', 'daily routine', 'restriction'
    subTasks: [{ type: String }] // e.g. ["30m workout", "Read 10 pages"]
  }]
}, { timestamps: true });

const DailyLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD format
  weekGoalId: { type: mongoose.Schema.Types.ObjectId, ref: 'WeekGoal' },
  tasks: [{
    text: { type: String, required: true },
    category: { type: String, required: true },
    isMandatory: { type: Boolean, default: false },
    status: { type: String, enum: ['pending', 'completed', 'failed', 'rejected'], default: 'pending' }
  }],
  expenses: [{
    title: { type: String, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    category: { type: String, default: 'general' }
  }],
  dailyBudget: { type: Number, default: 500, min: 1 }, // default daily expense budget
  points: { type: Number, default: 0 }, // Score from -2.0 to +2.0
  isLocked: { type: Boolean, default: false },
  note: { type: String, default: '' }
}, { timestamps: true });

// Compound unique index for user and date
DailyLogSchema.index({ userId: 1, date: 1 }, { unique: true });

export const User = mongoose.model('User', UserSchema);
export const YearGoal = mongoose.model('YearGoal', YearGoalSchema);
export const MonthGoal = mongoose.model('MonthGoal', MonthGoalSchema);
export const WeekGoal = mongoose.model('WeekGoal', WeekGoalSchema);
export const DailyLog = mongoose.model('DailyLog', DailyLogSchema);
