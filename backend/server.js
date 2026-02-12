require("dotenv").config();

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get("/", (req, res) => {
    res.send("RuneHelp backend is running");
});

app.get("/api/player/:username", (req, res) => {
    const username = req.params.username;

    res.json({
        username: username,
        totalLevel: 2277
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});