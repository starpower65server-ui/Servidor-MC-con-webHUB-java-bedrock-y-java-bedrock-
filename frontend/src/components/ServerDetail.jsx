import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/servers';
import * as networkApi from '../api/network';
import ServerControls from './ServerControls';
import Console from './Console';
import FileManager from './FileManager';
import StatsChart from './StatsChart';

export default function ServerDetail({ server: initialServer, onBack }) {
    const [server, setServer] = useState(initialServer);
    const [activeTab, setActiveTab] = useState('console'); // 'console' | 'stats' | 'files'
    const [networkInfo, setNetworkInfo] = useState(null);
    const [copiedConn, setCopiedConn] = useState(false);

    useEffect(() => {
        networkApi.getNetworkInfo().then(setNetworkInfo).catch(() => { });
    }, []);

    // Poll server status every 3 seconds
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const updated = await api.getServer(server.id);
                setServer(updated);
            } catch { /* ignore */ }
        }, 3000);
        return () => clearInterval(interval);
    }, [server.id]);

    const handleStatusChange = useCallback((updated) => {
        setServer(updated);
    }, []);

    const statusLabel = () => {
        switch (server.status) {
            case 'online': return 'online';
            case 'starting': return 'starting';
            case 'stopping': return 'stopping';
            case 'error': return 'error';
            default: return 'offline';
        }
    };

    return (
        <div className="animate-in">
            <button className="back-link" onClick={onBack}>
                ← Back to servers
            </button>

            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{server.name}</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
                            {server.edition === 'bedrock' ? '🪨 BEDROCK EDITION' : `${server.type ? server.type.toUpperCase() : 'VANILLA'} Minecraft Server`}
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {(() => {
                            const host = networkInfo?.customDomain || networkInfo?.publicIp;
                            if (!host) return null;
                            const connAddress = server.edition === 'bedrock'
                                ? (server.port === 19132 ? host : `${host}:${server.port}`)
                                : (server.port === 25565 ? host : `${host}:${server.port}`);

                            const copyConn = () => {
                                navigator.clipboard.writeText(connAddress);
                                setCopiedConn(true);
                                setTimeout(() => setCopiedConn(false), 2000);
                            };

                            return (
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={copyConn}
                                    title={`Copiar dirección para tus amigos: ${connAddress}`}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                    <span>📋</span>
                                    <span>{copiedConn ? '¡Copiado!' : connAddress}</span>
                                </button>
                            );
                        })()}
                        <span className={`status-badge ${statusLabel()}`}>
                            <span className="status-dot"></span>
                            {statusLabel()}
                        </span>
                    </div>
                </div>

                <div className="server-info-grid">
                    <div className="server-info-item">
                        <div className="server-info-label">Version</div>
                        <div className="server-info-value">{server.version}</div>
                    </div>
                    <div className="server-info-item">
                        <div className="server-info-label">Port</div>
                        <div className="server-info-value">{server.port}</div>
                    </div>
                    <div className="server-info-item">
                        <div className="server-info-label">Edición</div>
                        <div className="server-info-value">
                            <span className={`software-badge ${server.edition === 'bedrock' ? 'forge' : 'fabric'}`}
                                style={server.edition === 'bedrock' ? { background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' } : {}}>
                                {server.edition === 'bedrock' ? '🪨 Bedrock' : '☕ Java'}
                            </span>
                        </div>
                    </div>
                    <div className="server-info-item">
                        <div className="server-info-label">Created</div>
                        <div className="server-info-value" style={{ fontSize: '0.9rem' }}>
                            {new Date(server.createdAt).toLocaleDateString()}
                        </div>
                    </div>
                </div>

                <ServerControls server={server} onStatusChange={handleStatusChange} />
            </div>

            {/* Tab Header Navigation */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
                <button
                    className={`btn ${activeTab === 'console' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('console')}
                >
                    📟 Console
                </button>
                <button
                    className={`btn ${activeTab === 'stats' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('stats')}
                >
                    📊 Rendimiento
                </button>
                <button
                    className={`btn ${activeTab === 'files' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('files')}
                >
                    📁 Files & Mods / Plugins
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'console' ? (
                <Console serverId={server.id} />
            ) : activeTab === 'stats' ? (
                <StatsChart server={server} />
            ) : (
                <FileManager server={server} />
            )}
        </div>
    );
}
