const express = require("express");
const mysql = require("mysql2");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const session = require("express-session");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Static Files
app.use(express.static(path.join(__dirname, "public")));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Setup
app.use(session({
  secret: "your_super_secret_key", // change in .env for security
  resave: false,
  saveUninitialized: false,
}));

// MySQL Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error("DB connection failed:", err);
  } else {
    console.log("Connected to MySQL 🎉");
  }
});

// ---------------------- ROUTES ----------------------

// Serve home.html by default
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

// Signup
app.post("/api/signup", async (req, res) => {
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO users (username, password_hash) VALUES (?, ?)",
    [username, hash],
    (err) => {
      if (err) {
        return res.status(400).json({ message: "Username already taken." });
      }
      res.status(200).json({ message: "Signup successful" });
    }
  );
});

// Login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, results) => {
      if (err) return res.sendStatus(500);

      if (results.length === 0) {
        return res.status(401).json({ message: "User not found" });
      }

      const user = results[0];
      const match = await bcrypt.compare(password, user.password_hash);

      if (!match) {
        return res.status(401).json({ message: "Incorrect password" });
      }

      req.session.user = { id: user.id, username: user.username };
      res.status(200).json({ message: "Login successful" });
    }
  );
});

// Logout
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.status(200).json({ message: "Logged out" });
  });
});

// Auth Middleware
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Login required" });
  }
  next();
};

// Get current user (for frontend display)
app.get("/api/me", (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "Not logged in" });
  res.status(200).json({ user: req.session.user });
});

// Trivia Question (protected)
app.get("/api/question", requireLogin, (req, res) => {
  db.query("SELECT * FROM trivia_questions ORDER BY RAND() LIMIT 1", (err, result) => {
    if (err || result.length === 0) {
      return res.status(500).json({ message: "Could not fetch question" });
    }
    res.json(result[0]);
  });
});

// ----------------------------------------------------

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
