import { useState, useEffect } from 'react';
import * as api from '../api/servers';

export default function GeyserManager({ server }) {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    const loadGeyserStatus = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getGeyserStatus(server.id);
            setStatus(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadGeyserStatus();
    }, [server.id]);

    const handleInstall = async () => {
        setActionLoading(true);
        setError(null);
        setSuccessMsg(null);
        try {
            const res = await api.installGeyser(server.id);
            setStatus(res.status);
            setSuccessMsg('✓ ¡GeyserMC y Floodgate instalados! Reinicia el servidor para activar el Cross-Play.');
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleUninstall = async () => {
        if (!window.confirm('¿Seguro que deseas desinstalar GeyserMC? Los jugadores de Bedrock ya no podrán conectarse.')) return;
        setActionLoading(true);
        setError(null);
        setSuccessMsg(null);
        try {
            const res = await api.uninstallGeyser(server.id);
            setStatus(res.status);
            setSuccessMsg('✓ GeyserMC ha sido desinstalado. Reinicia el servidor para aplicar los cambios.');
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (server.edition === 'bedrock') {
        return (
            <div className="card animate-in" style={{ marginTop: 'var(--space-md)' }}>
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-md)' }}>
                    🪨 Este servidor ya es nativo de <strong>Bedrock Edition</strong>. GeyserMC es exclusivo para servidores Java.
                </div>
            </div>
        );
    }

    return (
        <div className="card animate-in" style={{ marginTop: 'var(--space-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 'var(--space-md)' }}>
                <div>
                    <h3 className="card-title" style={{ fontSize: '1.2rem', marginBottom: 2 }}>
                        🌐 GeyserMC Cross-Play (Java + Bedrock Juntos)
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Permite que jugadores de Android, iOS, Windows 10/11, Xbox, PlayStation y Switch se unan a este servidor Java.
                    </p>
                </div>

                {status?.installed ? (
                    <span className="status-badge online" style={{ fontSize: '0.85rem' }}>
                        ✓ Cross-Play Activo
                    </span>
                ) : (
                    <span className="status-badge offline" style={{ fontSize: '0.85rem' }}>
                        ⚪ No instalado
                    </span>
                )}
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {successMsg && <div className="alert alert-success" style={{ background: 'rgba(34,197,94,0.15)', borderColor: '#22c55e', color: '#4ade80' }}>{successMsg}</div>}

            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
                    <span className="loading-spinner"></span> Comprobando estado de GeyserMC…
                </div>
            ) : (
                <>
                    {status?.installed ? (
                        <div style={{ padding: 'var(--space-md)', background: 'rgba(139,92,246,0.12)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(139,92,246,0.3)', marginBottom: 'var(--space-md)' }}>
                            <h4 style={{ color: '#a78bfa', fontSize: '0.95rem', fontWeight: 700, marginBottom: 6 }}>
                                📱 Información de Conexión para jugadores de Bedrock:
                            </h4>
                            <ul style={{ fontSize: '0.85rem', paddingLeft: 20, margin: 0, color: 'var(--text-secondary)' }}>
                                <li><strong>Dirección / IP:</strong> La misma IP o Dominio de este servidor.</li>
                                <li><strong>Puerto Bedrock:</strong> <code>19132</code> (UDP)</li>
                                <li><strong>Cuentas:</strong> Gracias a <strong>Floodgate</strong>, los jugadores de Bedrock entran sin necesitar cuenta de Java.</li>
                            </ul>
                        </div>
                    ) : null}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        {status?.installed ? (
                            <button
                                className="btn btn-danger btn-sm"
                                onClick={handleUninstall}
                                disabled={actionLoading}
                            >
                                {actionLoading ? 'Desinstalando…' : '🗑️ Desinstalar GeyserMC'}
                            </button>
                        ) : (
                            <button
                                className="btn btn-primary"
                                onClick={handleInstall}
                                disabled={actionLoading}
                                style={{ background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', borderColor: '#7c3aed' }}
                            >
                                {actionLoading ? (
                                    <><span className="loading-spinner" style={{ width: 16, height: 16 }}></span> Descargando GeyserMC + Floodgate…</>
                                ) : '⚡ Instalar GeyserMC (1-Clic)'}
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
