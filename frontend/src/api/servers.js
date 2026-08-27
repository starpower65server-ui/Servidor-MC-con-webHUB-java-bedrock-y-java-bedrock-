const API_BASE = '/api';

export function getToken() {
    return localStorage.getItem('mc_auth_token');
}

export function setToken(token) {
    if (token) {
        localStorage.setItem('mc_auth_token', token);
    } else {
        localStorage.removeItem('mc_auth_token');
    }
}

export function removeToken() {
    localStorage.removeItem('mc_auth_token');
}

export async function fetchJson(url, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {})
    };

    const res = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

// ── Auth & User Management API ────────
export function login(username, password) {
    return fetchJson('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });
}

export function logout() {
    return fetchJson('/auth/logout', { method: 'POST' }).finally(() => removeToken());
}

export function getMe() {
    return fetchJson('/auth/me');
}

export function getUsers() {
    return fetchJson('/auth/users');
}

export function createUser(username, password, role = 'user') {
    return fetchJson('/auth/users', {
        method: 'POST',
        body: JSON.stringify({ username, password, role })
    });
}

export function changeUserPassword(id, newPassword) {
    return fetchJson(`/auth/users/${id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ newPassword })
    });
}

export function deleteUser(id) {
    return fetchJson(`/auth/users/${id}`, { method: 'DELETE' });
}

// ── Server & System API ───────────────
export function getJavaStatus() {
    return fetchJson('/java-status');
}

export function getJavaVersions(type = 'vanilla') {
    return fetchJson(`/versions/java?type=${type}`);
}

export function getBedrockVersions() {
    return fetchJson('/versions/bedrock');
}

export function getServers() {
    return fetchJson('/servers');
}

export function getServer(id) {
    return fetchJson(`/servers/${id}`);
}

export function createServer(name, version, type = 'vanilla', edition = 'java') {
    return fetchJson('/servers', {
        method: 'POST',
        body: JSON.stringify({ name, version, type, edition }),
    });
}

export async function createServerStream(name, version, type = 'vanilla', edition = 'java', onProgress) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    const response = await fetch(`${API_BASE}/servers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, version, type, edition })
    });

    if (!response.ok) {
        let errData;
        try { errData = await response.json(); } catch { }
        throw new Error(errData?.error || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalServer = null;

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
                try {
                    const data = JSON.parse(trimmed.slice(6));
                    if (data.type === 'progress') {
                        if (onProgress) onProgress(data.percent, data.stage);
                    } else if (data.type === 'done') {
                        finalServer = data.server;
                    } else if (data.type === 'error') {
                        throw new Error(data.error);
                    }
                } catch (e) {
                    if (e.message !== 'Unexpected end of JSON input') throw e;
                }
            }
        }
    }

    if (!finalServer) throw new Error('Server creation completed without returning server data.');
    return finalServer;
}

export function deleteServer(id) {
    return fetchJson(`/servers/${id}`, { method: 'DELETE' });
}

export function startServer(id) {
    return fetchJson(`/servers/${id}/start`, { method: 'POST' });
}

export function stopServer(id) {
    return fetchJson(`/servers/${id}/stop`, { method: 'POST' });
}

export function killServer(id) {
    return fetchJson(`/servers/${id}/kill`, { method: 'POST' });
}

export function restartServer(id) {
    return fetchJson(`/servers/${id}/restart`, { method: 'POST' });
}

export function sendCommand(id, command) {
    return fetchJson(`/servers/${id}/command`, {
        method: 'POST',
        body: JSON.stringify({ command }),
    });
}

export function getServerStats(id) {
    return fetchJson(`/servers/${id}/stats`);
}

export function getGeyserStatus(id) {
    return fetchJson(`/servers/${id}/geyser`);
}

export function installGeyser(id) {
    return fetchJson(`/servers/${id}/geyser/install`, {
        method: 'POST'
    });
}

export function uninstallGeyser(id) {
    return fetchJson(`/servers/${id}/geyser/uninstall`, {
        method: 'DELETE'
    });
}

// ── File Manager API ──────────────────

export function listFiles(serverId, path = '') {
    return fetchJson(`/servers/${serverId}/files?path=${encodeURIComponent(path)}`);
}

export function readFileContent(serverId, path) {
    return fetchJson(`/servers/${serverId}/files/content?path=${encodeURIComponent(path)}`);
}

export function writeFileContent(serverId, relPath, content) {
    return fetchJson(`/servers/${serverId}/files/content`, {
        method: 'PUT',
        body: JSON.stringify({ relPath, content }),
    });
}

export async function uploadFile(serverId, file, targetSubDir = '') {
    const token = getToken();
    const url = `${API_BASE}/servers/${serverId}/files/upload?name=${encodeURIComponent(file.name)}&path=${encodeURIComponent(targetSubDir)}`;
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: file
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
}

export function deleteFile(serverId, relPath) {
    return fetchJson(`/servers/${serverId}/files?path=${encodeURIComponent(relPath)}`, {
        method: 'DELETE'
    });
}
