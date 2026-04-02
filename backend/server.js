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

  // Activities are indices 0–19
  ACTIVITY_NAMES.forEach((name, i) => {
    const entry = json.activities?.[i];
    activities[name] = {
      rank: entry?.rank ?? -1,
      score: entry?.score ?? 0,
    };
  });

  // Bosses are indices 20+ in the same activities array
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

async function insertSnapshot(playerId, skills, bosses, activities) {
  await pool.query(
    `INSERT INTO snapshots (player_id, data) VALUES ($1, $2)`,
    [playerId, JSON.stringify({ skills, bosses, activities })]
  );
}

// ─── Delta computation ────────────────────────────────────────────────────────

function computeDeltas(current, prevData) {
  const prevSkills = prevData?.skills ?? {};
  const prevBosses = prevData?.bosses ?? {};
  const prevActivities = prevData?.activities ?? {};

  const skillsWithDiffs = {};
  const bossesWithDiffs = {};
  const activitiesWithDiffs = {};

  let hasChanges = false;

  for (const [name, skill] of Object.entries(current.skills)) {
    const prev = prevSkills[name] ?? { level: 0, xp: 0 };
    const levelDiff = skill.level - prev.level;
    const xpDiff = skill.xp - prev.xp;

    skillsWithDiffs[name] = { ...skill, levelDiff, xpDiff };
    if (levelDiff !== 0 || xpDiff !== 0) hasChanges = true;
  }

  for (const [name, boss] of Object.entries(current.bosses)) {
    const prev = prevBosses[name] ?? { kills: 0 };
    const killsDiff = boss.kills - prev.kills;

    bossesWithDiffs[name] = { ...boss, killsDiff };
    if (killsDiff !== 0) hasChanges = true;
  }

  for (const [name, activity] of Object.entries(current.activities)) {
    const prev = prevActivities[name] ?? { score: 0 };
    const scoreDiff = activity.score - prev.score;
    activitiesWithDiffs[name] = { ...activity, scoreDiff };
    if (scoreDiff !== 0) hasChanges = true;
  }

  return { skillsWithDiffs, bossesWithDiffs, activitiesWithDiffs, hasChanges };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/", (req, res) => res.send("RuneHelp backend is running"));

app.get("/api/player/:username", async (req, res) => {
  const username = req.params.username.trim();

  try {
    const playerId = await getOrCreatePlayer(username);
    const latestSnapshot = await getLatestSnapshot(playerId);

    if (latestSnapshot) {
      const ageMinutes = (Date.now() - new Date(latestSnapshot.created_at)) / (1000 * 60);

      if (ageMinutes < 5) {
        const { skills, bosses, activities } = latestSnapshot.data;

        const zeroSkills = Object.fromEntries(
          Object.entries(skills).map(([n, s]) => [n, { ...s, levelDiff: 0, xpDiff: 0 }])
        );

        const zeroBosses = Object.fromEntries(
          Object.entries(bosses).map(([n, b]) => [n, { ...b, killsDiff: 0 }])
        );

        const zeroActivities = Object.fromEntries(
          Object.entries(activities).map(([n, a]) => [n, { ...a, scoreDiff: 0 }])
        );

        return res.json({
          username,
          skills: zeroSkills,
          bosses: zeroBosses,
          activities: zeroActivities,
          cached: true,
        });
      }
    }

    const hiscoreJson = await fetchHiscores(username);
    if (!hiscoreJson) return res.status(404).json({ error: "Player not found" });

    const current = parseHiscores(hiscoreJson);

    const {
      skillsWithDiffs,
      bossesWithDiffs,
      activitiesWithDiffs,
      hasChanges
    } = computeDeltas(current, latestSnapshot?.data ?? null);

    if (!hasChanges && latestSnapshot) {
      return res.json({
        username,
        skills: skillsWithDiffs,
        bosses: bossesWithDiffs,
        activities: activitiesWithDiffs,
        cached: true,
      });
    }

    await insertSnapshot(playerId, current.skills, current.bosses, current.activities);

    return res.json({
      username,
      skills: skillsWithDiffs,
      bosses: bossesWithDiffs,
      activities: activitiesWithDiffs,
      cached: false,
      hasPreviousSnapshot: !!latestSnapshot,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Call Gemini via backend ──────────────────────────────
async function callGemini(userMessage) {
  conversationHistory.push({ role: 'user', content: userMessage });

  const res = await fetch('https://runehelp.onrender.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: buildSystemPrompt(),
      messages: conversationHistory,
    }),
  });

  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  const data = await res.json();
  const reply = data.content[0].text;
  conversationHistory.push({ role: 'assistant', content: reply });
  return reply;
}

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));