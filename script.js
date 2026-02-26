const searchButton = document.getElementById('searchButton');
const searchInput = document.getElementById('searchInput');
const playerContainer = document.getElementById('player-container');

searchButton.addEventListener('click', async () => {
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
        playerContainer.innerHTML = `<p style="color:red;">Error loading player</p>`;
        console.error(err);
    }
});

function renderPlayer(data) {
    data = normalizePlayerData(data);
    playerContainer.innerHTML = "";

    const header = document.createElement("h2");
    header.textContent = data.username;
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
                <td>${info.xp}</td>
                <td style="color:${diffColor}">
                    ${diff > 0 ? "+" : ""}${diff}
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
                <th>Kills</th>
                <th>Rank</th>
                <th>Δ Kills</th>
            </tr>
        `;

        for (const [boss, info] of Object.entries(data.bosses)) {

            const diff = info.killsDiff || 0;
            const diffColor = diff > 0 ? "green" : diff < 0 ? "red" : "gray";

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${boss}</td>
                <td>${info.kills}</td>
                <td>${info.rank}</td>
                <td style="color:${diffColor}">
                    ${diff > 0 ? "+" : ""}${diff}
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

function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

function normalizePlayerData(data) {

    const normalized = { skills: {}, bosses: {} };

    // ---- Normalize Skills ----
    for (const [skill, info] of Object.entries(data.skills)) {

        const level = info.level === -1 ? 1 : info.level;
        const xp = info.xp === -1 ? 0 : info.xp;

        normalized.skills[skill] = {
            level: level,
            xp: xp.toLocaleString(),
            xpDiff: (info.xpDiff || 0).toLocaleString()
        };
    }

    // ---- Normalize Bosses ----
    for (const [boss, info] of Object.entries(data.bosses)) {

        let rankFormatted;

        if (info.rank === -1 || info.rank === "--") {
            rankFormatted = "--";
        } else {
            rankFormatted = Number(info.rank).toLocaleString();
        }

        normalized.bosses[boss] = {
            kills: (info.kills === -1 ? 0 : info.kills).toLocaleString(),
            rank: rankFormatted,
            killsDiff: (info.killsDiff || 0).toLocaleString()
        };
    }

    return normalized;
}