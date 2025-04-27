const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const db = require("../db/connection");

// Middleware
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Login required" });
  }
  next();
};

// Signup
router.post("/signup", async (req, res) => {
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
router.post("/login", (req, res) => {
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
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.status(200).json({ message: "Logged out" });
  });
});

// Get current session user
router.get("/me", (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "Not logged in" });
  res.status(200).json({ user: req.session.user });
});

module.exports = router;
