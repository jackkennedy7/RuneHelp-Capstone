require("dotenv").config();

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

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

app.get("/api/player/:username",async (req, res) => {
    const username = req.params.username;
try {
    // 1️⃣ Fetch JSON hiscores
    const response = await fetch(`https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=${encodeURIComponent(username)}`);
    if (!response.ok) return res.status(404).json({ error: "Player not found" });

    const data = await response.json(); // already JSON
    // data.skills, data.minigames, etc.

    // 2️⃣ Save to database
    // Insert player if not exists
    const playerResult = await pool.query(
      "INSERT INTO players (username) VALUES ($1) ON CONFLICT (username) DO UPDATE SET username=EXCLUDED.username RETURNING id",
      [username]
    );
    const playerId = playerResult.rows[0].id;

    // Insert snapshot
    const snapshotResult = await pool.query(
      "INSERT INTO snapshots (player_id) VALUES ($1) RETURNING id",
      [playerId]
    );
    const snapshotId = snapshotResult.rows[0].id;

    // Insert skills
    const skillInsertPromises = Object.entries(data.skills).map(([skillName, skill]) =>
      pool.query(
        "INSERT INTO skills (snapshot_id, skill_name, level, xp) VALUES ($1, $2, $3, $4)",
        [snapshotId, skillName, skill.level, skill.xp]
      )
    );
    await Promise.all(skillInsertPromises);

    // 3️⃣ Return JSON to frontend
    res.json({
      username,
      snapshotId,
      skills: data.skills
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});