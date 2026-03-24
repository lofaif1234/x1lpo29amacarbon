require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Octokit } = require('octokit');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

// CONFIGURATION
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'lofaif1234';
const REPO_NAME = 'x1lpo29amacarbon';
const JWT_SECRET = process.env.JWT_SECRET || "CARBON_STUDIOS_2026_CORE_SECURE";
const ADMIN_HASH = "b10b7769dfe6c5eaa5862ea22bee59a81a081ca97a0a7d3bee195f4e541f4428"; // melissa1i1i2i3ia82@!!a

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// GITHUB SYNC LOGIC
const octokit = GITHUB_TOKEN ? new Octokit({ auth: GITHUB_TOKEN }) : null;

async function syncFromGitHub() {
    if (!octokit) return console.log("[SYNC] No GitHub token. Using local data.");
    try {
        const { data: fileData } = await octokit.rest.repos.getContent({
            owner: REPO_OWNER, repo: REPO_NAME, path: 'data.json'
        });
        const content = Buffer.from(fileData.content, 'base64').toString();
        fs.writeFileSync(DATA_FILE, content);
        console.log("[SYNC] Pulled latest data.json from GitHub.");
    } catch (e) {
        console.log("[SYNC] Could not pull from GitHub, using local fallback.");
    }
}

async function pushToGitHub(filePath, content, message) {
    if (!octokit) return;
    try {
        let sha;
        try {
            const { data: fileData } = await octokit.rest.repos.getContent({
                owner: REPO_OWNER, repo: REPO_NAME, path: filePath
            });
            sha = fileData.sha;
        } catch (e) { }

        await octokit.rest.repos.createOrUpdateFileContents({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: filePath,
            message: message,
            content: Buffer.from(content).toString('base64'),
            sha: sha
        });
        console.log(`[SYNC] Pushed ${filePath} to GitHub.`);
    } catch (e) {
        console.error(`[SYNC] GitHub Push Error for ${filePath}:`, e.message);
    }
}

// DATA ACCESS
function getDB() {
    if (!fs.existsSync(DATA_FILE)) {
        return { executors: [], games: [], scripts: [], mappings: [] };
    }
    const db = JSON.parse(fs.readFileSync(DATA_FILE));
    if (!db.mappings) db.mappings = [];
    if (!db.scripts) db.scripts = [];
    return db;
}

function saveDB(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    pushToGitHub('data.json', JSON.stringify(data, null, 2), 'Auto-update data.json');
}

// MIDDLEWARE
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'docs')));

const adminAuth = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ error: 'No token provided' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired session. Login again.' });
    }
};

// HELPER: Simple SHA256 (matches admin frontend for consistency)
const crypto = require('crypto');
function computeHash(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
}

// API ROUTES
app.get('/api/data', (req, res) => res.json(getDB()));

app.post('/api/admin/login', (req, res) => {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'Missing key' });

    const keyHash = computeHash(key);
    if (keyHash === ADMIN_HASH) {
        const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token });
    } else {
        res.status(401).json({ success: false, error: 'Unauthorized' });
    }
});

app.post('/api/admin/save', adminAuth, (req, res) => {
    const { executors, games, mappings } = req.body;
    const db = getDB();
    if (executors) db.executors = executors;
    if (games) db.games = games;
    if (mappings) db.mappings = mappings;
    saveDB(db);
    io.emit('data_updated', db);
    res.json({ success: true });
});

app.post('/api/admin/add-script', adminAuth, async (req, res) => {
    const { name, content } = req.body;
    if (!name || !content) return res.status(400).json({ error: 'Missing name/content' });

    const db = getDB();
    const fileName = name.endsWith('.lua') ? name : name + '.lua';
    const newScript = { name: fileName, content, timestamp: new Date().toISOString() };

    const index = db.scripts.findIndex(s => s.name === fileName);
    if (index !== -1) db.scripts[index] = newScript;
    else db.scripts.push(newScript);

    saveDB(db);
    pushToGitHub(`scripts/${fileName}`, content, `Upload script: ${fileName}`);

    res.json({
        success: true,
        loadstring: `loadstring(game:HttpGet("https://carbonstudios.xyz/scripts/${fileName}"))()`
    });
});

// ROBLOX SCRIPT DELIVERY & BROWSER REDIRECT
app.get('/scripts/:file', (req, res) => {
    const ua = req.headers['user-agent'] || '';
    const isRoblox = ua.toLowerCase().includes('roblox');

    if (!isRoblox) {
        return res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Carbon Hub - Security</title>
                <style>
                    body { background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
                    .box { padding: 40px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; backdrop-filter: blur(10px); }
                    h1 { margin: 0; font-size: 24px; color: #ff3e3e; }
                    p { opacity: 0.7; margin: 15px 0; }
                    #timer { font-weight: bold; color: #ff3e3e; }
                </style>
            </head>
            <body>
                <div class="box">
                    <h1>Browser Detected</h1>
                    <p>This is a protected Roblox Script. It cannot be viewed in a browser.</p>
                    <p>Redirecting to home in <span id="timer">3</span> seconds...</p>
                </div>
                <script>
                    let s = 3;
                    const el = document.getElementById('timer');
                    const int = setInterval(() => {
                        s--; el.innerText = s;
                        if (s <= 0) { clearInterval(int); window.location.href = "https://carbonstudios.xyz/"; }
                    }, 1000);
                </script>
            </body>
            </html>
        `);
    }

    const db = getDB();
    const fileName = req.params.file;

    // SPECIAL: Dynamic CSLoader.lua
    if (fileName === 'CSLoader.lua') {
        let lua = `-- Carbon Hub Dynamic Auto-Loader\n`;
        lua += `local placeId = game.PlaceId\nlocal groupId = nil\nif game.CreatorType == Enum.CreatorType.Group then groupId = game.CreatorId end\n\n`;

        const mappings = db.mappings || [];
        mappings.forEach((m, index) => {
            const conds = [];
            if (m.placeIds) {
                m.placeIds.split(',').forEach(id => {
                    const cleanId = id.trim();
                    if (cleanId) conds.push(`placeId == ${cleanId}`);
                });
            }
            if (m.groupId) conds.push(`groupId == ${m.groupId}`);

            if (conds.length > 0) {
                lua += (index === 0 ? "if " : "elseif ") + conds.join(" or ") + " then\n";
                lua += `    loadstring(game:HttpGet("https://carbonstudios.xyz/scripts/${m.scriptName}"))()\n`;
            }
        });

        if (mappings.length > 0) lua += `else\n`;
        lua += `    local name = "Unknown"\n    pcall(function() name = game:GetService("MarketplaceService"):GetProductInfo(placeId).Name end)\n    game:GetService("StarterGui"):SetCore("SendNotification", { Title = "Not Supported", Text = name .. " is not supported yet", Duration = 5 })\n`;
        if (mappings.length > 0) lua += `end\n`;

        res.setHeader('Content-Type', 'text/plain');
        return res.send(lua);
    }

    const script = db.scripts.find(s => s.name === fileName);
    if (!script) return res.status(404).send('Script not found');
    res.setHeader('Content-Type', 'text/plain');
    res.send(script.content);
});

// START
syncFromGitHub().then(() => {
    server.listen(PORT, () => console.log(`[SERVER] Running at http://localhost:${PORT}`))
        .on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`[FATAL] Port ${PORT} is already in use!`);
            } else {
                console.error("[SERVER] Error:", err.message);
            }
        });
});