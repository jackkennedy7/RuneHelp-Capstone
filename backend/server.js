require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

app.use(express.json());
app.use(cors());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ─── Domain constants ─────────────────────────────────────────────────────────

const ACTIVITY_NAMES = new Set([
  "Grid Points", "League Points", "Deadman Points",
  "Bounty Hunter - Hunter", "Bounty Hunter - Rogue",
  "Bounty Hunter (Legacy) - Hunter", "Bounty Hunter (Legacy) - Rogue",
  "Clue Scrolls (all)", "Clue Scrolls (beginner)", "Clue Scrolls (easy)",
  "Clue Scrolls (medium)", "Clue Scrolls (hard)", "Clue Scrolls (elite)",
  "Clue Scrolls (master)", "LMS - Rank", "PvP Arena - Rank",
  "Soul Wars Zeal", "Rifts closed", "Colosseum Glory", "Collections Logged"
]);

// ─── Hiscore fetching & parsing ───────────────────────────────────────────────

async function fetchHiscores(username) {
  const url = `https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=${encodeURIComponent(username)}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  return response.json();
}

function parseHiscores(json) {
  const skills = {};
  for (const [name, data] of Object.entries(json.skills ?? {})) {
    skills[name] = {
      rank:  data.rank  ?? -1,
      level: data.level ?? 0,
      xp:    data.xp    ?? 0,
    };
  }

  const bosses = {};
  for (const [name, data] of Object.entries(json.activities ?? {})) {
    bosses[name] = {
      rank:  data.rank  ?? -1,
      kills: data.score ?? 0,
    };
  }

  return { skills, bosses };
}

// ─── Database helpers ─────────────────────────────────────────────────────────

async function getOrCreatePlayer(username) {
  const result = await pool.query(
    `INSERT INTO players (username) VALUES ($1)
     ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
     RETURNING id`,
    [username]
  );
  return result.rows[0].id;
}

async function getLatestSnapshot(playerId) {
  const result = await pool.query(
    `SELECT id, data, created_at FROM snapshots
     WHERE player_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [playerId]
  );
  return result.rows[0] ?? null;
}

async function insertSnapshot(playerId, skills, bosses) {
  await pool.query(
    `INSERT INTO snapshots (player_id, data) VALUES ($1, $2)`,
    [playerId, JSON.stringify({ skills, bosses })]
  );
}

// ─── Delta computation ────────────────────────────────────────────────────────

function computeDeltas(current, prevData) {
  const prevSkills = prevData?.skills ?? {};
  const prevBosses = prevData?.bosses ?? {};

  const skillsWithDiffs = {};
  const bossesWithDiffs = {};
  let hasChanges = false;

  for (const [name, skill] of Object.entries(current.skills)) {
    const prev = prevSkills[name] ?? { level: 0, xp: 0 };
    const levelDiff = skill.level - prev.level;
    const xpDiff    = skill.xp    - prev.xp;
    skillsWithDiffs[name] = { ...skill, levelDiff, xpDiff };
    if (levelDiff !== 0 || xpDiff !== 0) hasChanges = true;
  }

  for (const [name, boss] of Object.entries(current.bosses)) {
    const prev = prevBosses[name] ?? { kills: 0 };
    const killsDiff = boss.kills - prev.kills;
    bossesWithDiffs[name] = { ...boss, killsDiff };
    if (killsDiff !== 0) hasChanges = true;
  }

  return { skillsWithDiffs, bossesWithDiffs, hasChanges };
}

// ─── Response shaping ─────────────────────────────────────────────────────────

function shapeResponse(username, skills, bosses, cached) {
  const bossesOnly     = {};
  const activitiesOnly = {};

  for (const [name, data] of Object.entries(bosses)) {
    if (ACTIVITY_NAMES.has(name)) {
      activitiesOnly[name] = data;
    } else {
      bossesOnly[name] = data;
    }
  }

  return { username, skills, bosses: bossesOnly, activities: activitiesOnly, cached };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/", (req, res) => res.send("RuneHelp backend is running"));

app.get("/api/player/:username", async (req, res) => {
  const username = req.params.username.trim();

  try {
    const playerId       = await getOrCreatePlayer(username);
    const latestSnapshot = await getLatestSnapshot(playerId);

    // Return cached snapshot if fresh (< 5 minutes old)
    if (latestSnapshot) {
      const ageMinutes = (Date.now() - new Date(latestSnapshot.created_at)) / (1000 * 60);
      if (ageMinutes < 5) {
        const { skills, bosses } = latestSnapshot.data;
        const zeroDiffSkills = Object.fromEntries(
          Object.entries(skills).map(([n, s]) => [n, { ...s, levelDiff: 0, xpDiff: 0 }])
        );
        const zeroDiffBosses = Object.fromEntries(
          Object.entries(bosses).map(([n, b]) => [n, { ...b, killsDiff: 0 }])
        );
        return res.json(shapeResponse(username, zeroDiffSkills, zeroDiffBosses, true));
      }
    }

    // Fetch fresh data
    const hiscoreJson = await fetchHiscores(username);
    if (!hiscoreJson) return res.status(404).json({ error: "Player not found" });

    const current = parseHiscores(hiscoreJson);
    const { skillsWithDiffs, bossesWithDiffs, hasChanges } = computeDeltas(current, latestSnapshot?.data ?? null);

    // Skip writing a new snapshot if nothing changed
    if (!hasChanges && latestSnapshot) {
      return res.json(shapeResponse(username, skillsWithDiffs, bossesWithDiffs, true));
    }

    await insertSnapshot(playerId, current.skills, current.bosses);

    return res.json({
      ...shapeResponse(username, skillsWithDiffs, bossesWithDiffs, false),
      hasPreviousSnapshot: !!latestSnapshot,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));