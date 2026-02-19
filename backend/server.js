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
    "SELECT boss_name, kills, rank FROM bosskills WHERE snapshot_id = $1",
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
  const username = req.params.username;

  try {
    // Ensure player exists or create
    const playerResult = await pool.query(
      "INSERT INTO players (username) VALUES ($1) ON CONFLICT (username) DO UPDATE SET username=EXCLUDED.username RETURNING id",
      [username]
    );
    const playerId = playerResult.rows[0].id;

    // Get latest snapshot for caching
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

    // 5-minute cache check
    if (latestSnapshot) {
      const diffMinutes =
        (Date.now() - new Date(latestSnapshot.created_at)) / (1000 * 60);
      if (diffMinutes < 5) {
        return await returnSnapshot(res, username, latestSnapshot.id);
      }
    }

    // Fetch full hiscores JSON (skills + bosses)
    const response = await fetch(
      `https://secure.runescape.com/m=hiscore_oldschool/index.json?player=${encodeURIComponent(username)}`
    );

    if (!response.ok)
      return res.status(404).json({ error: "Player not found" });

    const data = await response.json();

    // Make sure arrays exist
    const skills = Array.isArray(data.skills) ? data.skills : [];
    const bosses = Array.isArray(data.bosses) ? data.bosses : [];

    // Load previous snapshot for delta calculations
    let previousSkills = {};
    let previousBosses = {};

    if (latestSnapshot) {
      const prevSkillsResult = await pool.query(
        "SELECT skill_name, level, xp FROM skills WHERE snapshot_id = $1",
        [latestSnapshot.id]
      );
      prevSkillsResult.rows.forEach(row => {
        previousSkills[row.skill_name] = { level: row.level, xp: row.xp };
      });

      const prevBossResult = await pool.query(
        "SELECT boss_name, kills FROM bosskills WHERE snapshot_id = $1",
        [latestSnapshot.id]
      );
      prevBossResult.rows.forEach(row => {
        previousBosses[row.boss_name] = row.kills;
      });
    }

    // Check if anything changed (skip snapshot if nothing changed)
    let hasChanges = false;

    // Skills
    for (const skill of skills) {
      const prev = previousSkills[skill.name] || { level: 0, xp: 0 };
      if ((skill.level ?? 0) !== prev.level || (skill.xp ?? 0) !== prev.xp) {
        hasChanges = true;
        break;
      }
    }

    // Bosses (only check if no skill changes)
    if (!hasChanges) {
      for (const boss of bosses) {
        const prevKills = previousBosses[boss.name] ?? 0;
        if ((boss.score ?? 0) !== prevKills) {
          hasChanges = true;
          break;
        }
      }
    }

    if (!hasChanges && latestSnapshot) {
      return await returnSnapshot(res, username, latestSnapshot.id);
    }

    // Insert new snapshot
    const snapshotResult = await pool.query(
      "INSERT INTO snapshots (player_id) VALUES ($1) RETURNING id",
      [playerId]
    );
    const snapshotId = snapshotResult.rows[0].id;

    // Insert skills with delta calculation
    const skillsWithDiffs = {};
    const skillPromises = skills.map(skill => {
      const prev = previousSkills[skill.name] || { level: 0, xp: 0 };
      skillsWithDiffs[skill.name] = {
        level: skill.level ?? 0,
        xp: skill.xp ?? 0,
        levelDiff: (skill.level ?? 0) - prev.level,
        xpDiff: (skill.xp ?? 0) - prev.xp
      };
      return pool.query(
        "INSERT INTO skills (snapshot_id, skill_name, level, xp) VALUES ($1, $2, $3, $4)",
        [snapshotId, skill.name, skill.level ?? 0, skill.xp ?? 0]
      );
    });
    await Promise.all(skillPromises);

    // Insert bosses with delta calculation
    const bossesWithDiffs = {};
    const bossPromises = bosses.map(boss => {
      const prevKills = previousBosses[boss.name] ?? 0;
      bossesWithDiffs[boss.name] = {
        kills: boss.score ?? 0,
        rank: boss.rank ?? 0,
        killsDiff: (boss.score ?? 0) - prevKills
      };
      return pool.query(
        "INSERT INTO bosskills (snapshot_id, boss_name, kills, rank) VALUES ($1, $2, $3, $4)",
        [snapshotId, boss.name, boss.score ?? 0, boss.rank ?? 0]
      );
    });
    await Promise.all(bossPromises);

    // Return response
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