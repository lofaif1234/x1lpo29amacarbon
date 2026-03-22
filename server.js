require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Octokit } = require('octokit');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO_OWNER = 'melissaxe4-droid';
const GITHUB_REPO_NAME = 'carbonstudios';

// Security: License Hash from admin-logic.js
const LICENSE_HASH = "b10b7769dfe6c5eaa5862ea22bee59a81a081ca97a0a7d3bee195f4e541f4428";

// Middleware for Admin Auth
function adminAuth(req, res, next) {
    const auth = req.headers['authorization'];
    if (auth === LICENSE_HASH) {
        return next();
    }
    res.status(403).json({ error: 'Unauthorized' });
}

// Initialize data if not exists
if (!fs.existsSync(DATA_FILE)) {
    const defaultData = {
        executors: [
            { id: 1, name: 'Carbon API', status: 'Online', unc: '100%', sunc: '100%', type: 'Free' },
            { id: 2, name: 'Synapse Z', status: 'Updating', unc: '98%', sunc: '95%', type: 'Paid' }
        ],
        games: [
            { id: 1, title: 'Evade Overhaul', logo: 'https://tr.rbxcdn.com/39a6ba2c6e61298c4d29cae97ac471c2/768/432/Image/Png', link: 'https://www.roblox.com/games/7133251093/Evade', description: 'Features, Automatic Farm, Visual items, Name tag changer, Player modifications and 60+ more features.' }
        ],
        scripts: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
}

function getData() {
    return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// API: Get initial data
app.get('/api/data', (req, res) => {
    res.json(getData());
});

// Admin: Save Data
app.post('/api/admin/save', adminAuth, (req, res) => {
    const { executors, games } = req.body;
    const data = getData();
    if (executors) data.executors = executors;
    if (games) data.games = games;
    saveData(data);
    io.emit('data_updated', data); // Real-time update
    res.json({ success: true });
});

// Real-time Update via Socket
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    socket.emit('initial_data', getData());

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Script Handling (Loadstring redirection)
app.get('/scripts/:scriptName', (req, res) => {
    const userAgent = req.headers['user-agent'] || '';
    const isBrowser = /Mozilla|Chrome|Safari|Edge|Opera/i.test(userAgent);

    if (isBrowser) {
        // Redirection as requested
        return res.redirect('/');
    }

    // Find the script in our data
    const data = getData();
    const script = data.scripts.find(s => s.name === req.params.scriptName);

    if (script) {
        res.setHeader('Content-Type', 'text/plain');
        return res.send(script.content);
    }

    res.status(404).send('Script not found');
});

// Admin: Add script and push to GitHub
app.post('/api/admin/add-script', adminAuth, async (req, res) => {
    const { scriptName, scriptContent } = req.body;
    if (!scriptName || !scriptContent) return res.status(400).json({ error: 'Missing data' });

    const data = getData();
    const newScript = {
        name: scriptName.endsWith('.lua') ? scriptName : scriptName + '.lua',
        content: scriptContent,
        createdAt: new Date().toISOString()
    };

    // Update data
    const index = data.scripts.findIndex(s => s.name === newScript.name);
    if (index !== -1) data.scripts[index] = newScript;
    else data.scripts.push(newScript);
    saveData(data);

    // Attempt to push to GitHub
    if (GITHUB_TOKEN) {
        try {
            const octokit = new Octokit({ auth: GITHUB_TOKEN });
            const filePath = `scripts/${newScript.name}`;

            // Get file SHA if it exists
            let sha;
            try {
                const { data: fileData } = await octokit.rest.repos.getContent({
                    owner: GITHUB_REPO_OWNER,
                    repo: GITHUB_REPO_NAME,
                    path: filePath,
                });
                sha = fileData.sha;
            } catch (e) {
                // File doesn't exist yet
            }

            await octokit.rest.repos.createOrUpdateFileContents({
                owner: GITHUB_REPO_OWNER,
                repo: GITHUB_REPO_NAME,
                path: filePath,
                message: `Update script: ${newScript.name}`,
                content: Buffer.from(newScript.content).toString('base64'),
                sha: sha
            });
            console.log(`Pushed ${newScript.name} to GitHub.`);
        } catch (error) {
            console.error('GitHub Push Error:', error.message);
        }
    }

    res.json({
        success: true,
        loadstring: `loadstring(game:HttpGet("http://${req.headers.host}/scripts/${newScript.name}"))()`
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
