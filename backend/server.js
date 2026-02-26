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

function minutesSince(date) {
  return (Date.now() - new Date(date)) / (1000 * 60);
}

function mapByKey(rows, key) {
  const map = {};
  rows.forEach(row => {
    map[row[key]] = row;
  });
  return map;
}

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

function computeSkillDiffs(current, previous = {}) {
  const result = {};
  let changed = false;

  for (const [name, skill] of Object.entries(current)) {
    const prev = previous[name] || { level: 0, xp: 0 };

    const levelDiff = skill.level - prev.level;
    const xpDiff = skill.xp - prev.xp;

    if (levelDiff !== 0 || xpDiff !== 0) changed = true;

    result[name] = { ...skill, levelDiff, xpDiff };
  }

  return { result, changed };
}

function computeBossDiffs(current, previous = {}) {
  const result = {};
  let changed = false;

  for (const [name, boss] of Object.entries(current)) {
    const prevKills = previous[name] || 0;
    const killsDiff = boss.kills - prevKills;

    if (killsDiff !== 0) changed = true;

    result[name] = { ...boss, killsDiff };
  }

  return { result, changed };
}

async function getOrCreatePlayer(username) {
  const result = await pool.query(
    `INSERT INTO players (username)
     VALUES ($1)
     ON CONFLICT (username)
     DO UPDATE SET username = EXCLUDED.username
     RETURNING id`,
    [username]
  );

  return result.rows[0].id;
}

async function getRecentSnapshots(playerId, limit = 10) {
  const result = await pool.query(
    `SELECT id, created_at
     FROM snapshots
     WHERE player_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [playerId, limit]
  );

  return result.rows;
}

async function snapshotsAreIdentical(idA, idB) {
  const [aSkills, bSkills] = await Promise.all([
    pool.query(
      `SELECT skill_name, level, xp
       FROM skills
       WHERE snapshot_id = $1`,
      [idA]
    ),
    pool.query(
      `SELECT skill_name, level, xp
       FROM skills
       WHERE snapshot_id = $1`,
      [idB]
    )
  ]);

  if (aSkills.rowCount !== bSkills.rowCount) return false;

  const mapB = {};
  bSkills.rows.forEach(r => {
    mapB[r.skill_name] = r;
  });

  for (const row of aSkills.rows) {
    const match = mapB[row.skill_name];
    if (!match) return false;
    if (row.level !== match.level || row.xp !== match.xp) {
      return false;
    }
  }

  return true;
}

async function findLastDifferentSnapshot(playerId) {
  const snapshots = await getRecentSnapshots(playerId, 10);

  if (snapshots.length < 2) return null;

  const latest = snapshots[0];

  for (let i = 1; i < snapshots.length; i++) {
    const candidate = snapshots[i];

    const identical = await snapshotsAreIdentical(
      latest.id,
      candidate.id
    );

    if (!identical) {
      return candidate;
    }
  }

  return null;
}

async function loadSnapshotData(snapshotId) {
  const skillsResult = await pool.query(
    `SELECT skill_name, level, xp
     FROM skills
     WHERE snapshot_id = $1`,
    [snapshotId]
  );

  const bossesResult = await pool.query(
    `SELECT boss_name, kills, rank
     FROM bosskills
     WHERE snapshot_id = $1`,
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

async function insertSnapshot(playerId, skills, bosses) {
  const snapshotResult = await pool.query(
    `INSERT INTO snapshots (player_id)
     VALUES ($1)
     RETURNING id`,
    [playerId]
  );

  const snapshotId = snapshotResult.rows[0].id;

  await Promise.all([
    ...Object.entries(skills).map(([name, skill]) =>
      pool.query(
        `INSERT INTO skills (snapshot_id, skill_name, level, xp)
         VALUES ($1, $2, $3, $4)`,
        [snapshotId, name, skill.level, skill.xp]
      )
    ),
    ...Object.entries(bosses).map(([name, boss]) =>
      pool.query(
        `INSERT INTO bosskills (snapshot_id, boss_name, kills, rank)
         VALUES ($1, $2, $3, $4)`,
        [snapshotId, name, boss.kills, boss.rank]
      )
    )
  ]);

  return snapshotId;
}

async function fetchHiscores(username) {
  const response = await fetch(
    `https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=${encodeURIComponent(username)}`
  );

  if (!response.ok) {
    throw new Error("Player not found");
  }

  return response.json();
}

function parseSkills(data) {
  const skills = {};
  for (const skill of data.skills) {
    skills[skill.name] = {
      rank: skill.rank,
      level: skill.level,
      xp: skill.xp
    };
  }
  return skills;
}

function parseBosses(data, bossNames) {
  const activitiesMap = Object.fromEntries(
    data.activities.map(a => [a.name, a])
  );

  const bosses = {};

  for (const name of bossNames) {
    const activity = activitiesMap[name] || { rank: -1, score: 0 };

    bosses[name] = {
      rank: activity.rank,
      kills: activity.score
    };
  }

  return bosses;
}

app.get("/api/player/:username", async (req, res) => {
  const username = req.params.username.trim();

  try {
    const playerId = await getOrCreatePlayer(username);

    const snapshots = await getRecentSnapshots(playerId, 1);
    const latest = snapshots[0] || null;

    let previous = null;

    if (latest) {
      previous = await findLastDifferentSnapshot(playerId);
    }

    // Fetch new hiscores
    const data = await fetchHiscores(username);

    const skills = parseSkills(data);
    const bosses = parseBosses(data, bossNames);

    let prevSkills = {};
    let prevBosses = {};

    if (latest) {
      const prevData = await loadSnapshotData(latest.id);
      prevSkills = prevData.skills;
      prevBosses = prevData.bosses;
    }

    const { result: skillsWithDiffs, changed: skillChanged } =
      computeSkillDiffs(skills, prevSkills);

    const { result: bossesWithDiffs, changed: bossChanged } =
      computeBossDiffs(bosses, prevBosses);

    const hasChanges = skillChanged || bossChanged;

    if (!hasChanges && latest) {
      return res.json({
        username,
        skills: skillsWithDiffs,
        bosses: bossesWithDiffs,
        cached: true
      });
    }

    await insertSnapshot(playerId, skills, bosses);

    res.json({
      username,
      skills: skillsWithDiffs,
      bosses: bossesWithDiffs,
      hasPreviousSnapshot: !!latest,
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