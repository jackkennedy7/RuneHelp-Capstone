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
    playerContainer.innerHTML = "";

    const header = document.createElement("h2");
    header.textContent = data.username;
    playerContainer.appendChild(header);

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

    playerContainer.appendChild(table);
}

function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}