const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'obfuscated');
const EXCLUDE_LIST = ['node_modules', '.git', 'dist', 'obfuscated', 'obfuscate.js', 'obfuscate.py', '.vscode', '.github'];

const VERSION_TOKEN = Date.now();

function minifyHTML(content) {
    let minified = content
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/>\s+</g, '><')
        .replace(/\s{2,}/g, ' ')
        .trim();

    // Cache Busting: Add version to scripts and links
    minified = minified.replace(/src="([^"]+\.(js|png|jpg|jpeg|svg|webp))"/g, `src="$1?v=${VERSION_TOKEN}"`);
    minified = minified.replace(/href="([^"]+\.(css|png|jpg|jpeg|svg|webp))"/g, `href="$1?v=${VERSION_TOKEN}"`);

    return minified;
}

function minifyCSS(content) {
    return content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([{}:;,])\s*/g, '$1')
        .trim();
}

function obfuscateJS(content) {
    // 1. Minification (Safe comment removal)
    let processed = content
        .replace(/\/\*[\s\S]*?\*\//g, '') // Multi-line
        .split('\n')
        .map(line => {
            const commentIdx = line.indexOf('//');
            if (commentIdx !== -1 && line[commentIdx - 1] !== ':') {
                return line.slice(0, commentIdx);
            }
            return line;
        })
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    // 3. Selective Variable Mangling (Excluding known globals and key functions)
    const mangleMap = {
        'navItems': '_0x3a',
        'viewSections': '_0x4a', 'scrollReveal': '_0x7a', 'createBackgroundParticles': '_0x8a',
        'initCustomCursor': '_0x5a', 'renderAll': '_0x6a', 'startApp': '_0x9a', 'startAdmin': '_0xba'
    };
    for (const [key, val] of Object.entries(mangleMap)) {
        processed = processed.replace(new RegExp(`\\b${key}\\b`, 'g'), val);
    }

    // 4. Ensure global accessibility for key functions
    let windowExports = '';
    const exportTargets = {
        'initCustomCursor': '_0x5a',
        'renderAll': '_0x6a',
        'startApp': '_0x9a',
        'startAdmin': '_0xba',
        'deleteExecutor': 'deleteExecutor',
        'deleteGame': 'deleteGame',
        'sha256': 'sha256'
    };

    for (const [key, val] of Object.entries(exportTargets)) {
        if (content.includes(key)) {
            windowExports += `window['${key}'] = ${val};`;
        }
    }

    return `${processed};${windowExports}`.replace(/\n/g, '').trim();
}

function processDirectory(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        if (EXCLUDE_LIST.includes(entry.name)) continue;
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            processDirectory(srcPath, destPath);
        } else {
            const ext = path.extname(entry.name).toLowerCase();
            try {
                let content = fs.readFileSync(srcPath, 'utf8');
                if (ext === '.html') fs.writeFileSync(destPath, minifyHTML(content));
                else if (ext === '.css') fs.writeFileSync(destPath, minifyCSS(content));
                else if (ext === '.js') fs.writeFileSync(destPath, obfuscateJS(content));
                else fs.copyFileSync(srcPath, destPath);
            } catch (err) {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}

if (fs.existsSync(OUTPUT_DIR)) {
    const items = fs.readdirSync(OUTPUT_DIR);
    for (const item of items) {
        if (item === '.git') continue;
        const itemPath = path.join(OUTPUT_DIR, item);
        if (fs.statSync(itemPath).isDirectory()) fs.rmSync(itemPath, { recursive: true, force: true });
        else fs.unlinkSync(itemPath);
    }
} else {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

processDirectory(__dirname, OUTPUT_DIR);
console.log('Obfuscation complete.');
