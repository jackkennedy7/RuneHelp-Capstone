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

    const header = document.createElement("h2");
    header.textContent = `${data.username || "Unknown Player"} (${selectedRange})`;
    playerContainer.appendChild(header);

    const rangeContainer = document.createElement("div");
    rangeContainer.classList.add("range-container");

    const ranges = ["1h", "1d", "7d"];

    ranges.forEach(range => {
        const btn = document.createElement("button");
        btn.textContent = range;
        btn.classList.toggle("active-tab", range === selectedRange);

        btn.addEventListener("click", () => {
            selectedRange = range;

            // re-fetch player with new range
            searchPlayer();
        });
        rangeContainer.appendChild(btn);
    });

    playerContainer.appendChild(rangeContainer);

    const tabContainer = document.createElement("div");
    tabContainer.classList.add("tab-container");

    const skillsTabBtn = document.createElement("button");
    skillsTabBtn.textContent = "Skills";
    skillsTabBtn.classList.add("active-tab");

    const bossesTabBtn = document.createElement("button");
    bossesTabBtn.textContent = "Bossing";

    tabContainer.appendChild(skillsTabBtn);
    tabContainer.appendChild(bossesTabBtn);
    playerContainer.appendChild(tabContainer);

    const contentContainer = document.createElement("div");
    playerContainer.appendChild(contentContainer);
    rangeContainer.style.marginBottom = "10px";

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
                <td title="${formatNumber(info.xp)}">
                    ${formatAbbrev(info.xp)}
                </td>
                <td style="color:${getDiffColor(diff)}" title="${formatNumber(diff)}">
                    ${formatDiff(diff)}
                </td>
            `;
            table.appendChild(row);
        }

        contentContainer.appendChild(table);
    }

    function renderBosses() {
        contentContainer.innerHTML = "";

        const table = document.createElement("table");
        table.classList.add("stats-table");

        table.innerHTML = `
            <tr>
                <th>Boss</th>
                <th>Rank</th>
                <th>Kills</th>
                <th>Δ Kills</th>
            </tr>
        `;

        for (const [boss, info] of Object.entries(data.bosses)) {
            const diff = info.killsDiff ?? 0;
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${capitalize(boss)}</td>
                <td>
                    ${info.rank === "--" ? "--" : formatNumber(info.rank)}
                </td>
                <td title="${formatNumber(info.kills)}">
                    ${formatAbbrev(info.kills)}
                </td>
                <td style="color:${getDiffColor(diff)}" title="${formatNumber(diff)}">
                    ${formatDiff(diff)}
                </td>
            `;
            table.appendChild(row);
        }
        contentContainer.appendChild(table);
    }

    skillsTabBtn.addEventListener("click", () => {
        skillsTabBtn.classList.add("active-tab");
        bossesTabBtn.classList.remove("active-tab");
        renderSkills();
    });

    bossesTabBtn.addEventListener("click", () => {
        bossesTabBtn.classList.add("active-tab");
        skillsTabBtn.classList.remove("active-tab");
        renderBosses();
    });

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


// Chat logic
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