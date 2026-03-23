require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Octokit } = require('octokit');
const bodyParser = require('body-parser');

// CONFIGURATION
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'lofaif1234';
const REPO_NAME = 'x1lpo29amacarbon';
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
    if (!db.mappings) db.mappings = []; // Ensure migration
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
    if (req.headers['authorization'] === ADMIN_HASH) return next();
    res.status(403).json({ success: false, error: 'Unauthorized' });
};

// API ROUTES
app.get('/api/data', (req, res) => res.json(getDB()));

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

// ROBLOX SCRIPT DELIVERY & DYNAMIC LOADER
app.get('/scripts/:file', (req, res) => {
    const db = getDB();
    const fileName = req.params.file;

    // SPECIAL: Dynamic entries for CSLoader.lua
    if (fileName === 'CSLoader.lua') {
        let lua = `-- Carbon Hub Dynamic Auto-Loader\n`;
        lua += `local placeId = game.PlaceId\nlocal groupId = nil\nif game.CreatorType == Enum.CreatorType.Group then groupId = game.CreatorId end\n\n`;

        const mappings = db.mappings || [];
        mappings.forEach((m, index) => {
            const conds = [];
            if (m.placeIds && m.placeIds.length > 0) {
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

        if (mappings.length > 0) {
            lua += `else\n`;
        }
        lua += `    local name = "Unknown"\n    pcall(function() name = game:GetService("MarketplaceService"):GetProductInfo(placeId).Name end)\n    game:GetService("StarterGui"):SetCore("SendNotification", { Title = "Not Supported", Text = name .. " is not supported yet", Duration = 5 })\n`;
        if (mappings.length > 0) {
            lua += `end\n`;
        }

        res.setHeader('Content-Type', 'text/plain');
        return res.send(lua);
    }

    const script = db.scripts.find(s => s.name === fileName);
    if (!script) return res.status(404).send('Script not found');
    res.setHeader('Content-Type', 'text/plain');
    res.send(script.content);
});

// REAL-TIME
io.on('connection', (socket) => {
    socket.emit('initial_data', getDB());
});

// START
syncFromGitHub().then(() => {
    server.listen(PORT, () => console.log(`[SERVER] Running at http://localhost:${PORT}`))
        .on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`[FATAL] Port ${PORT} is already in use! Close other terminals.`);
            } else {
                console.error("[SERVER] Error:", err.message);
            }
        });
});