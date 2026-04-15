import os
import time
import json
import re
import shutil

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'obfuscated')
EXCLUDE_LIST = ['node_modules', '.git', 'dist', 'obfuscated', 'obfuscate.js', 'obfuscate.py', '.vscode', '.github', 'server.js', 'server.py', 'requirements.txt', 'venv', '.env']
VERSION_TOKEN = str(int(time.time() * 1000))

def minify_html(content):
    content = re.sub(r'<!--[\s\S]*?-->', '', content)
    content = re.sub(r'>\s+<', '><', content)
    content = re.sub(r'\s{2,}', ' ', content)
    content = re.sub(r'src="([^"]+\.(js|png|jpg|jpeg|svg|webp))"', f'src="\\1?v={VERSION_TOKEN}"', content)
    content = re.sub(r'href="([^"]+\.(css|png|jpg|jpeg|svg|webp))"', f'href="\\1?v={VERSION_TOKEN}"', content)
    return content.strip()

def minify_css(content):
    content = re.sub(r'\/\*[\s\S]*?\*\/', '', content)
    content = re.sub(r'\s+', ' ', content)
    content = re.sub(r'\s*([{}:;,])\s*', r'\1', content)
    return content.strip()

def obfuscate_js(content):
    processed = re.sub(r'\/\*[\s\S]*?\*\/', '', content)
    lines = processed.split('\n')
    new_lines = []
    for line in lines:
        comment_idx = line.find('//')
        if comment_idx != -1:
            if comment_idx == 0 or line[comment_idx-1] != ':':
                line = line[:comment_idx]
        new_lines.append(line)
    processed = ' '.join(new_lines)
    processed = re.sub(r'\s+', ' ', processed).strip()
    
    mangle_map = {
        'navItems': '_0x3a', 'viewSections': '_0x4a', 'scrollReveal': '_0x7a',
        'createBackgroundParticles': '_0x8a', 'initCustomCursor': '_0x5a',
        'renderAll': '_0x6a', 'startApp': '_0x9a', 'startAdmin': '_0xba'
    }
    for key, val in mangle_map.items():
        processed = re.sub(fr'\b{key}\b', val, processed)
        
    export_targets = ['initCustomCursor', 'renderAll', 'startApp', 'startAdmin', 'deleteExecutor', 'deleteGame', 'sha256']
    window_exports = ''
    for target in export_targets:
        if target in content:
            actual = mangle_map.get(target, target)
            window_exports += f"window['{target}'] = {actual};"
            
    return f"{processed};{window_exports}".replace('\n', '').strip()

def process_directory(src, dest):
    if not os.path.exists(dest): os.makedirs(dest)
    for item in os.listdir(src):
        if item in EXCLUDE_LIST: continue
        src_path = os.path.join(src, item)
        dest_path = os.path.join(dest, item)
        
        if os.path.isdir(src_path):
            process_directory(src_path, dest_path)
        else:
            ext = os.path.splitext(item)[1].lower()
            try:
                if ext == '.html':
                    with open(src_path, 'r', encoding='utf-8') as f:
                        with open(dest_path, 'w', encoding='utf-8') as df:
                            df.write(minify_html(f.read()))
                elif ext == '.css':
                    with open(src_path, 'r', encoding='utf-8') as f:
                        with open(dest_path, 'w', encoding='utf-8') as df:
                            df.write(minify_css(f.read()))
                elif ext == '.js':
                    with open(src_path, 'r', encoding='utf-8') as f:
                        with open(dest_path, 'w', encoding='utf-8') as df:
                            df.write(obfuscate_js(f.read()))
                else:
                    shutil.copy2(src_path, dest_path)
            except:
                shutil.copy2(src_path, dest_path)

if __name__ == '__main__':
    if os.path.exists(OUTPUT_DIR):
        for item in os.listdir(OUTPUT_DIR):
            if item == '.git': continue
            path = os.path.join(OUTPUT_DIR, item)
            if os.path.isdir(path): shutil.rmtree(path)
            else: os.remove(path)
    else:
        os.makedirs(OUTPUT_DIR)
        
    process_directory(os.path.dirname(__file__), OUTPUT_DIR)
    print('Obfuscation complete.')
