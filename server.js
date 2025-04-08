const express = require("express");
const mysql = require("mysql2");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");

dotenv.config();
const app = express();
const PORT = 3000;

app.use(cors());

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, "public")));

// 👉 Route for home page (index.html)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

// 👉 API to get a random question
app.get("/api/question", (req, res) => {
  const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  db.query("SELECT * FROM trivia_questions ORDER BY RAND() LIMIT 1", (err, result) => {
    if (err) {
      console.error("Query error:", err);
      res.status(500).send("Error fetching question");
    } else {
      res.json(result[0]);
    }
  });

  db.end();
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
