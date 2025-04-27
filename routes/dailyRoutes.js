const express = require("express");
const router = express.Router();
const db = require("../db/connection");

// Middleware
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Login required" });
  }
  next();
};

// Helper function to get today's date in IST
const getTodayIST = () => {
  const now = new Date();
  const offsetIST = 5.5 * 60; // IST offset in minutes
  const localTime = new Date(now.getTime() + offsetIST * 60000);
  return localTime.toISOString().slice(0, 10);
};

// Get Daily Question
router.get("/daily-question", requireLogin, (req, res) => {
  const today = getTodayIST();

  db.query("SELECT question_id FROM daily_question WHERE date = ?", [today], (err, result) => {
    if (err) {
      return res.status(500).json({ message: "DB error" });
    }

    if (result.length > 0) {
      const questionId = result[0].question_id;
      db.query("SELECT * FROM trivia_questions WHERE id = ?", [questionId], (err2, questionResult) => {
        if (err2 || questionResult.length === 0) {
          return res.status(500).json({ message: "Could not fetch question" });
        }
        res.json(questionResult[0]);
      });
    } else {
      db.query("TRUNCATE TABLE daily_question", (err3) => {
        if (err3) {
          return res.status(500).json({ message: "Error clearing daily question" });
        }

        db.query("SELECT id FROM trivia_questions ORDER BY RAND() LIMIT 1", (err4, newQuestion) => {
          if (err4 || newQuestion.length === 0) {
            return res.status(500).json({ message: "No questions found" });
          }

          const questionId = newQuestion[0].id;

          db.query("INSERT INTO daily_question (date, question_id) VALUES (?, ?)", [today, questionId], (err5) => {
            if (err5) {
              return res.status(500).json({ message: "Insert failed" });
            }

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

// Check if user has attempted
router.get("/has-attempted", requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const today = getTodayIST();

  db.query("SELECT * FROM daily_attempts WHERE user_id = ? AND date = ?", [userId, today], (err, result) => {
    if (err) {
      return res.status(500).json({ message: "DB error" });
    }

    res.json({ attempted: result.length > 0 });
  });
});

// Submit Daily Question
router.post("/submit-daily", requireLogin, (req, res) => {
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

module.exports = router;
