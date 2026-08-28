import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const DEFAULT_MONGO_URI = 'mongodb+srv://deepakvashisth2102_db_user:Deepak2113@cluster0.vcltoxd.mongodb.net/?retryWrites=true&w=majority';

function getMongoUri() {
  let rawUri = process.env.MONGODB_URI || process.env.DATABASE_URL || process.env.MONGO_URL || DEFAULT_MONGO_URI;
  // Auto-sanitize if password was pasted with angle brackets: :<password>@ -> :password@
  if (rawUri && /:<([^>]+)>@/.test(rawUri)) {
    rawUri = rawUri.replace(/:<([^>]+)>@/, ':$1@');
  }
  return rawUri;
}

// Fallback filesystem storage path
const dataDir = process.env.VERCEL ? '/tmp' : path.resolve('data');
try {
  fs.mkdirSync(dataDir, { recursive: true });
} catch (e) {}

const usersFile = path.join(dataDir, 'users.json');
const examsFile = path.join(dataDir, 'exams.json');
const attemptsFile = path.join(dataDir, 'attempts.json');

// In-memory fallback
let memUsers = [];
let memExams = [];
let memAttempts = [];

const readFileSafe = (file, fallback) => {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {}
  return fallback;
};

const writeFileSafe = (file, data) => {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {}
};

// -------------------------------------------------------------
// MONGOOSE SCHEMAS & MODELS
// -------------------------------------------------------------
const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, default: '' },
  passwordSalt: { type: String, default: '' },
  role: { type: String, default: 'student' },
  authProvider: { type: String, default: 'local' },
  avatar: { type: String, default: '' },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, { timestamps: true });

const ExamSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  code: { type: String, required: true, unique: true, index: true },
  adminKey: { type: String },
  creatorId: { type: String, index: true },
  creatorEmail: { type: String, index: true },
  creatorName: { type: String },
  title: { type: String, required: true },
  createdAt: { type: String, default: () => new Date().toISOString() },
  config: {
    duration: { type: Number, default: 30 },
    positiveMarks: { type: Number, default: 1 },
    negativeMarks: { type: Number, default: 0.25 },
    cutoffMarks: { type: Number, default: 0 }
  },
  questions: { type: Array, default: [] },
  answerKey: { type: Object, default: {} }
}, { timestamps: true });

const AttemptSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  examId: { type: String, index: true },
  examCode: { type: String, index: true },
  examTitle: { type: String },
  candidateId: { type: String, index: true },
  candidateName: { type: String },
  candidateEmail: { type: String, index: true },
  submittedAt: { type: String, default: () => new Date().toISOString() },
  timeSpentSeconds: { type: Number, default: 0 },
  answers: { type: Object, default: {} },
  result: { type: Object, default: {} }
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Exam = mongoose.models.Exam || mongoose.model('Exam', ExamSchema);
const Attempt = mongoose.models.Attempt || mongoose.model('Attempt', AttemptSchema);

let isMongoConnected = false;

export async function connectDB() {
  const uri = getMongoUri();
  if (!uri) {
    return false;
  }

  if (mongoose.connection.readyState === 1) {
    isMongoConnected = true;
    return true;
  }

  try {
    mongoose.set('strictQuery', false);
    if (!global._mongoosePromise || mongoose.connection.readyState === 0) {
      global._mongoosePromise = mongoose.connect(uri, {
        dbName: process.env.MONGODB_DB || 'examlens',
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000
      });
    }
    await global._mongoosePromise;
    isMongoConnected = mongoose.connection.readyState === 1;
    if (isMongoConnected) {
      console.log('✅ Connected to MongoDB Atlas successfully.');
    }
    return isMongoConnected;
  } catch (err) {
    global._mongoosePromise = null;
    isMongoConnected = false;
    console.warn('⚠️  MongoDB connection error:', err.message);
    return false;
  }
}

// -------------------------------------------------------------
// USER REPOSITORY OPERATIONS
// -------------------------------------------------------------
export async function getAllUsers() {
  await connectDB();
  if (isMongoConnected && User) {
    try {
      return await User.find({}).lean();
    } catch (e) {}
  }
  return readFileSafe(usersFile, memUsers);
}

export async function findUserByEmail(email) {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();
  await connectDB();
  if (isMongoConnected && User) {
    try {
      return await User.findOne({ email: cleanEmail }).lean();
    } catch (e) {}
  }
  const users = readFileSafe(usersFile, memUsers);
  return users.find((u) => u.email && u.email.toLowerCase() === cleanEmail) || null;
}

export async function findUserById(id) {
  if (!id) return null;
  await connectDB();
  if (isMongoConnected && User) {
    try {
      return await User.findOne({ id }).lean();
    } catch (e) {}
  }
  const users = readFileSafe(usersFile, memUsers);
  return users.find((u) => u.id === id) || null;
}

export async function saveUser(user) {
  await connectDB();
  if (isMongoConnected && User) {
    try {
      await User.findOneAndUpdate({ id: user.id }, user, { upsert: true, new: true });
      return user;
    } catch (e) {
      console.error('Mongo saveUser error:', e.message);
    }
  }
  const users = readFileSafe(usersFile, memUsers);
  const idx = users.findIndex((u) => u.id === user.id || (u.email && user.email && u.email.toLowerCase() === user.email.toLowerCase()));
  if (idx !== -1) users[idx] = user;
  else users.push(user);
  memUsers = users;
  writeFileSafe(usersFile, users);
  return user;
}

// -------------------------------------------------------------
// EXAM REPOSITORY OPERATIONS
// -------------------------------------------------------------
export async function getAllExams() {
  await connectDB();
  if (isMongoConnected && Exam) {
    try {
      return await Exam.find({}).sort({ createdAt: -1 }).lean();
    } catch (e) {}
  }
  return readFileSafe(examsFile, memExams);
}

export async function findExamByCode(code) {
  if (!code) return null;
  const rawCode = code.toString().trim();
  const cleanCode = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '');

  await connectDB();
  if (isMongoConnected && Exam) {
    try {
      const doc = await Exam.findOne({
        $or: [
          { code: cleanCode },
          { code: rawCode.toUpperCase() },
          { code: new RegExp(`^${cleanCode}$`, 'i') },
          { id: rawCode },
          { id: cleanCode }
        ]
      }).lean();
      if (doc) return doc;
    } catch (e) {
      console.error('Mongo findExamByCode error:', e.message);
    }
  }
  const exams = readFileSafe(examsFile, memExams);
  return exams.find((e) => {
    const ec = (e.code || '').toString().trim().toUpperCase();
    const eid = (e.id || '').toString().trim().toUpperCase();
    return ec === cleanCode || ec === rawCode.toUpperCase() || eid === cleanCode || eid === rawCode.toUpperCase();
  }) || null;
}

export async function saveExam(exam) {
  if (!exam || !exam.code) return exam;
  exam.code = exam.code.toString().trim().toUpperCase();
  await connectDB();
  if (isMongoConnected && Exam) {
    try {
      await Exam.findOneAndUpdate(
        { code: exam.code },
        { $set: exam },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
      console.log(`✅ Exam "${exam.code}" successfully stored in MongoDB Atlas.`);
      return exam;
    } catch (e) {
      console.error('Mongo saveExam error:', e.message);
    }
  }
  const exams = readFileSafe(examsFile, memExams);
  const idx = exams.findIndex((e) => e.code === exam.code || e.id === exam.id);
  if (idx !== -1) exams[idx] = exam;
  else exams.unshift(exam);
  memExams = exams;
  writeFileSafe(examsFile, exams);
  return exam;
}

// -------------------------------------------------------------
// ATTEMPT REPOSITORY OPERATIONS
// -------------------------------------------------------------
export async function getAllAttempts() {
  await connectDB();
  if (isMongoConnected && Attempt) {
    try {
      return await Attempt.find({}).sort({ submittedAt: -1 }).lean();
    } catch (e) {}
  }
  return readFileSafe(attemptsFile, memAttempts);
}

export async function getAttemptsByExam(examCodeOrId) {
  if (!examCodeOrId) return [];
  const cleanCode = examCodeOrId.trim().toUpperCase();
  await connectDB();
  if (isMongoConnected && Attempt) {
    try {
      return await Attempt.find({ $or: [{ examCode: cleanCode }, { examId: examCodeOrId }] })
        .sort({ submittedAt: -1 })
        .lean();
    } catch (e) {}
  }
  const attempts = readFileSafe(attemptsFile, memAttempts);
  return attempts.filter((a) => a.examCode === cleanCode || a.examId === examCodeOrId);
}

export async function getAttemptsByUser(userId, userEmail) {
  await connectDB();
  if (isMongoConnected && Attempt) {
    try {
      const query = [];
      if (userId) query.push({ candidateId: userId });
      if (userEmail) query.push({ candidateEmail: userEmail.toLowerCase() });
      if (!query.length) return [];
      return await Attempt.find({ $or: query }).sort({ submittedAt: -1 }).lean();
    } catch (e) {}
  }
  const attempts = readFileSafe(attemptsFile, memAttempts);
  return attempts.filter(
    (a) =>
      (userId && a.candidateId === userId) ||
      (userEmail && a.candidateEmail && a.candidateEmail.toLowerCase() === userEmail.toLowerCase())
  );
}

export async function findAttemptById(attemptId) {
  if (!attemptId) return null;
  await connectDB();
  if (isMongoConnected && Attempt) {
    try {
      return await Attempt.findOne({ id: attemptId }).lean();
    } catch (e) {}
  }
  const attempts = readFileSafe(attemptsFile, memAttempts);
  return attempts.find((a) => a.id === attemptId) || null;
}

export async function saveAttempt(attempt) {
  await connectDB();
  if (isMongoConnected && Attempt) {
    try {
      await Attempt.findOneAndUpdate({ id: attempt.id }, attempt, { upsert: true, new: true });
      return attempt;
    } catch (e) {
      console.error('Mongo saveAttempt error:', e.message);
    }
  }
  const attempts = readFileSafe(attemptsFile, memAttempts);
  const idx = attempts.findIndex((a) => a.id === attempt.id);
  if (idx !== -1) attempts[idx] = attempt;
  else attempts.unshift(attempt);
  memAttempts = attempts;
  writeFileSafe(attemptsFile, attempts);
  return attempt;
}
