require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const FIVE_MINUTES = 5 * 60 * 1000;

app.get("/", (req, res) => {
  res.send("RuneHelp backend running");
});

async function getPlayerId(username) {

  const result = await pool.query(
    `INSERT INTO players(username)
     VALUES($1)
     ON CONFLICT(username)
     DO UPDATE SET username = EXCLUDED.username
     RETURNING id`,
    [username]
  );

  return result.rows[0].id;
}

async function getLatestSnapshot(playerId) {

  const result = await pool.query(
    `SELECT id, data, created_at
     FROM snapshots
     WHERE player_id=$1
     ORDER BY created_at DESC
     LIMIT 1`,
    [playerId]
  );

  return result.rows[0] || null;
}

async function insertSnapshot(playerId, data) {

  const result = await pool.query(
    `INSERT INTO snapshots(player_id, data)
     VALUES($1,$2)
     RETURNING id`,
    [playerId, data]
  );

  return result.rows[0].id;
}

function computeDiffs(current, previous) {

  const skills = {};
  const bosses = {};

  const prevSkills = previous?.skills || [];
  const prevActs = previous?.activities || [];

  current.skills.forEach((s, i) => {

    const prev = prevSkills[i] || {};

    skills[i] = {
      level: s.level,
      xp: s.xp,
      xpDiff: s.xp - (prev.xp || 0)
    };

  });

  current.activities.forEach((a, i) => {

    const prev = prevActs[i] || {};

    bosses[a.name] = {
      rank: a.rank,
      kills: a.score,
      killsDiff: a.score - (prev.score || 0)
    };

  });

  return { skills, bosses };
}

app.get("/api/player/:username", async (req, res) => {

  try {

    const username = req.params.username.trim();

    const playerId = await getPlayerId(username);

    const latest = await getLatestSnapshot(playerId);

    if (latest && (Date.now() - new Date(latest.created_at)) < FIVE_MINUTES) {

      const prev = await pool.query(
        `SELECT data
         FROM snapshots
         WHERE player_id=$1 AND id < $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [playerId, latest.id]
      );

      const previousData = prev.rows[0]?.data;

      const diffs = computeDiffs(latest.data, previousData);

      return res.json({
        username,
        ...diffs,
        cached: true
      });
    }

    const response = await fetch(
      `https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=${encodeURIComponent(username)}`
    );

    if (!response.ok)
      return res.status(404).json({ error: "Player not found" });

    const data = await response.json();

    const snapshotId = await insertSnapshot(playerId, data);

    const prev = await pool.query(
      `SELECT data
       FROM snapshots
       WHERE player_id=$1 AND id < $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [playerId, snapshotId]
    );

    const previousData = prev.rows[0]?.data;

    const diffs = computeDiffs(data, previousData);

    res.json({
      username,
      ...diffs,
      cached: false
    });

  } catch (err) {

    console.error(err);
    res.status(500).json({ error: "Server error" });

  }

});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});