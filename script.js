const searchButton = document.getElementById('searchButton');
const searchInput = document.getElementById('searchInput');
const playerContainer = document.getElementById('player-container');

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
            `https://runehelp.onrender.com/api/player/${encodeURIComponent(username)}`
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

function renderPlayer(data) {
    data = normalizePlayerData(data);
    playerContainer.innerHTML = "";

    if (!data || !data.skills) {
        playerContainer.innerHTML = "<p>No player data found</p>";
        return;
    }

    const header = document.createElement("h2");
    header.textContent = data.username || "Unknown Player";
    playerContainer.appendChild(header);

    // 🔹 Create tab buttons
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

    // 🔹 Create content container
    const contentContainer = document.createElement("div");
    playerContainer.appendChild(contentContainer);

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
        const diffColor = diff > 0 ? "green" : diff < 0 ? "red" : "gray";

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${capitalize(skill)}</td>
            <td>${info.level}</td>
            <td>${info.xp.toLocaleString()}</td>
            <td style="color:${diffColor}">
                ${diff > 0 ? "+" : ""}${diff.toLocaleString()}
            </td>
        `;

        table.appendChild(row);
    }

        contentContainer.appendChild(table);
    }

    // 🔹 Tab switching logic
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

    // Default tab
    renderSkills();
}

function capitalize(word = "") {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

function normalizePlayerData(data) {

    const normalized = { skills: {}, bosses: {} };

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


/* <------ Chat Script --------> */
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