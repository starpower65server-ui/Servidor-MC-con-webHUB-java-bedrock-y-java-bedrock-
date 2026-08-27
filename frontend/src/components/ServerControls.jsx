import { useState } from 'react';
import * as api from '../api/servers';

export default function ServerControls({ server, onStatusChange }) {
    const [acting, setActing] = useState(null);
    const [error, setError] = useState(null);

    const isOnline = server.status === 'online' || server.status === 'starting';
    const isOffline = server.status === 'offline' || server.status === 'error';

    const perform = async (action, fn) => {
        setActing(action);
        setError(null);
        try {
            await fn();
            // Fetch updated server info
            const updated = await api.getServer(server.id);
            onStatusChange(updated);
        } catch (err) {
            setError(err.message);
        } finally {
            setActing(null);
        }
    };

    return (
        <div>
            <div className="controls-row">
                <button
                    className="btn btn-green btn-sm"
                    disabled={!isOffline || acting}
                    onClick={() => perform('start', () => api.startServer(server.id))}
                >
                    {acting === 'start' ? (
                        <><span className="loading-spinner" style={{ width: 14, height: 14 }}></span> Starting…</>
                    ) : '▶ Start'}
                </button>

                <button
                    className="btn btn-outline btn-sm"
                    disabled={!isOnline || acting}
                    onClick={() => perform('stop', () => api.stopServer(server.id))}
                >
                    {acting === 'stop' ? (
                        <><span className="loading-spinner" style={{ width: 14, height: 14 }}></span> Stopping…</>
                    ) : '■ Stop'}
                </button>

                <button
                    className="btn btn-outline btn-sm"
                    disabled={!isOnline || acting}
                    onClick={() => perform('restart', () => api.restartServer(server.id))}
                >
                    {acting === 'restart' ? (
                        <><span className="loading-spinner" style={{ width: 14, height: 14 }}></span> Restarting…</>
                    ) : '↻ Restart'}
                </button>

                <button
                    className="btn btn-red btn-sm"
                    disabled={!isOnline || acting}
                    onClick={() => {
                        if (window.confirm('Force kill the server process? Unsaved data may be lost.')) {
                            perform('kill', () => api.killServer(server.id));
                        }
                    }}
                >
                    {acting === 'kill' ? (
                        <><span className="loading-spinner" style={{ width: 14, height: 14 }}></span> Killing…</>
                    ) : '✕ Kill'}
                </button>
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: 0 }}>{error}</div>}
        </div>
    );
}
