import os
import json
import base64
import requests
from flask import Flask, jsonify, request, redirect, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='obfuscated')
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

DATA_FILE = os.path.join(os.path.dirname(__file__), 'data.json')
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')
GITHUB_REPO_OWNER = os.getenv('GITHUB_REPO_OWNER', 'melissaxe4-droid')
GITHUB_REPO_NAME = os.getenv('GITHUB_REPO_NAME', 'carbonstudios')
LICENSE_HASH = os.getenv('LICENSE_HASH')

def admin_auth(f):
    def wrapper(*args, **kwargs):   
        auth = request.headers.get('Authorization')
        if auth == LICENSE_HASH:
            return f(*args, **kwargs)
        return jsonify({'error': 'Unauthorized'}), 403
    wrapper.__name__ = f.__name__
    return wrapper

def get_data():
    if not os.path.exists(DATA_FILE):
        default_data = {
            "executors": [],
            "games": [],
            "scripts": []
        }
        with open(DATA_FILE, 'w') as f:
            json.dump(default_data, f, indent=2)
    with open(DATA_FILE, 'r') as f:
        return json.load(f)

def backup_data_json(data):
    if not GITHUB_TOKEN: return
    try:
        url = f"https://api.github.com/repos/{GITHUB_REPO_OWNER}/{GITHUB_REPO_NAME}/contents/data.json"
        headers = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}
        resp = requests.get(url, headers=headers)
        sha = resp.json().get('sha') if resp.status_code == 200 else None
        content = base64.b64encode(json.dumps(data, indent=2).encode('utf-8')).decode('utf-8')
        payload = {"message": "DWINADIANDA [skip ci]", "content": content}
        if sha: payload["sha"] = sha
        requests.put(url, headers=headers, json=payload)
    except: pass

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)
    backup_data_json(data)

def sync_from_github():
    if not GITHUB_TOKEN: return
    try:
        url = f"https://api.github.com/repos/{GITHUB_REPO_OWNER}/{GITHUB_REPO_NAME}/contents/data.json"
        headers = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}
        resp = requests.get(url, headers=headers)
        if resp.status_code == 200:
            content = base64.b64decode(resp.json()['content']).decode('utf-8')
            with open(DATA_FILE, 'w') as f:
                f.write(content)
    except: pass

@app.route('/api/data', methods=['GET'])
def api_get_data():
    return jsonify(get_data())

@app.route('/api/admin/save', methods=['POST'])
@admin_auth
def api_admin_save():
    req_data = request.json
    executors = req_data.get('executors')
    games = req_data.get('games')
    data = get_data()
    if executors is not None: data['executors'] = executors
    if games is not None: data['games'] = games
    save_data(data)
    socketio.emit('data_updated', data)
    return jsonify({'success': True})

@app.route('/api/admin/add-script', methods=['POST'])
@admin_auth
def api_admin_add_script():
    req_data = request.json
    name = req_data.get('scriptName')
    content = req_data.get('scriptContent')
    if not name or not content: return jsonify({'error': 'Missing data'}), 400
    if not name.endswith('.lua'): name += '.lua'
    data = get_data()
    new_script = {"name": name, "content": content}
    found = False
    for i, s in enumerate(data['scripts']):
        if s['name'] == name:
            data['scripts'][i] = new_script
            found = True
            break
    if not found: data['scripts'].append(new_script)
    save_data(data)
    socketio.emit('data_updated', data)
    if GITHUB_TOKEN:
        try:
            url = f"https://api.github.com/repos/{GITHUB_REPO_OWNER}/{GITHUB_REPO_NAME}/contents/scripts/{name}"
            headers = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}
            r = requests.get(url, headers=headers)
            sha = r.json().get('sha') if r.status_code == 200 else None
            payload = {"message": f"Update script: {name}", "content": base64.b64encode(content.encode()).decode()}
            if sha: payload["sha"] = sha
            requests.put(url, headers=headers, json=payload)
        except: pass
    return jsonify({
        'success': True,
        'loadstring': f'loadstring(game:HttpGet("http://{request.host}/scripts/{name}"))()'
    })

@app.route('/api/admin/delete-script', methods=['POST'])
@admin_auth
def api_admin_delete_script():
    name = request.json.get('scriptName')
    if not name: return jsonify({'error': 'Missing name'}), 400
    data = get_data()
    data['scripts'] = [s for s in data['scripts'] if s['name'] != name]
    save_data(data)
    socketio.emit('data_updated', data)
    if GITHUB_TOKEN:
        try:
            url = f"https://api.github.com/repos/{GITHUB_REPO_OWNER}/{GITHUB_REPO_NAME}/contents/scripts/{name}"
            headers = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}
            r = requests.get(url, headers=headers)
            if r.status_code == 200:
                sha = r.json().get('sha')
                requests.delete(url, headers=headers, json={"message": f"Delete script: {name}", "sha": sha})
        except: pass
    return jsonify({'success': True})

@app.route('/scripts/<path:filename>')
def serve_script(filename):
    ua = request.headers.get('User-Agent', '')
    if any(x in ua for x in ['Mozilla', 'Chrome', 'Safari', 'Edge', 'Opera']):
        return redirect('/')
    data = get_data()
    for s in data['scripts']:
        if s['name'] == filename:
            return s['content'], 200, {'Content-Type': 'text/plain'}
    return 'Script not found', 404

@app.route('/')
def serve_index():
    return send_from_directory('obfuscated', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('obfuscated', path)

@socketio.on('connect')
def handle_connect():
    emit('initial_data', get_data())

if __name__ == '__main__':
    sync_from_github()
    socketio.run(app, host='0.0.0.0', port=int(os.getenv('PORT', 3000)))
