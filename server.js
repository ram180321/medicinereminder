// server.js
import 'dotenv/config';
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import twilio from 'twilio';
import path from "path";
import { fileURLToPath } from "url";

// Models & scheduler (assumes models/ and scheduler.js are at repo root)
import Medicine from "./models/Medicine.js";
import User from "./models/User.js";
import reminderScheduler from "./Backend/scheduler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// ---------- MongoDB ----------
const mongoURI = process.env.MONGO_URI || ""; // set on Render
mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err.message));

  app.use(cors({
  origin: "https://medicinereminder-4vsg.onrender.com",
  methods: ["GET","POST","PUT","DELETE"]
}));

// ---------- AUTH / HELPERS ----------
function authMiddleware(role) {
  return (req, res, next) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(401).json({ message: "No token" });
    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Invalid token" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (role && decoded.role !== role) {
        return res.status(403).json({ message: "Access denied" });
      }
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ message: "Invalid token" });
    }
  };
}

// ---------- AUTH ROUTES ----------
// Register
app.post("/api/auth/register", async (req, res) => {
  console.log("-> POST /api/auth/register route hit");
  try {
    const { email, password, role } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "User already exists" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      email,
      password: hashedPassword,
      role: role || "user",
    });
    await user.save();
    res.status(201).json({ message: "Account created successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  console.log("-> POST /api/auth/login route hit");
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });
    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );
    res.json({ token, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- ADMIN ROUTES ----------
app.get("/api/admin/users", authMiddleware("admin"), async (req, res) => {
  console.log("-> GET /api/admin/users route hit");
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/users/:id", authMiddleware("admin"), async (req, res) => {
  console.log("-> DELETE /api/admin/users/:id route hit");
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/users/:id/role", authMiddleware("admin"), async (req, res) => {
  console.log("-> PUT /api/admin/users/:id/role route hit");
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: `User role updated to ${role}`, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/admin/medicines/count", authMiddleware("admin"), async (req, res) => {
  console.log("-> GET /api/admin/medicines/count route hit");
  try {
    const count = await Medicine.countDocuments();
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- MEDICINE ROUTES ----------
app.post("/api/medicines", authMiddleware("user"), async (req, res) => {
  console.log("-> POST /api/medicines route hit");
  try {
    const medicine = new Medicine({ ...req.body, userId: req.user.id });
    await medicine.save();
    res.status(201).json(medicine);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/medicines", authMiddleware("user"), async (req, res) => {
  console.log("-> GET /api/medicines route hit");
  try {
    const meds = await Medicine.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(meds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/medicines/:id", authMiddleware("user"), async (req, res) => {
  console.log("-> PUT /api/medicines/:id route hit");
  try {
    const { name, dose, time, recurrence, days, stock } = req.body;
    const medicine = await Medicine.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { name, dose, time, recurrence, days, stock },
      { new: true, runValidators: true }
    );
    if (!medicine) return res.status(404).json({ message: "Medicine not found or access denied" });
    res.json(medicine);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/medicines/:id", authMiddleware("user"), async (req, res) => {
  console.log("-> DELETE /api/medicines/:id route hit");
  try {
    const medicine = await Medicine.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!medicine) return res.status(404).json({ message: "Medicine not found or access denied" });
    res.json({ message: "Medicine deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/medicines/:id/taken", authMiddleware("user"), async (req, res) => {
  console.log("-> PUT /api/medicines/:id/taken route hit");
  try {
    const medicine = await Medicine.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, stock: { $gt: 0 } },
      { $inc: { stock: -1 } },
      { new: true }
    );
    if (!medicine) return res.status(404).json({ message: "Medicine not found or stock is zero." });
    res.json(medicine);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------- PROFILE ROUTES ----------
app.get("/api/profile", authMiddleware("user"), async (req, res) => {
  console.log("-> GET /api/profile route hit");
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/profile", authMiddleware("user"), async (req, res) => {
  console.log("-> PUT /api/profile route hit");
  try {
    const { name, phoneNumber, age, sex } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, phoneNumber, age, sex },
      { new: true, runValidators: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- OPTIONAL: Twilio example (use env vars) ----------
const TWILIO_SID = process.env.TWILIO_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH || "";
let twilioClient = null;
if (TWILIO_SID && TWILIO_AUTH) {
  try {
    twilioClient = twilio(TWILIO_SID, TWILIO_AUTH);
  } catch (e) {
    console.error("Twilio init error:", e.message);
  }
}

// Example Twilio usage (if you have it in code anywhere, keep using twilioClient)
app.post("/api/twilio/send", async (req, res) => {
  if (!twilioClient) return res.status(500).json({ message: "Twilio not configured" });
  const { to, body } = req.body;
  try {
    const msg = await twilioClient.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
    res.json({ sid: msg.sid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Serve static frontend (if you have public/ folder) ----------
app.use(express.static(path.join(__dirname, "frontend")));

// For SPAs: send index.html for unknown routes (comment out if unwanted)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend/index.html"));
});

// ---------- Start server & scheduler ----------
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  // start any background/scheduler tasks AFTER server is listening
  try {
    reminderScheduler();
  } catch (err) {
    console.error("Scheduler error:", err);
  }
});
