const searchButton = document.getElementById('searchButton');
const searchInput = document.getElementById('searchInput');
const playerContainer = document.getElementById('player-container');

let selectedRange = "1d";

searchButton.addEventListener('click', searchPlayer);

async function searchPlayer() {
    const username = searchInput.value.trim();

    if (!username) {
        alert('Please enter a username');
        return;
    }

    playerContainer.innerHTML = "<p>Loading...</p>";

    try {
        const response = await fetch(
            `https://runehelp.onrender.com/api/player/${encodeURIComponent(username)}?range=${selectedRange}`
        );

        if (!response.ok) {
            throw new Error("Player not found");
        }

        const data = await response.json();
        renderPlayer(data);

    } catch (err) {
        console.error(err);
        playerContainer.innerHTML =
            `<p style="color:red;">Error loading player</p>`;
    }
}

function formatNumber(num) {
    if (num === null || num === undefined) return "0";
    return Number(num).toLocaleString("en-US");
}

function formatAbbrev(num) {
    if (num === null || num === undefined) return "0";

    const sign = num < 0 ? "-" : "";
    const abs = Math.abs(num);

    if (abs >= 1_000_000_000)
        return sign + (abs / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
    if (abs >= 1_000_000)
        return sign + (abs / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (abs >= 1_000)
        return sign + (abs / 1_000).toFixed(1).replace(/\.0$/, "") + "K";

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

function renderPlayer(data) {
    data = normalizePlayerData(data);
    playerContainer.innerHTML = "";

    if (!data || !data.skills) {
        playerContainer.innerHTML = "<p>No player data found</p>";
        return;
    }

    // --- Header ---
    const header = document.createElement("h2");
    header.textContent = `${data.username || "Unknown Player"} (${selectedRange})`;
    playerContainer.appendChild(header);

    // --- Range Buttons ---
    const rangeDesc = document.createElement("p");
    rangeDesc.textContent = "Select time range for delta stats:";
    rangeDesc.style.fontStyle = "italic";
    playerContainer.appendChild(rangeDesc);

    const rangeContainer = document.createElement("div");
    rangeContainer.classList.add("range-container");
    rangeContainer.style.marginBottom = "10px";

    const ranges = ["1h", "1d", "7d"];
    ranges.forEach(range => {
        const btn = document.createElement("button");
        btn.textContent = range;
        btn.style.marginRight = "5px";
        btn.style.cursor = "pointer";
        if (range === selectedRange) btn.classList.add("active-tab");
        btn.addEventListener("click", () => {
            selectedRange = range;
            searchPlayer();
        });
        rangeContainer.appendChild(btn);
    });
    playerContainer.appendChild(rangeContainer);

    // --- Tab Buttons ---
    const tabDesc = document.createElement("p");
    tabDesc.textContent = "Switch between Skills and Bossing stats:";
    tabDesc.style.fontStyle = "italic";
    playerContainer.appendChild(tabDesc);

    const tabContainer = document.createElement("div");
    tabContainer.classList.add("tab-container");
    tabContainer.style.marginBottom = "10px";

    const skillsTabBtn = document.createElement("button");
    skillsTabBtn.textContent = "Skills";
    skillsTabBtn.style.marginRight = "5px";
    skillsTabBtn.classList.add("active-tab");

    const bossesTabBtn = document.createElement("button");
    bossesTabBtn.textContent = "Bossing";

    tabContainer.appendChild(skillsTabBtn);
    tabContainer.appendChild(bossesTabBtn);
    playerContainer.appendChild(tabContainer);

    const contentContainer = document.createElement("div");
    playerContainer.appendChild(contentContainer);

    // --- Render Skills ---
    function renderSkills() {
        contentContainer.innerHTML = "";
        const table = document.createElement("table");
        table.classList.add("stats-table");
        table.innerHTML = `
            <tr>
                <th>Skill</th>
                <th>Level</th>
                <th>XP</th>
                <th>Δ XP</th>
            </tr>
        `;
        for (const [skill, info] of Object.entries(data.skills)) {
            const diff = info.xpDiff;
            const row = document.createElement("tr");
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

    // --- Render Bosses with Search, Recommendations + Pagination ---
    function renderBossingTab(data) {
    contentContainer.innerHTML = "";

    // --- Sub-tabs for Bossing ---
    const subTabContainer = document.createElement("div");
    subTabContainer.style.marginBottom = "10px";

    const bossesSubTabBtn = document.createElement("button");
    bossesSubTabBtn.textContent = "Bosses";
    bossesSubTabBtn.style.marginRight = "5px";
    bossesSubTabBtn.classList.add("active-tab"); // default selected

    const activitiesSubTabBtn = document.createElement("button");
    activitiesSubTabBtn.textContent = "Activities";

    subTabContainer.appendChild(bossesSubTabBtn);
    subTabContainer.appendChild(activitiesSubTabBtn);
    contentContainer.appendChild(subTabContainer);

    const tableContainer = document.createElement("div");
    contentContainer.appendChild(tableContainer);

    // Define mini-games / activities
    const activityNames = new Set([
        "Grid Points","League Points","Deadman Points",
        "Bounty Hunter - Hunter","Bounty Hunter - Rogue",
        "Bounty Hunter (Legacy) - Hunter","Bounty Hunter (Legacy) - Rogue",
        "Clue Scrolls (all)","Clue Scrolls (beginner)","Clue Scrolls (easy)",
        "Clue Scrolls (medium)","Clue Scrolls (hard)","Clue Scrolls (elite)",
        "Clue Scrolls (master)","LMS - Rank","PvP Arena - Rank",
        "Soul Wars Zeal","Rifts closed","Colosseum Glory"
    ]);

    const allBossEntries = Object.entries(data.bosses);
    const pageSize = 10;
    let currentPage = 0;
    let filteredEntries = allBossEntries;

    // --- Search Box + Dropdown ---
    const searchWrapper = document.createElement("div");
    searchWrapper.style.cssText = "position:relative; margin-bottom:10px;";

    const bossSearch = document.createElement("input");
    bossSearch.type = "text";
    bossSearch.placeholder = "Search boss...";
    bossSearch.style.cssText = `
        width: 100%;
        height: 30px;
        border: 2px solid #8b4513;
        border-radius: 5px;
        padding: 0 8px;
        font-family: rsFont;
        box-sizing: border-box;
    `;

    const dropdown = document.createElement("ul");
    dropdown.style.cssText = `
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background-color: #f8f5ee;
        border: 2px solid #8b4513;
        border-top: none;
        border-radius: 0 0 6px 6px;
        list-style: none;
        margin: 0;
        padding: 0;
        z-index: 50;
        display: none;
        max-height: 200px;
        overflow-y: auto;
    `;

    searchWrapper.appendChild(bossSearch);
    searchWrapper.appendChild(dropdown);
    contentContainer.appendChild(searchWrapper);

    const tableWrapper = document.createElement("div");
    contentContainer.appendChild(tableWrapper);

    // --- Dropdown & Search logic ---
    function showDropdown(query) {
        dropdown.innerHTML = "";
        if (!query) { dropdown.style.display = "none"; return; }

        const matches = allBossEntries
            .filter(([boss]) => boss.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 8);

        if (matches.length === 0) { dropdown.style.display = "none"; return; }

        matches.forEach(([boss]) => {
            const item = document.createElement("li");
            item.textContent = capitalize(boss);
            item.style.cssText = `
                padding: 6px 10px;
                cursor: pointer;
                font-family: rsFont;
                font-size: 0.9rem;
                border-bottom: 1px solid #d4b896;
            `;
            item.addEventListener("mouseenter", () => item.style.backgroundColor = "#e8d9c0");
            item.addEventListener("mouseleave", () => item.style.backgroundColor = "");
            item.addEventListener("mousedown", () => {
                bossSearch.value = capitalize(boss);
                dropdown.style.display = "none";
                filteredEntries = allBossEntries.filter(([b]) => b.toLowerCase() === boss.toLowerCase());
                currentPage = 0;
                renderTable(currentPage, subTabActive === "bosses");
            });
            dropdown.appendChild(item);
        });
        dropdown.style.display = "block";
    }

    bossSearch.addEventListener("input", () => {
        const query = bossSearch.value.trim();
        filteredEntries = query
            ? allBossEntries.filter(([boss]) => boss.toLowerCase().includes(query.toLowerCase()))
            : allBossEntries;
        currentPage = 0;
        showDropdown(query);
        renderTable(currentPage, subTabActive === "bosses");
    });

    bossSearch.addEventListener("blur", () => setTimeout(() => { dropdown.style.display = "none"; }, 150));
    bossSearch.addEventListener("focus", () => { if (bossSearch.value.trim()) showDropdown(bossSearch.value.trim()); });

    // --- Render Table with Pagination ---
    function renderTable(page, showActivities) {
        tableWrapper.innerHTML = "";
        currentPage = page;
        const filtered = filteredEntries.filter(([name]) => activityNames.has(name) === showActivities);
        const totalPages = Math.ceil(filtered.length / pageSize);

        const table = document.createElement("table");
        table.classList.add("stats-table");
        table.innerHTML = `
            <tr>
                <th>Name</th>
                <th>Rank</th>
                <th>Kills</th>
                <th>Δ Kills</th>
            </tr>
        `;

        if (filtered.length === 0) {
            const empty = document.createElement("tr");
            empty.innerHTML = `<td colspan="4" style="text-align:center; color:gray;">No entries found</td>`;
            table.appendChild(empty);
        } else {
            const start = page * pageSize;
            const pageSlice = filtered.slice(start, start + pageSize);
            pageSlice.forEach(([name, info]) => {
                const diff = info.killsDiff ?? 0;
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${capitalize(name)}</td>
                    <td>${info.rank === -1 ? "--" : formatNumber(info.rank)}</td>
                    <td title="${formatNumber(info.kills)}">${formatAbbrev(info.kills)}</td>
                    <td style="color:${getDiffColor(diff)}" title="${formatNumber(diff)}">${formatDiff(diff)}</td>
                `;
                table.appendChild(row);
            });
        }
        tableWrapper.appendChild(table);

        if (totalPages > 1) {
            const pagination = document.createElement("div");
            pagination.style.cssText = "display:flex; align-items:center; justify-content:center; gap:12px; margin-top:10px;";

            const prevBtn = document.createElement("button");
            prevBtn.textContent = "← Prev";
            prevBtn.disabled = page === 0;
            prevBtn.addEventListener("click", () => renderTable(currentPage - 1, showActivities));

            const pageLabel = document.createElement("span");
            pageLabel.textContent = `Page ${page + 1} of ${totalPages}`;
            pageLabel.style.fontFamily = "rsFont, sans-serif";

            const nextBtn = document.createElement("button");
            nextBtn.textContent = "Next →";
            nextBtn.disabled = page === totalPages - 1;
            nextBtn.addEventListener("click", () => renderTable(currentPage + 1, showActivities));

            pagination.appendChild(prevBtn);
            pagination.appendChild(pageLabel);
            pagination.appendChild(nextBtn);
            tableWrapper.appendChild(pagination);
        }
    }

    // --- Sub-tab button logic ---
    let subTabActive = "bosses"; // default
    function updateSubTabActive(selectedBtn, tabName) {
        [bossesSubTabBtn, activitiesSubTabBtn].forEach(btn => {
            btn.classList.remove("active-tab");
        });
        selectedBtn.classList.add("active-tab");
        subTabActive = tabName;
        currentPage = 0;
        renderTable(currentPage, tabName === "activities");
    }

    bossesSubTabBtn.addEventListener("click", () => updateSubTabActive(bossesSubTabBtn, "bosses"));
    activitiesSubTabBtn.addEventListener("click", () => updateSubTabActive(activitiesSubTabBtn, "activities"));

    // Initial render: show Bosses
    renderTable(currentPage, false);
}

    // --- Tab Switching ---
    function updateTabActive(selectedBtn) {
        [skillsTabBtn, bossesTabBtn].forEach(btn => {
            btn === selectedBtn
                ? btn.classList.add("active-tab")
                : btn.classList.remove("active-tab");
        });
    }

    skillsTabBtn.addEventListener("click", () => {
        updateTabActive(skillsTabBtn);
        renderSkills();
    });

    bossesTabBtn.addEventListener("click", () => {
        updateTabActive(bossesTabBtn);
        renderBossingTab(data);
    });

    // Initial render
    updateTabActive(skillsTabBtn);
    renderSkills();
}

function capitalize(word = "") {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

function normalizePlayerData(data) {
    const normalized = {
        username: data.username,
        skills: {},
        bosses: {}
    };

    for (const [skill, info] of Object.entries(data.skills)) {
        const xp = Number(info.xp ?? 0);
        const xpDiff = Number(info.xpDiff ?? 0);
        normalized.skills[skill] = {
            level: info.level === -1 ? 1 : Number(info.level ?? 1),
            xp: xp === -1 ? 0 : xp,
            xpDiff: xpDiff
        };
    }

    for (const [boss, info] of Object.entries(data.bosses)) {
        const kills = Number(info.kills ?? 0);
        const killsDiff = Number(info.killsDiff ?? 0);
        normalized.bosses[boss] = {
            kills: kills === -1 ? 0 : kills,
            rank: info.rank === -1 ? "--" : info.rank,
            killsDiff: killsDiff
        };
    }

    return normalized;
}

// --- Chat Logic ---
const chatBubble = document.getElementById('chatBubble');
const chatBox = document.getElementById('chatBox');
const chatClose = document.getElementById('chatClose');
const chatSend = document.getElementById('chatSend');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');

chatBubble.addEventListener('click', () => {
    chatBox.classList.toggle('open');
});

chatClose.addEventListener('click', () => {
    chatBox.classList.remove('open');
});

chatSend.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    const userMsg = document.createElement('div');
    userMsg.classList.add('chat-msg', 'user');
    userMsg.textContent = text;
    chatMessages.appendChild(userMsg);
    chatInput.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ─── State ───────────────────────────────────────────────
const conversationHistory = [];
let currentPlayerData = null;

// ─── Range selector (wire up to your existing UI if you have one) ─
// e.g. document.getElementById('rangeSelect').addEventListener('change', e => {
//   selectedRange = e.target.value;
// });

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

// Detect if the user typed a RS username (1–12 alphanumeric + spaces/hyphens)
function extractUsername(text) {
  const match = text.match(/\b([A-Za-z0-9 _-]{1,12})\b/);
  return match ? match[1].trim() : null;
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
  // Bare short input with no spaces treated as a username guess
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

// ─── Call Claude via your backend ────────────────────────
async function callClaude(userMessage) {
  conversationHistory.push({ role: 'user', content: userMessage });

  const res = await fetch('/api/chat', {
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
      // Step 1: fetch stats
      typingMsg.textContent = `Looking up ${username}…`;
      currentPlayerData = await fetchPlayerData(username);

      // Step 2: ask Claude to summarise them
      const reply = await callClaude(
        `I just looked up "${username}". Here are their stats for the last ${selectedRange}. Give me a friendly summary with the highlights.`
      );
      typingMsg.textContent = reply;

    } else {
      // Follow-up question or general chat — Claude already has player data in system prompt
      const reply = await callClaude(text);
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

// ─── Event listeners (unchanged from your original) ──────
chatBubble.addEventListener('click', () => chatBox.classList.toggle('open'));
chatClose.addEventListener('click', () => chatBox.classList.remove('open'));
chatSend.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });