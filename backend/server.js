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

const SKILL_NAMES = [
  "Overall","Attack","Defence","Strength","Hitpoints","Ranged","Prayer","Magic","Cooking",
  "Woodcutting","Fletching","Fishing","Firemaking","Crafting","Smithing","Mining","Herblore",
  "Agility","Thieving","Slayer","Farming","Runecrafting","Hunter","Construction","Sailing"
];

const BOSS_NAMES = [
  "Grid Points","League Points","Deadman Points",
  "Bounty Hunter - Hunter","Bounty Hunter - Rogue",
  "Bounty Hunter (Legacy) - Hunter","Bounty Hunter (Legacy) - Rogue",
  "Clue Scrolls (all)","Clue Scrolls (beginner)","Clue Scrolls (easy)",
  "Clue Scrolls (medium)","Clue Scrolls (hard)","Clue Scrolls (elite)",
  "Clue Scrolls (master)","LMS - Rank","PvP Arena - Rank",
  "Soul Wars Zeal","Rifts closed","Colosseum Glory","Collections Logged",
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

// ─── Hiscore fetching & parsing ───────────────────────────────────────────────

function parseHiscores(json) {
  const skills = {};
  SKILL_NAMES.forEach((name, i) => {
    const entry = json.skills?.[i] ?? json.skills?.[String(i)];
    skills[name] = {
      rank:  entry?.rank  ?? -1,
      level: entry?.level ?? 0,
      xp:    entry?.xp    ?? 0,
    };
  });

  const bosses = {};
  BOSS_NAMES.forEach((name, i) => {
    const entry = json.bosses?.[i] ?? json.bosses?.[String(i)];
    bosses[name] = {
      rank:  entry?.rank  ?? -1,
      kills: entry?.kills ?? entry?.score ?? 0,
    };
  });

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