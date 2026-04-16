const searchButton = document.getElementById('searchButton');
const searchInput  = document.getElementById('searchInput');
const playerContainer = document.getElementById('player-container');

let selectedRange = "1d";
let cachedPlayerData = null;
let currentGEData = null;

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
const SKILL_ICONS = {
  "Overall":       "https://oldschool.runescape.wiki/images/Stats_icon.png",
  "Attack":        "https://oldschool.runescape.wiki/images/Attack_icon.png",
  "Defence":       "https://oldschool.runescape.wiki/images/Defence_icon.png",
  "Strength":      "https://oldschool.runescape.wiki/images/Strength_icon.png",
  "Hitpoints":     "https://oldschool.runescape.wiki/images/Hitpoints_icon.png",
  "Ranged":        "https://oldschool.runescape.wiki/images/Ranged_icon.png",
  "Prayer":        "https://oldschool.runescape.wiki/images/Prayer_icon.png",
  "Magic":         "https://oldschool.runescape.wiki/images/Magic_icon.png",
  "Cooking":       "https://oldschool.runescape.wiki/images/Cooking_icon.png",
  "Woodcutting":   "https://oldschool.runescape.wiki/images/Woodcutting_icon.png",
  "Fletching":     "https://oldschool.runescape.wiki/images/Fletching_icon.png",
  "Fishing":       "https://oldschool.runescape.wiki/images/Fishing_icon.png",
  "Firemaking":    "https://oldschool.runescape.wiki/images/Firemaking_icon.png",
  "Crafting":      "https://oldschool.runescape.wiki/images/Crafting_icon.png",
  "Smithing":      "https://oldschool.runescape.wiki/images/Smithing_icon.png",
  "Mining":        "https://oldschool.runescape.wiki/images/Mining_icon.png",
  "Herblore":      "https://oldschool.runescape.wiki/images/Herblore_icon.png",
  "Agility":       "https://oldschool.runescape.wiki/images/Agility_icon.png",
  "Thieving":      "https://oldschool.runescape.wiki/images/Thieving_icon.png",
  "Slayer":        "https://oldschool.runescape.wiki/images/Slayer_icon.png",
  "Farming":       "https://oldschool.runescape.wiki/images/Farming_icon.png",
  "Runecrafting":  "https://oldschool.runescape.wiki/images/Runecraft_icon.png",
  "Hunter":        "https://oldschool.runescape.wiki/images/Hunter_icon.png",
  "Construction":  "https://oldschool.runescape.wiki/images/Construction_icon.png",
  "Sailing":       "https://oldschool.runescape.wiki/images/Sailing_icon.png",
};

const BOSS_ICONS = {
  "Abyssal Sire":                       "https://oldschool.runescape.wiki/images/Abyssal_orphan.png",
  "Alchemical Hydra":                   "https://oldschool.runescape.wiki/images/Alchemical_hydra_heads.png",
  "Amoxliatl":                          "https://oldschool.runescape.wiki/images/Moxi.png",
  "Araxxor":                            "https://oldschool.runescape.wiki/images/Nid.png",
  "Artio":                              "https://oldschool.runescape.wiki/images/Claws_of_callisto.png",
  "Barrows Chests":                     "https://oldschool.runescape.wiki/images/Dharok%27s_helm.png",
  "Brutus":                             "https://oldschool.runescape.wiki/images/Beef.png",
  "Bryophyta":                          "https://oldschool.runescape.wiki/images/Bryophyta%27s_essence.png",
  "Callisto":                           "https://oldschool.runescape.wiki/images/Callisto_cub.png",
  "Calvar'ion":                         "https://oldschool.runescape.wiki/images/Skull_of_vet%27ion.png",
  "Cerberus":                           "https://oldschool.runescape.wiki/images/Hellpuppy.png",
  "Chambers of Xeric":                  "https://oldschool.runescape.wiki/images/Olmlet.png",
  "Chambers of Xeric: Challenge Mode":  "https://oldschool.runescape.wiki/images/Metamorphic_dust.png",
  "Chaos Elemental":                    "https://oldschool.runescape.wiki/images/Pet_chaos_elemental.png",
  "Chaos Fanatic":                      "https://oldschool.runescape.wiki/images/Ancient_staff.png",
  "Commander Zilyana":                  "https://oldschool.runescape.wiki/images/Pet_zilyana.png",
  "Corporeal Beast":                    "https://oldschool.runescape.wiki/images/Pet_corporeal_critter.png",
  "Crazy Archaeologist":                "https://oldschool.runescape.wiki/images/Fedora.png",
  "Dagannoth Prime":                    "https://oldschool.runescape.wiki/images/Pet_dagannoth_prime.png",
  "Dagannoth Rex":                      "https://oldschool.runescape.wiki/images/Pet_dagannoth_rex.png",
  "Dagannoth Supreme":                  "https://oldschool.runescape.wiki/images/Pet_dagannoth_supreme.png",
  "Deranged Archaeologist":             "https://oldschool.runescape.wiki/images/Wintertodt_parable.png",
  "Doom of Mokhaiotl":                  "https://oldschool.runescape.wiki/images/Dom.png",
  "Duke Sucellus":                      "https://oldschool.runescape.wiki/images/Baron.png",
  "General Graardor":                   "https://oldschool.runescape.wiki/images/Pet_general_graardor.png",
  "Giant Mole":                         "https://oldschool.runescape.wiki/images/Baby_mole.png",
  "Grotesque Guardians":                "https://oldschool.runescape.wiki/images/Noon.png",
  "Hespori":                            "https://oldschool.runescape.wiki/images/Bottomless_compost_bucket.png",
  "Kalphite Queen":                     "https://oldschool.runescape.wiki/images/Kq_head.png",
  "King Black Dragon":                  "https://oldschool.runescape.wiki/images/Kbd_heads.png",
  "Kraken":                             "https://oldschool.runescape.wiki/images/Pet_kraken.png",
  "Kree'Arra":                          "https://oldschool.runescape.wiki/images/Pet_kree%27arra.png",
  "K'ril Tsutsaroth":                   "https://oldschool.runescape.wiki/images/Pet_k%27ril_tsutsaroth.png",
  "Lunar Chests":                       "https://oldschool.runescape.wiki/images/Blood_moon_helm.png",
  "Mimic":                              "https://oldschool.runescape.wiki/images/Mimic.png",
  "Nex":                                "https://oldschool.runescape.wiki/images/Nexling.png",
  "Nightmare":                          "https://oldschool.runescape.wiki/images/Little_nightmare.png",
  "Phosani's Nightmare":                "https://oldschool.runescape.wiki/images/Little_parasite.png",
  "Obor":                               "https://oldschool.runescape.wiki/images/Hill_giant_club.png",
  "Phantom Muspah":                     "https://oldschool.runescape.wiki/images/Muphin_%28ranged%29.png",
  "Sarachnis":                          "https://oldschool.runescape.wiki/images/Sraracha.png",
  "Scorpia":                            "https://oldschool.runescape.wiki/images/Scorpia%27s_offspring.png",
  "Scurrius":                           "https://oldschool.runescape.wiki/images/Scurry.png",
  "Shellbane Gryphon":                  "https://oldschool.runescape.wiki/images/Gull_%28pet%29.png",
  "Skotizo":                            "https://oldschool.runescape.wiki/images/Skotos.png",
  "Sol Heredit":                        "https://oldschool.runescape.wiki/images/Smol_heredit.png",
  "Spindel":                            "https://oldschool.runescape.wiki/images/Fangs_of_venenatis.png",
  "Tempoross":                          "https://oldschool.runescape.wiki/images/Tiny_tempor.png",
  "The Gauntlet":                       "https://oldschool.runescape.wiki/images/Youngllef.png",
  "The Corrupted Gauntlet":             "https://oldschool.runescape.wiki/images/Corrupted_youngllef.png",
  "The Hueycoatl":                      "https://oldschool.runescape.wiki/images/Huberte.png",
  "The Leviathan":                      "https://oldschool.runescape.wiki/images/Lil%27viathan.png",
  "The Royal Titans":                   "https://oldschool.runescape.wiki/images/Bran.png",
  "The Whisperer":                      "https://oldschool.runescape.wiki/images/Wisp.png",
  "Theatre of Blood":                   "https://oldschool.runescape.wiki/images/Lil%27_zik.png",
  "Theatre of Blood: Hard Mode":        "https://oldschool.runescape.wiki/images/Sanguine_dust.png",
  "Thermonuclear Smoke Devil":          "https://oldschool.runescape.wiki/images/Pet_smoke_devil.png",
  "Tombs of Amascut":                   "https://oldschool.runescape.wiki/images/Tumeken%27s_guardian.png",
  "Tombs of Amascut: Expert Mode":      "https://oldschool.runescape.wiki/images/Ancient_remnant.png",
  "TzKal-Zuk":                          "https://oldschool.runescape.wiki/images/Tzrek-zuk.png",
  "TzTok-Jad":                          "https://oldschool.runescape.wiki/images/Tzrek-jad.png",
  "Vardorvis":                          "https://oldschool.runescape.wiki/images/Butch.png",
  "Venenatis":                          "https://oldschool.runescape.wiki/images/Venenatis_spiderling.png",
  "Vet'ion":                            "https://oldschool.runescape.wiki/images/Vet%27ion_jr..png",
  "Vorkath":                            "https://oldschool.runescape.wiki/images/Vorkath%27s_head.png",
  "Wintertodt":                         "https://oldschool.runescape.wiki/images/Phoenix.png",
  "Yama":                               "https://oldschool.runescape.wiki/images/Yami.png",
  "Zalcano":                            "https://oldschool.runescape.wiki/images/Smolcano.png",
  "Zulrah":                             "https://oldschool.runescape.wiki/images/Pet_snakeling.png",
};

const ACTIVITY_ICONS = {
  "League Points":                   "https://oldschool.runescape.wiki/images/League_Points.png",
  "Grid Points":                     "https://oldschool.runescape.wiki/images/League_Points.png",
  "Deadman Points":                  "https://oldschool.runescape.wiki/images/DMM_skulls.png",
  "Bounty Hunter - Hunter":          "https://oldschool.runescape.wiki/images/Hunter%27s_honour.png",
  "Bounty Hunter - Rogue":           "https://oldschool.runescape.wiki/images/Rogue%27s_revenge.png",
  "Bounty Hunter (Legacy) - Hunter": "https://oldschool.runescape.wiki/images/Hunter%27s_honour.png",
  "Bounty Hunter (Legacy) - Rogue":  "https://oldschool.runescape.wiki/images/Rogue%27s_revenge.png",
  "Clue Scrolls (all)":              "https://oldschool.runescape.wiki/images/Clue_scroll.png",
  "Clue Scrolls (beginner)":         "https://oldschool.runescape.wiki/images/Clue_scroll_%28beginner%29.png",
  "Clue Scrolls (easy)":             "https://oldschool.runescape.wiki/images/Clue_scroll_%28easy%29.png",
  "Clue Scrolls (medium)":           "https://oldschool.runescape.wiki/images/Clue_scroll_%28medium%29.png",
  "Clue Scrolls (hard)":             "https://oldschool.runescape.wiki/images/Clue_scroll_%28hard%29.png",
  "Clue Scrolls (elite)":            "https://oldschool.runescape.wiki/images/Clue_scroll_%28elite%29.png",
  "Clue Scrolls (master)":           "https://oldschool.runescape.wiki/images/Clue_scroll_%28master%29.png",
  "LMS - Rank":                      "https://oldschool.runescape.wiki/images/Deadman%27s_chest_%28cosmetic%29.png",
  "PvP Arena - Rank":                "https://oldschool.runescape.wiki/images/Scroll_of_imbuing.png",
  "Soul Wars Zeal":                  "https://oldschool.runescape.wiki/images/Lil%27_creator.png",
  "Rifts closed":                    "https://oldschool.runescape.wiki/images/Abyssal_protector.png",
  "Colosseum Glory":                 "https://oldschool.runescape.wiki/images/Sunfire_splinters_4.png",
  "Collections Logged":              "https://oldschool.runescape.wiki/images/Collection_log.png",
};

searchButton.addEventListener('click', searchPlayer);
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchPlayer(); }); // ← ADD THIS

async function searchPlayer() {
    const username = searchInput.value.trim();
    if (!username) { alert('Please enter a username'); return; }

    cachedPlayerData = null;
    playerContainer.innerHTML = "<p>Loading...</p>";

    try {
        const response = await fetch(
            `https://runehelp.onrender.com/api/player/${encodeURIComponent(username)}?range=${selectedRange}`
        );
        if (!response.ok) throw new Error("Player not found");
        const data = await response.json();
        renderPlayer(data);
    } catch (err) {
        console.error(err);
        playerContainer.innerHTML = `<p style="color:red;">Error loading player</p>`;
    }
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatNumber(num) {
    if (num === null || num === undefined) return "0";
    return Number(num).toLocaleString("en-US");
}

function formatAbbrev(num) {
    if (num === null || num === undefined) return "0";
    const sign = num < 0 ? "-" : "";
    const abs  = Math.abs(num);
    if (abs >= 1_000_000_000) return sign + (abs / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
    if (abs >= 1_000_000)     return sign + (abs / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (abs >= 1_000)         return sign + (abs / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return sign + abs.toString();
}

function formatDiff(num) {
    if (num === 0) return "—";
    return `${num > 0 ? "+" : ""}${formatAbbrev(num)}`;
}

function getDiffColor(num) {
    if (num > 0) return "green";
    if (num < 0) return "red";
    return "gray";
}

function capitalize(word = "") {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

// ─── Normalization ────────────────────────────────────────────────────────────

function normalizePlayerData(data) {
    const normalized = {
        username: data.username,
        skills: {},
        bosses: {},
        activities: {}
    };

    for (const skill of SKILL_NAMES) {
        const info = data.skills?.[skill] ?? {};
        const xp = Number(info.xp ?? 0);
        normalized.skills[skill] = {
            level: info.level === -1 ? 1 : Number(info.level ?? 1),
            xp: xp === -1 ? 0 : xp,
            xpDiff: Number(info.xpDiff ?? 0)
        };
    }

    for (const boss of BOSS_NAMES) {
        const info = data.bosses?.[boss] ?? {};
        const kills = Number(info.kills ?? 0);
        normalized.bosses[boss] = {
            kills: kills === -1 ? 0 : kills,
            rank: Number(info.rank ?? -1),
            killsDiff: Number(info.killsDiff ?? 0)
        };
    }

    for (const activity of ACTIVITY_NAMES) {
        const info = data.activities?.[activity] ?? {};
        const score = Number(info.score ?? 0);
        normalized.activities[activity] = {
            score: score === -1 ? 0 : score,
            rank: Number(info.rank ?? -1),
            scoreDiff: Number(info.scoreDiff ?? 0)
        };
    }

    return normalized;
}

// ─── Shared table primitive ───────────────────────────────────────────────────

const PAGE_SIZE = 10;

function createPaginatedTable(entries, page, onPageChange, columns) {
    const fragment    = document.createDocumentFragment();
    const totalPages  = Math.ceil(entries.length / PAGE_SIZE);

    const table = document.createElement("table");
    table.classList.add("stats-table");
    table.innerHTML = `<tr>${columns.map(c => `<th>${c.header}</th>`).join("")}</tr>`;

    if (entries.length === 0) {
        const empty = document.createElement("tr");
        empty.innerHTML = `<td colspan="${columns.length}" style="text-align:center; color:gray;">No entries found</td>`;
        table.appendChild(empty);
    } else {
        entries.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).forEach(entry => {
            const row = document.createElement("tr");
            row.innerHTML = columns.map(c => `<td>${c.render(entry)}</td>`).join("");
            table.appendChild(row);
        });
    }
    fragment.appendChild(table);

    if (totalPages > 1) {
        const pagination = document.createElement("div");
        pagination.style.cssText = "display:flex; align-items:center; justify-content:center; gap:12px; margin-top:10px;";

        const prevBtn = document.createElement("button");
        prevBtn.textContent = "← Prev";
        prevBtn.disabled = page === 0;
        prevBtn.addEventListener("click", () => onPageChange(page - 1));

        const pageLabel = document.createElement("span");
        pageLabel.textContent = `Page ${page + 1} of ${totalPages}`;
        pageLabel.style.fontFamily = "rsFont, sans-serif";

        const nextBtn = document.createElement("button");
        nextBtn.textContent = "Next →";
        nextBtn.disabled = page === totalPages - 1;
        nextBtn.addEventListener("click", () => onPageChange(page + 1));

        pagination.append(prevBtn, pageLabel, nextBtn);
        fragment.appendChild(pagination);
    }

    return fragment;
}

// ─── Column definitions ───────────────────────────────────────────────────────

const BOSS_COLUMNS = [
    {
        header: "Name",
        render: ([name]) => `${renderIcon(BOSS_ICONS, name)}${capitalize(name)}`
    },
    {
        header: "Rank",
        render: ([, info]) => info.rank === -1 ? "--" : formatNumber(info.rank)
    },
    {
        header: "Kills",
        render: ([, info]) => `<span title="${formatNumber(info.kills)}">${formatAbbrev(info.kills)}</span>`
    },
    {
        header: "Δ Kills",
        render: ([, info]) => {
            const d = info.killsDiff ?? 0;
            return `<span style="color:${getDiffColor(d)}" title="${formatNumber(d)}">${formatDiff(d)}</span>`;
        }
    },
];

const ACTIVITY_COLUMNS = [
    {
        header: "Activity",
        render: ([name]) => `${renderIcon(ACTIVITY_ICONS, name)}${capitalize(name)}`
    },
    {
        header: "Score",
        render: ([, info]) => `<span title="${formatNumber(info.score)}">${formatAbbrev(info.score)}</span>`
    },
    {
        header: "Rank",
        render: ([, info]) => info.rank === -1 ? "--" : formatNumber(info.rank)
    },
    {
        header: "Δ Score",
        render: ([, info]) => {
            const d = info.scoreDiff ?? 0;
            return `<span style="color:${getDiffColor(d)}" title="${formatNumber(d)}">${formatDiff(d)}</span>`;
        }
    },
];

// ─── Search box ───────────────────────────────────────────────────────────────

function createSearchBox(allEntries, onResultsChange) {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "position:relative; margin-bottom:10px;";

    const input = document.createElement("input");
    input.type        = "text";
    input.placeholder = "Search...";
    input.style.cssText = `
        width: 100%; height: 30px;
        border: 2px solid #8b4513; border-radius: 5px;
        padding: 0 8px; font-family: rsFont; box-sizing: border-box;
    `;

    const dropdown = document.createElement("ul");
    dropdown.style.cssText = `
        position: absolute; top: 100%; left: 0; right: 0;
        background-color: #f8f5ee;
        border: 2px solid #8b4513; border-top: none;
        border-radius: 0 0 6px 6px;
        list-style: none; margin: 0; padding: 0;
        z-index: 50; display: none; max-height: 200px; overflow-y: auto;
    `;

    function showDropdown(query) {
        dropdown.innerHTML = "";
        if (!query) { dropdown.style.display = "none"; return; }

        const matches = allEntries
            .filter(([name]) => name.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 8);

        if (matches.length === 0) { dropdown.style.display = "none"; return; }

        matches.forEach(([name]) => {
            const item = document.createElement("li");
            item.textContent = capitalize(name);
            item.style.cssText = `
                padding: 6px 10px; cursor: pointer;
                font-family: rsFont; font-size: 0.9rem;
                border-bottom: 1px solid #d4b896;
            `;
            item.addEventListener("mouseenter", () => item.style.backgroundColor = "#e8d9c0");
            item.addEventListener("mouseleave", () => item.style.backgroundColor = "");
            item.addEventListener("mousedown", () => {
                input.value = capitalize(name);
                dropdown.style.display = "none";
                onResultsChange(allEntries.filter(([n]) => n.toLowerCase() === name.toLowerCase()));
            });
            dropdown.appendChild(item);
        });
        dropdown.style.display = "block";
    }

    input.addEventListener("input", () => {
        const query = input.value.trim();
        const results = query
            ? allEntries.filter(([name]) => name.toLowerCase().includes(query.toLowerCase()))
            : allEntries;
        showDropdown(query);
        onResultsChange(results);
    });

    input.addEventListener("blur",  () => setTimeout(() => { dropdown.style.display = "none"; }, 150));
    input.addEventListener("focus", () => { if (input.value.trim()) showDropdown(input.value.trim()); });

    wrapper.append(input, dropdown);
    return wrapper;
}

// ─── Tab renderers ────────────────────────────────────────────────────────────
// Skills has its own table — its columns (Level, XP, Δ XP) don't share the
// same data shape as bosses/activities ({ kills, rank, killsDiff }).

function renderSkillsTab(data, contentContainer) {
    contentContainer.innerHTML = "";

    const table = document.createElement("table");
    table.classList.add("stats-table");
    table.innerHTML = `
        <tr>
            <th>Skill</th><th>Level</th><th>XP</th><th>Δ XP</th>
        </tr>
    `;

    for (const [skill, info] of Object.entries(data.skills)) {
        const diff = info.xpDiff;
        const iconUrl = SKILL_ICONS[skill] ?? "";
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>
                ${iconUrl ? `<img src="${iconUrl}" alt="${skill}" style="width:18px; height:18px; vertical-align:middle; margin-right:6px;">` : ""}
                ${capitalize(skill)}
            </td>
            <td>${info.level}</td>
            <td title="${formatNumber(info.xp)}">${formatAbbrev(info.xp)}</td>
            <td style="color:${getDiffColor(diff)}" title="${formatNumber(diff)}">${formatDiff(diff)}</td>
        `;
        table.appendChild(row);
    }

    contentContainer.appendChild(table);
}

function renderBossingTab(data, contentContainer) {
    contentContainer.innerHTML = "";

    const allEntries = Object.entries(data.bosses).slice();
    let currentPage = 0;
    let filtered = allEntries.slice();

    const tableWrapper = document.createElement("div");

    function repaint() {
        tableWrapper.innerHTML = "";
        tableWrapper.appendChild(
            createPaginatedTable(filtered, currentPage, (p) => {
                currentPage = p;
                repaint();
            }, BOSS_COLUMNS)
        );
    }

    const searchBox = createSearchBox(allEntries, (results) => {
        filtered    = results;
        currentPage = 0;
        repaint();
    });

    contentContainer.append(searchBox, tableWrapper);
    repaint();
}

function renderActivitiesTab(data, contentContainer) {
    contentContainer.innerHTML = "";

    const allEntries = Object.entries(data.activities).slice(); // stable snapshot
    let currentPage = 0;
    let filtered = allEntries.slice();

    const tableWrapper = document.createElement("div");

    function repaint() {
        tableWrapper.innerHTML = "";
        tableWrapper.appendChild(
            createPaginatedTable(filtered, currentPage, (p) => {
                currentPage = p;
                repaint();
            }, ACTIVITY_COLUMNS)
        );
    }

    const searchBox = createSearchBox(allEntries, (results) => {
        filtered    = results;
        currentPage = 0;
        repaint();
    });

    contentContainer.append(searchBox, tableWrapper);
    repaint();
}

// ─── Player render ────────────────────────────────────────────────────────────

function renderPlayer(data) {
    document.getElementById('welcome-banner').style.display = 'none';
    cachedPlayerData = data;
    const normalizedData = normalizePlayerData(data);
    data = normalizePlayerData(data);
    currentPlayerData = data;
    playerContainer.innerHTML = "";

    if (!data || !data.skills) {
        playerContainer.innerHTML = "<p>No player data found</p>";
        return;
    }

    // Header
    const header = document.createElement("h2");
    header.textContent = `${data.username || "Unknown Player"} (${selectedRange})`;
    playerContainer.appendChild(header);

    // Range buttons
    const rangeDesc = document.createElement("p");
    rangeDesc.textContent  = "Select time range for delta stats:";
    rangeDesc.style.fontStyle = "italic";
    playerContainer.appendChild(rangeDesc);

    const rangeContainer = document.createElement("div");
    rangeContainer.classList.add("range-container");
    rangeContainer.style.marginBottom = "10px";

    ["1h", "1d", "7d"].forEach(range => {
        const btn = document.createElement("button");
        btn.textContent = range;
        btn.style.marginRight = "5px";
        btn.style.cursor = "pointer";
        if (range === selectedRange) btn.classList.add("active-tab");
        btn.addEventListener("click", () => {
            selectedRange = range;
            if (cachedPlayerData) {
                renderPlayer(cachedPlayerData); // re-render from cache, no fetch
            } else {
                searchPlayer(); // fallback if somehow no cache
            }
        });
        rangeContainer.appendChild(btn);
    });

    playerContainer.appendChild(rangeContainer);

    // Tab buttons
    const tabDesc = document.createElement("p");
    tabDesc.textContent  = "Switch between Skills, Bossing, and Activities:";
    tabDesc.style.fontStyle = "italic";
    playerContainer.appendChild(tabDesc);

    const tabContainer = document.createElement("div");
    tabContainer.classList.add("tab-container");
    tabContainer.style.marginBottom = "10px";

    const skillsTabBtn     = document.createElement("button");
    const bossesTabBtn     = document.createElement("button");
    const activitiesTabBtn = document.createElement("button");

    skillsTabBtn.textContent     = "Skills";
    bossesTabBtn.textContent     = "Bossing";
    activitiesTabBtn.textContent = "Activities";
    skillsTabBtn.style.marginRight = "5px";
    bossesTabBtn.style.marginRight = "5px";

    tabContainer.append(skillsTabBtn, bossesTabBtn, activitiesTabBtn);
    playerContainer.appendChild(tabContainer);

    const contentContainer = document.createElement("div");
    playerContainer.appendChild(contentContainer);

    const allTabBtns = [skillsTabBtn, bossesTabBtn, activitiesTabBtn];

    function activateTab(selectedBtn, renderFn) {
        allTabBtns.forEach(btn =>
            btn === selectedBtn
                ? btn.classList.add("active-tab")
                : btn.classList.remove("active-tab")
        );
        renderFn();
    }

    skillsTabBtn.addEventListener("click",     () => activateTab(skillsTabBtn,     () => renderSkillsTab(data, contentContainer)));
    bossesTabBtn.addEventListener("click",     () => activateTab(bossesTabBtn,     () => renderBossingTab(data, contentContainer)));
    activitiesTabBtn.addEventListener("click", () => activateTab(activitiesTabBtn, () => renderActivitiesTab(data, contentContainer)));

    activateTab(skillsTabBtn, () => renderSkillsTab(data, contentContainer));
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
const chatBubble = document.getElementById('chatBubble');
const chatBox = document.getElementById('chatBox');
const chatClose = document.getElementById('chatClose');
const chatSend = document.getElementById('chatSend');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');

// ─── Event listeners ─────────────────────────────────────
chatBubble.addEventListener('click', () => chatBox.classList.toggle('open'));
chatClose.addEventListener('click', () => chatBox.classList.remove('open'));
chatSend.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });

// ─── State ───────────────────────────────────────────────
const conversationHistory = [];
let currentPlayerData = null;

// ─── Helpers ─────────────────────────────────────────────
function appendMessage(text, role) {
  const msg = document.createElement('div');
  msg.classList.add('chat-msg', role);
  msg.textContent = text;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return msg;
}

function setLoading(isLoading) {
  chatSend.disabled = isLoading;
  chatInput.disabled = isLoading;
}

// Looks for lookup intent: "look up X", "check X", "stats for X", or bare name
function parseIntent(text) {
  const lower = text.toLowerCase();
  const explicit = text.match(
    /(?:look\s*up|check|stats\s*for|search|find|show)\s+([A-Za-z0-9 _-]{1,12})/i
  );
  if (explicit) return { intent: 'lookup', username: explicit[1].trim() };
  if (lower.includes('compare') || lower.includes('vs')) return { intent: 'compare' };
  if (currentPlayerData) return { intent: 'followup' };  // ← REPLACE the old followup check
  if (/^[A-Za-z0-9_-]{2,12}$/.test(text.trim()))
    return { intent: 'lookup', username: text.trim() };
  return { intent: 'chat' };
}

// ─── Fetch player data ────────────────────────────────────
async function fetchPlayerData(username) {
  const res = await fetch(
    `https://runehelp.onrender.com/api/player/${encodeURIComponent(username)}?range=${selectedRange}`
  );
  if (!res.ok) throw new Error(`Player not found: ${username}`);
  return res.json();
}

// ─── Build system prompt ──────────────────────────────────
function buildSystemPrompt() {
  const base = `You are RuneHelp, a helpful Old School RuneScape assistant embedded in a player stats app.
You have access to live player stats fetched from the Wise Old Man API. You also have access to the Grand Exchange api
and can tell players about market trends and items they have questions about such as where to obtain them or if its a good idea to
buy or sell.
- We only use english language.
- You are allowed to use profanity.
- You give direct answers.
- You do not explain your thought process.
- Keep responses short and conversational — 2 to 4 sentences max.
- Never use markdown formatting. No bold, no bullet points, no asterisks.
- Use plain sentences only.
- Use OSRS terminology naturally.
- When stats are provided, give a few highlights only.
- If no player is loaded yet, encourage the user to type a username.
- Time range context: the stats shown cover the last ${selectedRange}.
- You are an answer-only bot. Never include reasoning, planning, analysis, or internal thoughts. Your response must be the final answer only, starting immediately with the advice.
- Do not self-correct or second-guess yourself in your response. Commit to one answer immediately.`;

  let prompt = base;
  if (currentPlayerData) {
    prompt += `\n\nCurrent player data (JSON):\n${JSON.stringify(currentPlayerData, null, 2)}`;
  }
  if (currentGEData) {
    prompt += `\n\nCurrent Grand Exchange data (buy/sell/profit/roi):\n${JSON.stringify(currentGEData, null, 2)}`;
  }
  return prompt;
}

// ─── Main send function ───────────────────────────────────
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  appendMessage(text, 'user');
  chatInput.value = '';
  setLoading(true);
  const typingMsg = appendMessage('…', 'bot');

  try {
    const { intent, username } = parseIntent(text);

    if (intent === 'lookup' && username) {
      typingMsg.textContent = `Looking up ${username}…`;
      currentPlayerData = await fetchPlayerData(username);

      const reply = await callGemini(
        `I just looked up "${username}". Here are their stats for the last ${selectedRange}. Give me a friendly summary with the highlights.`
      );
      typingMsg.textContent = reply;

    } else {
      const reply = await callGemini(text);
      typingMsg.textContent = reply;
    }

  } catch (err) {
    if (err.message.startsWith('Player not found')) {
      typingMsg.textContent = `Couldn't find that player. Check the username and try again.`;
    } else {
      typingMsg.textContent = 'Something went wrong. Please try again.';
    }
    console.error(err);
  } finally {
    setLoading(false);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

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
  const reply = data.choices[0].message.content;
  conversationHistory.push({ role: 'assistant', content: reply });
  return reply;
}

// ─── Grand Exchange ───────────────────────────────────────────────────────────

const GE_API      = "https://prices.runescape.wiki/api/v1/osrs";
const GE_MAPPING  = "https://prices.runescape.wiki/api/v1/osrs/mapping";

// Popular flip items with their OSRS item IDs
const DEFAULT_ITEMS = [
    { id: 385,   name: "Shark" },
    { id: 565,   name: "Blood rune" },
    { id: 560,   name: "Death rune" },
    { id: 554,   name: "Fire rune" },
    { id: 1515,  name: "Yew logs" },
    { id: 1519,  name: "Magic logs" },
    { id: 444,   name: "Gold bar" },
    { id: 453,   name: "Coal" },
    { id: 2363,  name: "Gold ore" },
    { id: 561,   name: "Nature rune" },
];

let geItems      = [...DEFAULT_ITEMS];
let geTimeframe  = "24h";
let geChart      = null;
let itemMapping  = [];

// ─── Nav toggle ───────────────────────────────────────────
document.getElementById('nav-tracker').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('view-tracker').style.display = 'block';
    document.getElementById('view-ge').style.display      = 'none';
    document.getElementById('nav-tracker').classList.add('nav-active');
    document.getElementById('nav-ge').classList.remove('nav-active');
});

document.getElementById('nav-ge').addEventListener('click', async (e) => {
    e.preventDefault();
    document.getElementById('view-tracker').style.display = 'none';
    document.getElementById('view-ge').style.display      = 'block';
    document.getElementById('nav-ge').classList.add('nav-active');
    document.getElementById('nav-tracker').classList.remove('nav-active');
    await loadGE();
});

// ─── Timeframe buttons ────────────────────────────────────
document.querySelectorAll('.ge-time-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        document.querySelectorAll('.ge-time-btn').forEach(b => b.classList.remove('active-tab'));
        btn.classList.add('active-tab');
        geTimeframe = btn.dataset.time;
        await loadGE();
    });
});

// ─── Load item mapping for search ────────────────────────
async function loadItemMapping() {
    if (itemMapping.length > 0) return;
    const res  = await fetch(GE_MAPPING);
    itemMapping = await res.json();
}

// ─── Fetch latest prices ──────────────────────────────────
async function fetchPrices(ids) {
    const res  = await fetch(`${GE_API}/latest`);
    const json = await res.json();
    return ids.map(id => ({ id, ...json.data[id] }));
}

// ─── Fetch timeseries for chart ───────────────────────────
async function fetchTimeseries(id) {
    const timestep = geTimeframe === "24h" ? "5m" : "1h";
    const res = await fetch(`${GE_API}/timeseries?id=${id}&timestep=${timestep}`);
    const json = await res.json();
    return json.data ?? [];
}

// ─── Main GE loader ───────────────────────────────────────
async function loadGE() {
    const tableContainer = document.getElementById('ge-table-container');
    tableContainer.innerHTML = "<p>Loading prices...</p>";

    const ids    = geItems.map(i => i.id);
    const prices = await fetchPrices(ids);

    currentGEData = geItems.map((item, i) => 
        {
        const p      = prices[i] ?? {};
        const buy    = p.high ?? 0;
        const sell   = p.low  ?? 0;
        const profit = buy - sell;
        const roi    = sell > 0 ? ((profit / sell) * 100).toFixed(1) : null;
        return { name: item.name, buy, sell, profit, roi };
    });

    renderGETable(prices);
    await renderGEChart(prices[0].id, geItems[0].name);
}

// ─── Render table ─────────────────────────────────────────
function renderGETable(prices) {
    const container = document.getElementById('ge-table-container');
    container.innerHTML = "";

    const table = document.createElement("table");
    table.classList.add("stats-table");
    table.innerHTML = `
        <tr>
            <th>Item</th>
            <th>Buy</th>
            <th>Sell</th>
            <th>Profit</th>
            <th>ROI %</th>
            <th>Last Trade</th>
        </tr>
    `;

    geItems.forEach((item, i) => {
        const p       = prices[i] ?? {};
        const buy     = p.high  ?? 0;
        const sell    = p.low   ?? 0;
        const profit  = buy - sell;
        const roi     = sell > 0 ? ((profit / sell) * 100).toFixed(1) : "—";
        const lastTrade = p.highTime
            ? new Date(p.highTime * 1000).toLocaleTimeString()
            : "—";

        const row = document.createElement("tr");
        row.style.cursor = "pointer";
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${formatNumber(buy)}</td>
            <td>${formatNumber(sell)}</td>
            <td style="color:${profit > 0 ? 'green' : 'gray'}">${formatNumber(profit)}</td>
            <td style="color:${profit > 0 ? 'green' : 'gray'}">${roi}%</td>
            <td>${lastTrade}</td>
        `;

        // Click row to load that item's chart
        row.addEventListener('click', () => renderGEChart(item.id, item.name));
        table.appendChild(row);
    });

    container.appendChild(table);
}

// ─── Render chart ─────────────────────────────────────────
async function renderGEChart(itemId, itemName) {
    const series = await fetchTimeseries(itemId);

    const labels   = series.map(p => new Date(p.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const buyData  = series.map(p => p.avgHighPrice);
    const sellData = series.map(p => p.avgLowPrice);

    if (geChart) geChart.destroy();

    const ctx = document.getElementById('geChart').getContext('2d');
    geChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Buy Price',
                    data: buyData,
                    borderColor: '#c8a96e',
                    backgroundColor: 'rgba(200,169,110,0.1)',
                    tension: 0.3,
                    pointRadius: 0,
                },
                {
                    label: 'Sell Price',
                    data: sellData,
                    borderColor: '#5b9bd5',
                    backgroundColor: 'rgba(91,155,213,0.1)',
                    tension: 0.3,
                    pointRadius: 0,
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: '#c8a96e', font: { family: 'rsFont' } } },
                title: {
                    display: true,
                    text: `${itemName} — ${geTimeframe}`,
                    color: '#c8a96e',
                    font: { family: 'rsFont', size: 16 }
                }
            },
            scales: {
                x: { ticks: { color: '#aaa', maxTicksLimit: 8 }, grid: { color: '#333' } },
                y: { ticks: { color: '#aaa', callback: v => formatAbbrev(v) }, grid: { color: '#333' } }
            }
        }
    });
}

// ─── Item search with autocomplete ───────────────────────
const geSearchInput = document.getElementById('geSearchInput');
const geDropdown    = document.getElementById('geDropdown');

geSearchInput.addEventListener('input', async () => {
    const query = geSearchInput.value.trim().toLowerCase();
    geDropdown.innerHTML = "";

    if (!query) 
        {
            geDropdown.style.display = 'none';
            geItems = [...DEFAULT_ITEMS];  // ← restore defaults when cleared
            await loadGE();
            return; 
        }

    await loadItemMapping();

    const matches = itemMapping
        .filter(item => item.name.toLowerCase().includes(query))
        .slice(0, 8);

    if (matches.length === 0) { geDropdown.style.display = 'none'; return; }

    matches.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item.name;
        li.addEventListener('mousedown', async () => {
            geSearchInput.value    = item.name;
            geDropdown.style.display = 'none';

            //update table for one searched item
            geItems = [{ id: item.id, name: item.name }];
            await loadGE();
        });
        geDropdown.appendChild(li);
    });

    geDropdown.style.display = 'block';
});

geSearchInput.addEventListener('blur', () => {
    setTimeout(() => { geDropdown.style.display = 'none'; }, 150);
});

geSearchInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;

    const query = geSearchInput.value.trim().toLowerCase();
    if (!query) return;

    await loadItemMapping();

    const match = itemMapping.find(item => item.name.toLowerCase() === query)
        ?? itemMapping.find(item => item.name.toLowerCase().includes(query));

    if (!match) return;

    geSearchInput.value      = match.name;
    geDropdown.style.display = 'none';
    geItems = [{ id: match.id, name: match.name }];
    await loadGE();
});

// welcome page comes back on refresh
searchInput.addEventListener('input', () => {
    if (searchInput.value.trim() === '') {
        playerContainer.innerHTML = '';
        document.getElementById('welcome-banner').style.display = 'block';
    }
});

function renderIcon(iconMap, name) {
  const url = iconMap[name];
  if (!url) return "";
  return `<img src="${url}" alt="${name}" style="width:18px; height:18px; vertical-align:middle; margin-right:6px;" onerror="this.style.display='none'">`;
}