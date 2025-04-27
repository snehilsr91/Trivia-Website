const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");
const authRoutes = require("./routes/authRoutes");
const dailyRoutes = require("./routes/dailyRoutes");
const profileRoutes = require("./routes/profileRoutes");
require("./db/connection");

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "your_super_secret_key",
  resave: false,
  saveUninitialized: false,
}));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/api", authRoutes);
app.use("/api", dailyRoutes);
app.use("/api", profileRoutes);

// Serve home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});