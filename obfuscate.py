import os
import re
import shutil

"""
Carbon Hub Python Obfuscator & Minifier
Processes the entire project and creates an 'obfuscated' folder ready for GitHub.
"""

OUTPUT_DIR = 'obfuscated'
EXCLUDE_LIST = ['node_modules', '.git', 'dist', 'obfuscated', 'obfuscate.js', 'obfuscate.py', '.vscode', '.github', '.gitignore', '.env']

def minify_html(content):
    # Remove comments
    content = re.sub(r'<!--[\s\S]*?-->', '', content)
    # Remove whitespace between tags
    content = re.sub(r'>\s+<', '><', content)
    # Collapse multiple spaces
    content = re.sub(r'\s{2,}', ' ', content)
    return content.strip()

def minify_css(content):
    # Remove comments
    content = re.sub(r'/\*[\s\S]*?\*/', '', content)
    # Collapse whitespace
    content = re.sub(r'\s+', ' ', content)
    # Remove spaces around delimiters
    content = re.sub(r'\s*([{}:;,])\s*', r'\1', content)
    return content.strip()

def obfuscate_js(content):
    # 1. Basic Minification
    content = re.sub(r'(?<!:)\/\/.*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'/\*[\s\S]*?\*/', '', content)
    content = re.sub(r'\s+', ' ', content)
    content = re.sub(r'\s*([=+\-*/%&|^!<>?:;,{}()\[\]])\s*', r'\1', content)
    
    # 2. String Array Protection
    strings = []
    string_map = {}
    
    # Placeholder for strings
    def collect_strings(match):
        str_val = match.group(0)[1:-1]
        if len(str_val) < 2 or '\\x' in str_val: return match.group(0)
        
        if str_val not in string_map:
            string_map[str_val] = len(strings)
            # Base64 encode
            import base64
            strings.append(base64.b64encode(str_val.encode()).decode())
        
        return f"__STR_{string_map[str_val]}__"

    # Only target " and ' strings
    temp = re.sub(r'([\'"])(?:(?=(\\?))\2.)*?\1', collect_strings, content)
    
    if not strings: return content

    import random
    import string
    
    pool_name = '_0x' + ''.join(random.choices(string.ascii_lowercase + string.digits, k=4))
    dec_name = '_0x' + ''.join(random.choices(string.ascii_lowercase + string.digits, k=4))
    seed = random.randint(10, 99)

    def inject_decoder(match):
        idx = int(match.group(1))
        return f"{dec_name}({idx + seed})"

    processed = re.sub(r'__STR_(\d+)__', inject_decoder, temp)

    # Rotation shift
    shift = seed % len(strings)
    
    obfuscated = f"""
const {pool_name} = [{", ".join([f"'{s}'" for s in strings])}];
(function(p, s) {{
    const r = function(c) {{
        while (--c) {{ p['push'](p['shift']()); }}
    }};
    r(s);
}})({pool_name}, {shift});
const {dec_name} = function(i) {{
    i = i - {seed};
    let s = {pool_name}[i];
    if (s === undefined) return '';
    return atob(s);
}};
{processed}
"""
    return obfuscated.replace("\n", "").strip()

def process_directory(src, dest):
    if not os.path.exists(dest):
        os.makedirs(dest)

    for item in os.listdir(src):
        if item in EXCLUDE_LIST:
            continue

        src_path = os.path.join(src, item)
        dest_path = os.path.join(dest, item)

        if os.path.isdir(src_path):
            process_directory(src_path, dest_path)
        else:
            _, ext = os.path.splitext(item)
            ext = ext.lower()

            try:
                if ext == '.html':
                    print(f"Minifying HTML: {item}")
                    with open(src_path, 'r', encoding='utf-8') as f:
                        content = minify_html(f.read())
                    with open(dest_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                elif ext == '.css':
                    print(f"Minifying CSS: {item}")
                    with open(src_path, 'r', encoding='utf-8') as f:
                        content = minify_css(f.read())
                    with open(dest_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                elif ext == '.js':
                    print(f"Obfuscating JS: {item}")
                    with open(src_path, 'r', encoding='utf-8') as f:
                        content = obfuscate_js(f.read())
                    with open(dest_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                else:
                    print(f"Copying asset: {item}")
                    shutil.copy2(src_path, dest_path)
            except Exception as e:
                print(f"Error processing {item}: {e}")
                shutil.copy2(src_path, dest_path)

def main():
    print("Starting full project obfuscation (Python)...")

    if os.path.exists(OUTPUT_DIR):
        print("Cleaning old obfuscated folder (preserving .git)...")
        for item in os.listdir(OUTPUT_DIR):
            if item == '.git': continue
            item_path = os.path.join(OUTPUT_DIR, item)
            if os.path.isdir(item_path):
                shutil.rmtree(item_path)
            else:
                os.remove(item_path)
    else:
        os.makedirs(OUTPUT_DIR)

    process_directory(os.getcwd(), OUTPUT_DIR)

    print("\nDone! Everything is in the /" + OUTPUT_DIR + " folder.")
    print("Tip: You can now upload the entire /obfuscated folder to GitHub.")

if __name__ == "__main__":
    main()
