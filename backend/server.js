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

    // Get latest snapshot
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

    // Fetch RuneScape hiscores
    const response = await fetch(
      `https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=${encodeURIComponent(username)}`
    );

    if (!response.ok)
      return res.status(404).json({ error: "Player not found" });

    const data = await response.json();

    // Load previous skills and bosses for delta calculation
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

    // Check for changes (skip snapshot if nothing changed)
    let hasChanges = false;

    // Check skills
    if (data.skills) {
      for (const skill of data.skills) {
        const prev = previousSkills[skill.name];
        if (!prev || prev.level !== skill.level || prev.xp !== skill.xp) {
          hasChanges = true;
          break;
        }
      }
    }

    // Check bosses only if no skill changes detected
    if (!hasChanges && data.bosses) {
      for (const boss of data.bosses) {
        const prev = previousBosses[boss.name] || 0;
        if (prev !== boss.score) {
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

    // Insert skills
    const skillsWithDiffs = {};
    if (data.skills) {
      const skillPromises = data.skills.map(skill => {
        const prev = previousSkills[skill.name];
        skillsWithDiffs[skill.name] = {
          level: skill.level,
          xp: skill.xp,
          levelDiff: prev ? skill.level - prev.level : 0,
          xpDiff: prev ? skill.xp - prev.xp : 0
        };
        return pool.query(
          "INSERT INTO skills (snapshot_id, skill_name, level, xp) VALUES ($1, $2, $3, $4)",
          [snapshotId, skill.name, skill.level, skill.xp]
        );
      });
      await Promise.all(skillPromises);
    }

    // Insert bosses
    const bossesWithDiffs = {};
    if (data.bosses) {
      const bossPromises = data.bosses.map(boss => {
        const prevKills = previousBosses[boss.name] || 0;
        bossesWithDiffs[boss.name] = {
          kills: boss.score,
          rank: boss.rank,
          killsDiff: boss.score - prevKills
        };
        return pool.query(
          "INSERT INTO bosskills (snapshot_id, boss_name, kills, rank) VALUES ($1, $2, $3, $4)",
          [snapshotId, boss.name, boss.score, boss.rank]
        );
      });
      await Promise.all(bossPromises);
    }

    // Return JSON
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