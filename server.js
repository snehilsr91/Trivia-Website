const express = require("express");
const mysql = require("mysql2");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const multer = require("multer"); // <-- added for file uploads

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
  secret: "your_super_secret_key",
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

// ------------------- MULTER CONFIG -------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/avatars/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `user_${req.session.user.id}${ext}`);
  }
});

const upload = multer({ storage });

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
    (err, results) => {
      if (err) {
        return res.status(400).json({ message: "Username already taken." });
      }

      const userId = results.insertId;

      db.query(
        "INSERT INTO user_stats (user_id) VALUES (?)",
        [userId],
        () => {
          res.status(200).json({ message: "Signup successful" });
        }
      );
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

// Get current session user
app.get("/api/me", (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "Not logged in" });
  res.status(200).json({ user: req.session.user });
});

// Trivia Question
app.get("/api/question", requireLogin, (req, res) => {
  db.query("SELECT * FROM trivia_questions ORDER BY RAND() LIMIT 1", (err, result) => {
    if (err || result.length === 0) {
      return res.status(500).json({ message: "Could not fetch question" });
    }
    res.json(result[0]);
  });
});

// Update stats
app.post("/api/update-stats", (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "Not logged in" });

  const userId = req.session.user.id;
  const isCorrect = req.body.correct;

  db.query("SELECT * FROM user_stats WHERE user_id = ?", [userId], (err, results) => {
    if (err) return res.status(500).json({ message: "Error fetching stats" });

    if (results.length === 0) {
      db.query(
        "INSERT INTO user_stats (user_id, total_answered, correct_answers, streak) VALUES (?, 1, ?, ?)",
        [userId, isCorrect ? 1 : 0, isCorrect ? 1 : 0],
        (err) => {
          if (err) return res.status(500).json({ message: "Error inserting stats" });
          res.json({ message: "Stats initialized" });
        }
      );
    } else {
      const stats = results[0];
      const newTotal = stats.total_answered + 1;
      const newCorrect = isCorrect ? stats.correct_answers + 1 : stats.correct_answers;
      const newStreak = isCorrect ? stats.streak + 1 : 0;

      db.query(
        "UPDATE user_stats SET total_answered = ?, correct_answers = ?, streak = ? WHERE user_id = ?",
        [newTotal, newCorrect, newStreak, userId],
        (err) => {
          if (err) return res.status(500).json({ message: "Error updating stats" });
          res.json({ message: "Stats updated" });
        }
      );
    }
  });
});

// Get logged-in user's full profile
app.get("/api/user-profile", (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "Not logged in" });

  const userId = req.session.user.id;

  db.query(
    "SELECT email, description, avatar_url, total_answered, correct_answers, streak FROM user_stats WHERE user_id = ?",
    [userId],
    (err, results) => {
      if (err) return res.status(500).json({ message: "Database error" });
      if (results.length === 0) return res.status(404).json({ message: "No stats found" });

      const user = results[0];
      if (!user.avatar_url) user.avatar_url = "/avatars/default.png";

      res.json(user);
    }
  );
});

// Update user's profile info (email, description, avatar)
app.post("/api/update-user-info", upload.single("avatar"), (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "Not logged in" });

  const userId = req.session.user.id;
  const { email, description } = req.body;
  const avatar_url = req.file ? `/avatars/${req.file.filename}` : null;

  const query = avatar_url
    ? "UPDATE user_stats SET email = ?, description = ?, avatar_url = ? WHERE user_id = ?"
    : "UPDATE user_stats SET email = ?, description = ? WHERE user_id = ?";

  const values = avatar_url
    ? [email || null, description || null, avatar_url, userId]
    : [email || null, description || null, userId];

  db.query(query, values, (err) => {
    if (err) return res.status(500).json({ message: "Failed to update" });
    res.json({ message: "User info updated" });
  });
});

// ----------------------------------------------------

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
