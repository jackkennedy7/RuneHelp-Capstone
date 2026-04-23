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
 
const ACTIVITY_NAMES = [
  "Grid Points", "League Points", "Deadman Points",
  "Bounty Hunter - Hunter", "Bounty Hunter - Rogue",
  "Bounty Hunter (Legacy) - Hunter", "Bounty Hunter (Legacy) - Rogue",
  "Clue Scrolls (all)", "Clue Scrolls (beginner)", "Clue Scrolls (easy)",
  "Clue Scrolls (medium)", "Clue Scrolls (hard)", "Clue Scrolls (elite)",
  "Clue Scrolls (master)", "LMS - Rank", "PvP Arena - Rank",
  "Soul Wars Zeal", "Rifts closed", "Colosseum Glory", "Collections Logged"
];
 
const SKILL_NAMES = [
  "Overall","Attack","Defence","Strength","Hitpoints","Ranged","Prayer","Magic","Cooking",
  "Woodcutting","Fletching","Fishing","Firemaking","Crafting","Smithing","Mining","Herblore",
  "Agility","Thieving","Slayer","Farming","Runecrafting","Hunter","Construction","Sailing"
];
 
const BOSS_NAMES = [
  "Abyssal Sire","Alchemical Hydra","Amoxliatl","Araxxor","Artio",
  "Barrows Chests","Brutus","Bryophyta","Callisto","Calvar'ion",
  "Cerberus","Chambers of Xeric","Chambers of Xeric: Challenge Mode",
  "Chaos Elemental","Chaos Fanatic","Commander Zilyana","Corporeal Beast",
  "Crazy Archaeologist","Dagannoth Prime","Dagannoth Rex","Dagannoth Supreme",
  "Deranged Archaeologist","Doom of Mokhaiotl","Duke Sucellus","General Graardor",
  "Giant Mole","Grotesque Guardians","Hespori","Kalphite Queen","King Black Dragon",
  "Kraken","Kree'Arra","K'ril Tsutsaroth","Lunar Chests","Mimic","Nex",
  "Nightmare","Phosani's Nightmare","Obor","Phantom Muspah","Sarachnis","Scorpia",
  "Scurrius","Shellbane Gryphon","Skotizo","Sol Heredit","Spindel","Tempoross",
  "The Gauntlet","The Corrupted Gauntlet","The Hueycoatl","The Leviathan",
  "The Royal Titans","The Whisperer","Theatre of Blood","Theatre of Blood: Hard Mode",
  "Thermonuclear Smoke Devil","Tombs of Amascut","Tombs of Amascut: Expert Mode",
  "TzKal-Zuk","TzTok-Jad","Vardorvis","Venenatis","Vet'ion","Vorkath",
  "Wintertodt","Yama","Zalcano","Zulrah"
];
 
// ─── Time frame helpers ───────────────────────────────────────────────────────
 
// Maps a named time frame to how many minutes back to look for a baseline snapshot.
// For "custom", the caller supplies an explicit cutoff timestamp instead.
const TIMEFRAME_MINUTES = {
  hour:  60,
  day:   60 * 24,
  week:  60 * 24 * 7,
};
 
/**
 * Returns the cutoff Date for a given time frame string.
 * For "custom", the caller must supply `customFrom` (ISO string or ms timestamp).
 */
function getCutoff(timeframe, customFrom) {
  if (timeframe === "custom") {
    if (!customFrom) throw new Error("customFrom is required for custom timeframe");
    return new Date(customFrom);
  }
  const minutes = TIMEFRAME_MINUTES[timeframe];
  if (!minutes) throw new Error(`Unknown timeframe: ${timeframe}`);
  return new Date(Date.now() - minutes * 60 * 1000);
}
 
// ─── Hiscore fetching & parsing ───────────────────────────────────────────────
 
async function fetchHiscores(username) {
  const url = `https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=${encodeURIComponent(username)}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  return response.json();
}
 
function parseHiscores(json) {
  const skills = {};
  const bosses = {};
  const activities = {};
 
  SKILL_NAMES.forEach((name, i) => {
    const entry = json.skills?.[i];
    skills[name] = {
      rank: entry?.rank ?? -1,
      level: entry?.level ?? 0,
      xp: entry?.xp ?? 0,
    };
  });
 
  ACTIVITY_NAMES.forEach((name, i) => {
    const entry = json.activities?.[i];
    activities[name] = {
      rank: entry?.rank ?? -1,
      score: entry?.score ?? 0,
    };
  });
 
  BOSS_NAMES.forEach((name, i) => {
    const entry = json.activities?.[ACTIVITY_NAMES.length + i];
    bosses[name] = {
      rank: entry?.rank ?? -1,
      kills: entry?.score ?? 0,
    };
  });
 
  return { skills, bosses, activities };
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
 
/**
 * Returns the most recent snapshot that is at or before `cutoff`.
 * This becomes the "baseline" for the requested time frame.
 */
async function getSnapshotAtOrBefore(playerId, cutoff) {
  const result = await pool.query(
    `SELECT id, data, created_at FROM snapshots
     WHERE player_id = $1 AND created_at <= $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [playerId, cutoff]
  );
  return result.rows[0] ?? null;
}
 
/**
 * Returns the most recent snapshot regardless of time (used as current/cache).
 */
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
 
/**
 * Inserts a new snapshot row. Snapshots are append-only — we never overwrite,
 * so every time frame can find its own baseline by timestamp.
 */
async function insertSnapshot(playerId, skills, bosses, activities) {
  await pool.query(
    `INSERT INTO snapshots (player_id, data) VALUES ($1, $2)`,
    [playerId, JSON.stringify({ skills, bosses, activities })]
  );
}
 
/**
 * Checks if the most recent snapshot is younger than `maxAgeMinutes`.
 * Used to avoid hammering the hiscores API on every request.
 */
async function isCacheFresh(playerId, maxAgeMinutes = 5) {
  const latest = await getLatestSnapshot(playerId);
  if (!latest) return false;
  const ageMinutes = (Date.now() - new Date(latest.created_at)) / (1000 * 60);
  return ageMinutes < maxAgeMinutes;
}
 
// ─── Delta computation ────────────────────────────────────────────────────────
 
function computeDeltas(current, prevData) {
  const prevSkills     = prevData?.skills     ?? {};
  const prevBosses     = prevData?.bosses     ?? {};
  const prevActivities = prevData?.activities ?? {};
 
  const skillsWithDiffs     = {};
  const bossesWithDiffs     = {};
  const activitiesWithDiffs = {};
 
  let hasChanges = false;
 
  for (const [name, skill] of Object.entries(current.skills)) {
    const prev      = prevSkills[name] ?? { level: 0, xp: 0 };
    const levelDiff = skill.level - prev.level;
    const xpDiff    = skill.xp    - prev.xp;
    skillsWithDiffs[name] = { ...skill, levelDiff, xpDiff };
    if (levelDiff !== 0 || xpDiff !== 0) hasChanges = true;
  }
 
  for (const [name, boss] of Object.entries(current.bosses)) {
    const prev      = prevBosses[name] ?? { kills: 0 };
    const killsDiff = boss.kills - prev.kills;
    bossesWithDiffs[name] = { ...boss, killsDiff };
    if (killsDiff !== 0) hasChanges = true;
  }
 
  for (const [name, activity] of Object.entries(current.activities)) {
    const prev      = prevActivities[name] ?? { score: 0 };
    const scoreDiff = activity.score - prev.score;
    activitiesWithDiffs[name] = { ...activity, scoreDiff };
    if (scoreDiff !== 0) hasChanges = true;
  }
 
  return { skillsWithDiffs, bossesWithDiffs, activitiesWithDiffs, hasChanges };
}
 
function zeroDiffs(current) {
  return {
    skills:     Object.fromEntries(Object.entries(current.skills)    .map(([n, s]) => [n, { ...s, xpDiff: 0, levelDiff: 0 }])),
    bosses:     Object.fromEntries(Object.entries(current.bosses)    .map(([n, b]) => [n, { ...b, killsDiff: 0 }])),
    activities: Object.fromEntries(Object.entries(current.activities).map(([n, a]) => [n, { ...a, scoreDiff: 0 }])),
  };
}
 
// ─── Routes ───────────────────────────────────────────────────────────────────
 
app.get("/", (req, res) => res.send("RuneHelp backend is running"));
 
/**
 * GET /api/player/:username
 *
 * Query params:
 *   timeframe  — "hour" | "day" | "week" | "custom"  (default: "day")
 *   customFrom — ISO timestamp or ms epoch, required when timeframe=custom
 */
app.get("/api/player/:username", async (req, res) => {
  const username  = req.params.username.trim();
  const timeframe = req.query.timeframe ?? "day";
  const customFrom = req.query.customFrom ?? null;
 
  let cutoff;
  try {
    cutoff = getCutoff(timeframe, customFrom);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
 
  try {
    const playerId = await getOrCreatePlayer(username);
 
 let currentData;
let fetchedFresh = false;

// ALWAYS get latest snapshot first
let latest = await getLatestSnapshot(playerId);

const fresh = latest && (Date.now() - new Date(latest.created_at)) < 5 * 60 * 1000;

if (fresh) {
  currentData = typeof latest.data === "string"
    ? JSON.parse(latest.data)
    : latest.data;
  } else {
    const hiscoreJson = await fetchHiscores(username);
    if (!hiscoreJson) return res.status(404).json({ error: "Player not found" });

      currentData = parseHiscores(hiscoreJson);

      await insertSnapshot(playerId, currentData.skills, currentData.bosses, currentData.activities);
      fetchedFresh = true;

      // refresh latest after insert
      latest = await getLatestSnapshot(playerId);
    }
 
    // ── Find the baseline for the requested time frame ────────────────────────
    // Look for the oldest snapshot that falls at or before the cutoff.
  const baselineResult = await pool.query(
  `SELECT id, data, created_at FROM snapshots
   WHERE player_id = $1
   AND created_at < $2
   ORDER BY created_at DESC
   LIMIT 1`,
  [playerId, latest.created_at]
);

const baselineSnapshot = baselineResult.rows[0] ?? null;

const baselineData = baselineSnapshot
  ? (typeof baselineSnapshot.data === "string"
      ? JSON.parse(baselineSnapshot.data)
      : baselineSnapshot.data)
  : null;
    if (!baselineSnapshot) {
      // No snapshot exists for this window yet — diffs are all zero
      return res.json({
        username,
        timeframe,
        ...zeroDiffs(currentData),
        cached: !fetchedFresh,
        note: "No data found for the selected time frame. Gains will appear as stats are recorded.",
      });
    }
 
    // ── Compute and return deltas ─────────────────────────────────────────────
    const { skillsWithDiffs, bossesWithDiffs, activitiesWithDiffs } =
      computeDeltas(currentData, baselineData);
 
    return res.json({
      username,
      timeframe,
      skills:     skillsWithDiffs,
      bosses:     bossesWithDiffs,
      activities: activitiesWithDiffs,
      cached:     !fetchedFresh,
      baselineAt: baselineSnapshot.created_at,
    });
 
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});
 
app.post("/api/chat", async (req, res) => {
  const { system, messages } = req.body;
 
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OR_API_KEY}`
    },
    body: JSON.stringify({
      model: "nvidia/nemotron-3-super-120b-a12b:free",
      messages: [
        { role: "system", content: system },
        ...messages.map(m => ({ role: m.role === "bot" ? "assistant" : m.role, content: m.content }))
      ],
      max_tokens: 300,
      temperature: 0.7
    })
  });
 
  if (!response.ok) {
    const err = await response.text();
    return res.status(500).json({ error: err });
  }
 
  const data = await response.json();
  res.json(data);
});
 
// ─── Start ────────────────────────────────────────────────────────────────────
 
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));