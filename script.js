const searchButton = document.getElementById('searchButton');
const searchInput  = document.getElementById('searchInput');
const playerContainer = document.getElementById('player-container');

let selectedRange = "1d";

searchButton.addEventListener('click', searchPlayer);

async function searchPlayer() {
    const username = searchInput.value.trim();
    if (!username) { alert('Please enter a username'); return; }

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
        username:   data.username,
        skills:     {},
        bosses:     {},
        activities: {}
    };

    for (const [skill, info] of Object.entries(data.skills ?? {})) {
        const xp = Number(info.xp ?? 0);
        normalized.skills[skill] = {
            level:  info.level === -1 ? 1 : Number(info.level ?? 1),
            xp:     xp === -1 ? 0 : xp,
            xpDiff: Number(info.xpDiff ?? 0)
        };
    }

    for (const [name, info] of Object.entries(data.bosses ?? {})) {
        console.log(name, info);
        const kills = Number(info.kills ?? 0);
        normalized.bosses[name] = {
            kills:     kills === -1 ? 0 : kills,
            rank:      Number(info.rank ?? -1),
            killsDiff: Number(info.killsDiff ?? 0)
        };
    }

    for (const [name, info] of Object.entries(data.activities ?? {})) {
        const score = Number(info.score ?? 0);
        normalized.activities[name] = {
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
        render: ([name])   => capitalize(name)
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
        render: ([name]) => capitalize(name)
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
        const row  = document.createElement("tr");
        row.innerHTML = `
            <td>${capitalize(skill)}</td>
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

    const allEntries = Object.entries(data.bosses);
    let currentPage  = 0;
    let filtered     = allEntries;

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

    const allEntries = Object.entries(data.activities);
    let currentPage  = 0;
    let filtered     = allEntries;

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
    data = normalizePlayerData(data);
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
        btn.textContent       = range;
        btn.style.marginRight = "5px";
        btn.style.cursor      = "pointer";
        if (range === selectedRange) btn.classList.add("active-tab");
        btn.addEventListener("click", () => { selectedRange = range; searchPlayer(); });
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
  if (currentPlayerData && /how|why|what|when|best|worst|should|tip|advice/i.test(text))
    return { intent: 'followup' };
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
You have access to live player stats fetched from the Wise Old Man API.
- Be concise and friendly. Use OSRS terminology naturally.
- When stats are provided, lead with the most interesting insight (biggest gain, closest 99, etc.).
- If asked for advice, tailor it to the player's actual stats.
- If no player is loaded yet, encourage the user to type a username.
- Time range context: the stats shown cover the last ${selectedRange}.`;

  if (currentPlayerData) {
    return `${base}\n\nCurrent player data (JSON):\n${JSON.stringify(currentPlayerData, null, 2)}`;
  }
  return base;
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
  const reply = data.content[0].text;
  conversationHistory.push({ role: 'assistant', content: reply });
  return reply;
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