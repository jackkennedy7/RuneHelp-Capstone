const searchButton = document.getElementById('searchButton');
const searchInput = document.getElementById('searchInput');

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

<<<<<<< Updated upstream
    playerContainer.appendChild(table);
=======
        contentContainer.appendChild(table);
    }

function renderBosses() {
    contentContainer.innerHTML = "";

    const allBossEntries = Object.entries(data.bosses);
    const pageSize = 10;
    let currentPage = 0;
    let filteredEntries = allBossEntries;

    // Search box
    const searchRow = document.createElement("div");
    searchRow.style.cssText = "display:flex; gap:8px; margin-bottom:10px;";

    const bossSearch = document.createElement("input");
    bossSearch.type = "text";
    bossSearch.placeholder = "Search boss...";
    bossSearch.style.cssText = "flex:1; height:30px; border:2px solid #8b4513; border-radius:5px; padding:0 8px; font-family:rsFont;";

    searchRow.appendChild(bossSearch);
    contentContainer.appendChild(searchRow);

    // Table wrapper (gets re-rendered on search/page change)
    const tableWrapper = document.createElement("div");
    contentContainer.appendChild(tableWrapper);

    bossSearch.addEventListener("input", () => {
        const query = bossSearch.value.trim().toLowerCase();
        filteredEntries = query
            ? allBossEntries.filter(([boss]) => boss.toLowerCase().includes(query))
            : allBossEntries;
        currentPage = 0;
        renderPage(currentPage);
    });

    function renderPage(page) {
        tableWrapper.innerHTML = "";
        currentPage = page;

        const totalPages = Math.ceil(filteredEntries.length / pageSize);

        const table = document.createElement("table");
        table.classList.add("stats-table");
        table.innerHTML = `
            <tr>
                <th>Boss</th>
                <th>Kills</th>
                <th>Δ Kills</th>
                <th>Rank</th>
            </tr>
        `;

        if (filteredEntries.length === 0) {
            const empty = document.createElement("tr");
            empty.innerHTML = `<td colspan="4" style="text-align:center; color:gray;">No bosses found</td>`;
            table.appendChild(empty);
        } else {
            const start = page * pageSize;
            const pageSlice = filteredEntries.slice(start, start + pageSize);

            for (const [boss, info] of pageSlice) {
                const diff = info.killsDiff ?? 0;
                const diffColor = diff > 0 ? "green" : diff < 0 ? "red" : "gray";

                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${capitalize(boss)}</td>
                    <td>${Number(info.kills ?? 0).toLocaleString()}</td>
                    <td style="color:${diffColor}">
                        ${diff > 0 ? "+" : ""}${Number(diff).toLocaleString()}
                    </td>
                    <td>${info.rank ?? "--"}</td>
                `;
                table.appendChild(row);
            }
        }

        tableWrapper.appendChild(table);

        // Pagination controls
        if (totalPages > 1) {
            const pagination = document.createElement("div");
            pagination.style.cssText = "display:flex; align-items:center; justify-content:center; gap:12px; margin-top:10px;";

            const prevBtn = document.createElement("button");
            prevBtn.textContent = "← Prev";
            prevBtn.disabled = page === 0;
            prevBtn.addEventListener("click", () => renderPage(currentPage - 1));

            const pageLabel = document.createElement("span");
            pageLabel.textContent = `Page ${page + 1} of ${totalPages}`;
            pageLabel.style.fontFamily = "rsFont, sans-serif";

            const nextBtn = document.createElement("button");
            nextBtn.textContent = "Next →";
            nextBtn.disabled = page === totalPages - 1;
            nextBtn.addEventListener("click", () => renderPage(currentPage + 1));

            pagination.appendChild(prevBtn);
            pagination.appendChild(pageLabel);
            pagination.appendChild(nextBtn);
            tableWrapper.appendChild(pagination);
        }
    }

    renderPage(currentPage);
>>>>>>> Stashed changes
}

function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}