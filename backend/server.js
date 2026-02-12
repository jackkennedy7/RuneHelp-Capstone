const express = require('express');

const app = express();
const PORT = 3000;

app.use(express.json());

app.get("/", (req, res) => {
    res.send("RuneHelp backend is running");
});

app.get("/api/player/:username", (req, res) => {
    const username = req.params.username;

    res.json({
        username: username,
        totalLevel: 2277
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});