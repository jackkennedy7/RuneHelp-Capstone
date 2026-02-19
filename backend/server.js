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

async function returnSnapshot(res, username, snapshotId) {
  // Load skills
  const skillsResult = await pool.query(
    "SELECT skill_name, level, xp FROM skills WHERE snapshot_id = $1",
    [snapshotId]
  );

  const skills = {};
  skillsResult.rows.forEach(row => {
    skills[row.skill_name] = {
      level: row.level,
      xp: row.xp,
      levelDiff: 0,
      xpDiff: 0
    };
  });

  // Load bosses
  const bossesResult = await pool.query(
    "SELECT bossname, kills, rank FROM bosskills WHERE snapshot_id = $1",
    [snapshotId]
  );

  const bosses = {};
  bossesResult.rows.forEach(row => {
    bosses[row.boss_name] = {
      kills: row.kills,
      rank: row.rank,
      killsDiff: 0
    };
  });

  return res.json({
    username,
    skills,
    bosses,
    cached: true
  });
}

app.get("/api/player/:username", async (req, res) => {
  const username = req.params.username.trim();

  try {
    // Ensure player exists
    const playerResult = await pool.query(
      "INSERT INTO players (username) VALUES ($1) ON CONFLICT (username) DO UPDATE SET username=EXCLUDED.username RETURNING id",
      [username]
    );
    const playerId = playerResult.rows[0].id;

    // Check latest snapshot for caching
    const latestSnapshotResult = await pool.query(
      `
      SELECT id, created_at
      FROM snapshots
      WHERE player_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [playerId]
    );

    const latestSnapshot = latestSnapshotResult.rows[0] || null;

    if (latestSnapshot) {
      const diffMinutes = (Date.now() - new Date(latestSnapshot.created_at)) / (1000 * 60);
      if (diffMinutes < 5) {
        return await returnSnapshot(res, username, latestSnapshot.id);
      }
    }

    // Fetch OSRS Lite hiscores
    const response = await fetch(
      `https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=${encodeURIComponent(username)}`
    );
    if (!response.ok) return res.status(404).json({ error: "Player not found" });

    const text = await response.text();
    const lines = text.split("\n").map(line => line.trim());

    if (!lines.length) return res.status(404).json({ error: "Player not found" });

    // --- Skill mapping ---
    const skillNames = [
      "Overall","Attack","Defence","Strength","Hitpoints","Ranged","Prayer","Magic","Cooking",
      "Woodcutting","Fletching","Fishing","Firemaking","Crafting","Smithing","Mining","Herblore",
      "Agility","Thieving","Slayer","Farming","Runecrafting","Hunter","Construction"
    ];

    const skills = {};
      for (let i = 0; i < skillNames.length; i++) {
        const line = lines[i] || "0,0,0,0";  // default values
        const parts = line.split(",");
        skills[skillNames[i]] = {
          rank: Number(parts[0]) || 0,
          level: Number(parts[2]) || 0,
          xp: Number(parts[3]) || 0
        };
    }

    // --- Boss mapping ---
    const bossNames = [
      "Abyssal Sire","Alchemical Hydra","Barrows Chests","Bryophyta","Callisto",
      "Cerberus","Chambers of Xeric","Chambers of Xeric Challenge Mode","Chaos Elemental","Chaos Fanatic",
      "Commander Zilyana","Corporeal Beast","Crazy Archaeologist","Dagannoth Prime","Dagannoth Rex",
      "Dagannoth Supreme","Deranged Archaeologist","General Graardor","Giant Mole","Grotesque Guardians",
      "Hespori","Kalphite King","King Black Dragon","Kraken","Kree'Arra","K'ril Tsutsaroth",
      "Mimic","Nightmare","Obor","Phosani's Nightmare","Sarachnis","Scorpia","Skotizo","The Gauntlet",
      "The Corrupted Gauntlet","Theatre of Blood","Theatre of Blood Hard Mode","Thermonuclear Smoke Devil",
      "TzKal-Zuk","TzTok-Jad","Venenatis","Vet'ion","Vorkath","Wintertodt","Zalcano","Zulrah"
    ];

    const bossStartLine = skillNames.length;
    const bosses = {};
    for (let i = 0; i < bossNames.length; i++) {
      const line = lines[bossStartLine + i] || "";
      const parts = line.split(",");
      bosses[bossNames[i]] = {
        rank: Number(parts[0]) || 0,
        kills: Number(parts[1]) || 0
      };
    }

    // --- Load previous snapshot ---
    let prevSkills = {};
    let prevBosses = {};
    if (latestSnapshot) {
      const prevSkillsResult = await pool.query(
        "SELECT skill_name, level, xp FROM skills WHERE snapshot_id = $1",
        [latestSnapshot.id]
      );
      prevSkillsResult.rows.forEach(row => {
        prevSkills[row.skill_name] = { level: row.level, xp: row.xp };
      });

      const prevBossResult = await pool.query(
        "SELECT bossname, kills FROM bosskills WHERE snapshot_id = $1",
        [latestSnapshot.id]
      );
      prevBossResult.rows.forEach(row => {
        prevBosses[row.boss_name] = row.kills;
      });
    }

    // --- Compute deltas ---
    const skillsWithDiffs = {};
    let hasChanges = false;

    for (const [name, skill] of Object.entries(skills)) {
      const prev = prevSkills[name] || { level: 0, xp: 0 };
      const levelDiff = skill.level - prev.level;
      const xpDiff = skill.xp - prev.xp;
      skillsWithDiffs[name] = { ...skill, levelDiff, xpDiff };
      if (levelDiff !== 0 || xpDiff !== 0) hasChanges = true;
    }

    const bossesWithDiffs = {};
    for (const [name, boss] of Object.entries(bosses)) {
      const prevKills = prevBosses[name] || 0;
      const killsDiff = boss.kills - prevKills;
      bossesWithDiffs[name] = { ...boss, killsDiff };
      if (killsDiff !== 0) hasChanges = true;
    }

    // --- Skip snapshot if nothing changed ---
    if (!hasChanges && latestSnapshot) {
      return await returnSnapshot(res, username, latestSnapshot.id);
    }

    // --- Insert snapshot ---
    const snapshotResult = await pool.query(
      "INSERT INTO snapshots (player_id) VALUES ($1) RETURNING id",
      [playerId]
    );
    const snapshotId = snapshotResult.rows[0].id;

    // --- Insert skills ---
    const skillPromises = Object.entries(skills).map(([name, skill]) =>
      pool.query(
        "INSERT INTO skills (snapshot_id, skill_name, level, xp) VALUES ($1, $2, $3, $4)",
        [snapshotId, name, skill.level, skill.xp]
      )
    );
    await Promise.all(skillPromises);

    // --- Insert bosses ---
    const bossPromises = Object.entries(bosses).map(([name, boss]) =>
      pool.query(
        "INSERT INTO bosskills (snapshot_id, boss_name, kills, rank) VALUES ($1, $2, $3, $4)",
        [snapshotId, name, boss.kills, boss.rank]
      )
    );
    await Promise.all(bossPromises);

    // --- Return response ---
    res.json({
      username,
      skills: skillsWithDiffs,
      bosses: bossesWithDiffs,
      hasPreviousSnapshot: !!latestSnapshot,
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