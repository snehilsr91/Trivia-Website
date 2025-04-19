const express = require("express");
const mysql = require("mysql2");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const multer = require("multer");
const schedule = require("node-schedule");

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

// ---------------- DAILY TRIVIA ----------------
const getTodayIST = () => {
  const now = new Date();
  const offsetIST = 5.5 * 60; // IST offset in minutes
  const localTime = new Date(now.getTime() + offsetIST * 60000);
  return localTime.toISOString().slice(0, 10);
};

app.get("/api/daily-question", requireLogin, (req, res) => {
  const today = getTodayIST();

  db.query("SELECT question_id FROM daily_question WHERE date = ?", [today], (err, result) => {
    if (err) {
      return res.status(500).json({ message: "DB error" });
    }

    // If there is a row for today, return it
    if (result.length > 0) {
      const questionId = result[0].question_id;
      db.query("SELECT * FROM trivia_questions WHERE id = ?", [questionId], (err2, questionResult) => {
        if (err2 || questionResult.length === 0) {
          return res.status(500).json({ message: "Could not fetch question" });
        }
        res.json(questionResult[0]);
      });
    } else {
      // If no row exists for today, truncate the table and add a new question
      db.query("TRUNCATE TABLE daily_question", (err3) => {
        if (err3) {
          return res.status(500).json({ message: "Error clearing daily question" });
        }

        // Fetch a random question from trivia_questions
        db.query("SELECT id FROM trivia_questions ORDER BY RAND() LIMIT 1", (err4, newQuestion) => {
          if (err4 || newQuestion.length === 0) {
            return res.status(500).json({ message: "No questions found" });
          }

          const questionId = newQuestion[0].id;

          // Insert the new question for today
          db.query("INSERT INTO daily_question (date, question_id) VALUES (?, ?)", [today, questionId], (err5) => {
            if (err5) {
              return res.status(500).json({ message: "Insert failed" });
            }

            // Fetch and send the new question
            db.query("SELECT * FROM trivia_questions WHERE id = ?", [questionId], (err6, questionResult) => {
              if (err6 || questionResult.length === 0) {
                return res.status(500).json({ message: "Could not fetch new question" });
              }
              res.json(questionResult[0]);
            });
          });
        });
      });
    }
  });
});


// ------------------- HAS ATTEMPTED -------------------

app.get("/api/has-attempted", requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const today = getTodayIST();

  db.query("SELECT * FROM daily_attempts WHERE user_id = ? AND date = ?", [userId, today], (err, result) => {
    if (err) {
      return res.status(500).json({ message: "DB error" });
    }

    if (result.length > 0) {
      return res.json({ attempted: true });
    } else {
      return res.json({ attempted: false });
    }
  });
});

// ------------------- SUBMIT DAILY -------------------

app.post("/api/submit-daily", requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const { question_id, selected_option } = req.body;
  const today = getTodayIST();

  db.query("SELECT * FROM daily_attempts WHERE user_id = ? AND date = ?", [userId, today], (err, result) => {
    if (err) {
      return res.status(500).json({ message: "DB error" });
    }

    db.query("SELECT answer FROM trivia_questions WHERE id = ?", [question_id], (err2, qResult) => {
      if (err2 || qResult.length === 0) {
        return res.status(500).json({ message: "Question not found" });
      }

      const correct = qResult[0].answer === selected_option;

      db.query("SELECT * FROM user_stats WHERE user_id = ?", [userId], (err3, statsResult) => {
        if (err3) {
          return res.status(500).json({ message: "Stats error" });
        }

        if (statsResult.length === 0) {
          db.query("INSERT INTO user_stats (user_id, total_answered, correct_answers, streak) VALUES (?, 1, ?, ?)", [userId, correct ? 1 : 0, correct ? 1 : 0]);
        } else {
          const stats = statsResult[0];
          const newTotal = stats.total_answered + 1;
          const newCorrect = correct ? stats.correct_answers + 1 : stats.correct_answers;
          const newStreak = correct ? stats.streak + 1 : 0;

          db.query("UPDATE user_stats SET total_answered = ?, correct_answers = ?, streak = ? WHERE user_id = ?", [newTotal, newCorrect, newStreak, userId]);
        }

        db.query("INSERT INTO daily_attempts (user_id, date) VALUES (?, ?)", [userId, today], (err4) => {
          if (err4) {
            return res.status(500).json({ message: "Failed to log daily attempt" });
          }
          res.json({ correct });
        });
      });
    });
  });
});



// ------------------- PROFILE ROUTES -------------------
app.get("/api/user-profile", (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "Not logged in" });
  const userId = req.session.user.id;
  db.query("SELECT email, description, avatar_url, total_answered, correct_answers, streak FROM user_stats WHERE user_id = ?", [userId], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (results.length === 0) return res.status(404).json({ message: "No stats found" });
    const user = results[0];
    if (!user.avatar_url) user.avatar_url = "/avatars/default.png";
    res.json(user);
  });
});

app.post("/api/update-user-info", upload.single("avatar"), (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "Not logged in" });
  const userId = req.session.user.id;
  const { email, description } = req.body;

  let avatarUrl = null;
  if (req.file) avatarUrl = `/avatars/${req.file.filename}`;

  db.query("UPDATE users SET email = ?, description = ? WHERE id = ?", [email, description, userId], (err, result) => {
    if (err) return res.status(500).json({ message: "Error updating user info" });

    if (avatarUrl) {
      db.query("UPDATE user_stats SET avatar_url = ? WHERE user_id = ?", [avatarUrl, userId]);
    }

    res.json({ message: "Profile updated" });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port http://localhost:${PORT}`);
});
