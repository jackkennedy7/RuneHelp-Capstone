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

async function loadSnapshot(snapshotId) {

  const skillsResult = await pool.query(
    "SELECT skill_name, level, xp FROM skills WHERE snapshot_id=$1",
    [snapshotId]
  );

  const bossesResult = await pool.query(
    "SELECT boss_name, kills, rank FROM bosskills WHERE snapshot_id=$1",
    [snapshotId]
  );

  const skills = {};
  skillsResult.rows.forEach(row => {
    skills[row.skill_name] = {
      level: row.level,
      xp: row.xp
    };
  });

  const bosses = {};
  bossesResult.rows.forEach(row => {
    bosses[row.boss_name] = {
      kills: row.kills,
      rank: row.rank
    };
  });

  return { skills, bosses };
}

function computeDiffs(current, previous, numericField) {

  const result = {};

  for (const [name, cur] of Object.entries(current)) {

    const prev = previous[name] || {};

    const base = Number(cur[numericField] ?? 0);
    const prevValue = Number(prev[numericField] ?? 0);

    result[name] = {
      ...cur,
      [`${numericField}Diff`]: base - prevValue
    };
  }

  return result;
}

async function insertSnapshot(playerId, skills, bosses) {

  const snapshotResult = await pool.query(
    "INSERT INTO snapshots(player_id) VALUES($1) RETURNING id",
    [playerId]
  );

  const snapshotId = snapshotResult.rows[0].id;

  const skillPromises = Object.entries(skills).map(([name, skill]) =>
    pool.query(
      "INSERT INTO skills(snapshot_id, skill_name, level, xp) VALUES($1,$2,$3,$4)",
      [snapshotId, name, skill.level, skill.xp]
    )
  );

  const bossPromises = Object.entries(bosses).map(([name, boss]) =>
    pool.query(
      "INSERT INTO bosskills(snapshot_id, boss_name, kills, rank) VALUES($1,$2,$3,$4)",
      [snapshotId, name, boss.kills, boss.rank]
    )
  );

  await Promise.all([...skillPromises, ...bossPromises]);

  return snapshotId;
}

app.get("/api/player/:username", async (req, res) => {

  try {

    const username = req.params.username.trim();

    const playerResult = await pool.query(
      `INSERT INTO players(username)
       VALUES($1)
       ON CONFLICT(username) DO UPDATE SET username=EXCLUDED.username
       RETURNING id`,
      [username]
    );

    const playerId = playerResult.rows[0].id;

    // Latest snapshot
    const latestSnapshotResult = await pool.query(
      `SELECT id, created_at
       FROM snapshots
       WHERE player_id=$1
       ORDER BY created_at DESC
       LIMIT 1`,
      [playerId]
    );

    const latestSnapshot = latestSnapshotResult.rows[0] || null;

    const FIVE_MINUTES = 5 * 60 * 1000;

    // Cache path
    if (latestSnapshot &&
        (Date.now() - new Date(latestSnapshot.created_at)) < FIVE_MINUTES) {

      const snapshotData = await loadSnapshot(latestSnapshot.id);

      const prevSnapshotResult = await pool.query(
        `SELECT id FROM snapshots
         WHERE player_id=$1 AND id < $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [playerId, latestSnapshot.id]
      );

      const prevId = prevSnapshotResult.rows[0]?.id;

      let prevData = { skills: {}, bosses: {} };

      if (prevId) {
        prevData = await loadSnapshot(prevId);
      }

      const skills = computeDiffs(
        snapshotData.skills,
        prevData.skills,
        "xp"
      );

      const bosses = computeDiffs(
        snapshotData.bosses,
        prevData.bosses,
        "kills"
      );

      return res.json({
        username,
        skills,
        bosses,
        cached: true
      });
    }

    // Fetch live hiscores
    const response = await fetch(
      `https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=${encodeURIComponent(username)}`
    );

    if (!response.ok)
      return res.status(404).json({ error: "Player not found" });

    const data = await response.json();

    const skillNames = [
      "Overall","Attack","Defence","Strength","Hitpoints","Ranged","Prayer","Magic","Cooking",
      "Woodcutting","Fletching","Fishing","Firemaking","Crafting","Smithing","Mining","Herblore",
      "Agility","Thieving","Slayer","Farming","Runecrafting","Hunter","Construction"
    ];

    const skills = {};
    data.skills.forEach((s, i) => {
      skills[skillNames[i]] = {
        level: s.level ?? 0,
        xp: s.xp ?? 0
      };
    });

    const bossNames = [
      "Abyssal Sire","Alchemical Hydra","Barrows Chests","Bryophyta","Callisto",
      "Cerberus","Chambers of Xeric","Chambers of Xeric Challenge Mode","Chaos Elemental","Chaos Fanatic",
      "Commander Zilyana","Corporeal Beast","Crazy Archaeologist"
    ];

    const bosses = {};
    const activitiesMap = Object.fromEntries(
      (data.activities || []).map(a => [a.name, a])
    );

    bossNames.forEach(name => {
      const activity = activitiesMap[name] || { rank: -1, score: 0 };

      bosses[name] = {
        rank: activity.rank ?? -1,
        kills: activity.score ?? 0
      };
    });

    const snapshotId = await insertSnapshot(playerId, skills, bosses);

    const snapshotData = await loadSnapshot(snapshotId);

    res.json({
      username,
      skills: snapshotData.skills,
      bosses: snapshotData.bosses,
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