const express = require("express");
const router = express.Router();
const db = require("../db/connection");
const multer = require("multer");
const path = require("path");

// Multer setup for profile pictures
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

// Middleware
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Login required" });
  }
  next();
};

// Get user profile
router.get("/user-profile", requireLogin, (req, res) => {
  const userId = req.session.user.id;
  db.query("SELECT email, description, avatar_url, total_answered, correct_answers, streak FROM user_stats WHERE user_id = ?", [userId], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (results.length === 0) return res.status(404).json({ message: "No stats found" });

    const user = results[0];
    if (!user.avatar_url) user.avatar_url = "/avatars/default.png";
    res.json(user);
  });
});

// Update user info
router.post("/update-user-info", requireLogin, upload.single("avatar"), (req, res) => {
  const userId = req.session.user.id;
  const { email, description } = req.body;
  let avatarUrl = null;
  if (req.file) avatarUrl = `/avatars/${req.file.filename}`;

  db.query("UPDATE users SET email = ?, description = ? WHERE id = ?", [email, description, userId], (err) => {
    if (err) return res.status(500).json({ message: "Error updating user info" });

    if (avatarUrl) {
      db.query("UPDATE user_stats SET avatar_url = ? WHERE user_id = ?", [avatarUrl, userId]);
    }

    res.json({ message: "Profile updated" });
  });
});

module.exports = router;
