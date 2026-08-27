import { fetchJson } from './servers';

export function getNetworkInfo() {
    return fetchJson('/network/info');
}

export function saveNetworkSettings(settings) {
    return fetchJson('/network/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
    });
}

export function syncCloudflareDns() {
    return fetchJson('/network/sync-dns', {
        method: 'POST'
    });
}
