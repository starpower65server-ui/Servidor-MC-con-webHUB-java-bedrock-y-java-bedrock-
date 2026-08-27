import { useState, useEffect } from 'react';
import * as networkApi from '../api/network';

export default function NetworkSettings() {
    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);
    const [copiedIp, setCopiedIp] = useState(false);

    // Form inputs
    const [customDomain, setCustomDomain] = useState('');
    const [cfZoneId, setCfZoneId] = useState('');
    const [cfApiToken, setCfApiToken] = useState('');
    const [cfRecordName, setCfRecordName] = useState('');

    const loadNetworkInfo = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await networkApi.getNetworkInfo();
            setInfo(data);
            setCustomDomain(data.customDomain || '');
            setCfZoneId(data.cloudflare?.zoneId || '');
            setCfApiToken(data.cloudflare?.apiToken || '');
            setCfRecordName(data.cloudflare?.recordName || '');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadNetworkInfo();
    }, []);

    const handleSaveDomain = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccessMsg(null);
        try {
            const res = await networkApi.saveNetworkSettings({
                customDomain,
                cfZoneId,
                cfApiToken,
                cfRecordName
            });
            setInfo(res.networkInfo);
            setSuccessMsg('✓ Ajustes de red guardados correctamente');
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSyncCloudflare = async () => {
        setSyncing(true);
        setError(null);
        setSuccessMsg(null);
        try {
            const res = await networkApi.syncCloudflareDns();
            setInfo(res.networkInfo);
            setSuccessMsg(`✓ Cloudflare DNS actualizado con éxito (IP: ${res.ip})`);
        } catch (err) {
            setError(err.message);
        } finally {
            setSyncing(false);
        }
    };

    const copyIpToClipboard = () => {
        if (!info?.publicIp) return;
        navigator.clipboard.writeText(info.publicIp);
        setCopiedIp(true);
        setTimeout(() => setCopiedIp(false), 2000);
    };

    if (loading) {
        return (
            <div className="card animate-in" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                <span className="loading-spinner" style={{ width: 32, height: 32 }}></span>
                <div style={{ marginTop: 12, color: 'var(--text-muted)' }}>Detectando IP pública y estado de red…</div>
            </div>
        );
    }

    return (
        <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

            {/* Notifications */}
            {error && <div className="alert alert-error">{error}</div>}
            {successMsg && <div className="alert alert-success" style={{ background: 'rgba(34,197,94,0.15)', borderColor: '#22c55e', color: '#4ade80' }}>{successMsg}</div>}

            {/* ── Public IP Banner ── */}
            <div className="card" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.12))', borderColor: 'var(--accent-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>
                            🌐 Tu IP Pública Actual
                        </div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginTop: 4, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                            {info?.publicIp || 'No detectada'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary btn-sm" onClick={copyIpToClipboard} disabled={!info?.publicIp}>
                            {copiedIp ? '✓ ¡Copiada!' : '📋 Copiar IP'}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={loadNetworkInfo} title="Refrescar IP y estado DNS">
                            ↻ Refrescar
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Custom Domain Section ── */}
            <div className="card">
                <h3 className="card-title" style={{ fontSize: '1.2rem' }}>
                    🏷️ Dominio Personalizado
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--space-md)' }}>
                    Guarda aquí tu dominio o subdominio (ej: <code>mc.midominio.com</code>) para generar automáticamente las direcciones de conexión que enviarás a tus amigos.
                </p>

                <form onSubmit={handleSaveDomain}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="custom-domain">Nombre de Dominio / Subdominio</label>
                        <input
                            id="custom-domain"
                            className="form-input"
                            type="text"
                            placeholder="mc.midominio.com"
                            value={customDomain}
                            onChange={(e) => setCustomDomain(e.target.value)}
                        />
                    </div>

                    {/* DNS Status Indicator */}
                    {customDomain && (
                        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border-color)', marginBottom: 'var(--space-md)', fontSize: '0.875rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: '1.1rem' }}>
                                        {info?.isDomainMatching ? '🟢' : (info?.domainResolvedIp ? '🟡' : '🔴')}
                                    </span>
                                    <div>
                                        <strong>Estado DNS:</strong>{' '}
                                        {info?.isDomainMatching ? (
                                            <span style={{ color: '#4ade80' }}>¡Perfecto! El dominio apunta a tu IP pública actual ({info.publicIp}).</span>
                                        ) : info?.domainResolvedIp ? (
                                            <span style={{ color: '#facc15' }}>El dominio apunta a <code>{info.domainResolvedIp}</code> (Diferente a tu IP actual: <code>{info.publicIp}</code>).</span>
                                        ) : (
                                            <span style={{ color: '#f87171' }}>El dominio no se ha podido resolver en el DNS aún.</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Cloudflare DDNS Integration ── */}
                    <div style={{ marginTop: 'var(--space-lg)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-color)' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>☁️ Cloudflare DDNS (Actualización Automática de IP)</span>
                        </h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 'var(--space-md)' }}>
                            Opcional. Si usas Cloudflare para tu dominio, introduce tu API Token y Zone ID para que la web actualice tu registro A de Cloudflare automáticamente si cambia tu IP pública de casa.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-md)' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" htmlFor="cf-zone-id">Zone ID de Cloudflare</label>
                                <input
                                    id="cf-zone-id"
                                    className="form-input"
                                    type="text"
                                    placeholder="Ej: 3283294829384923"
                                    value={cfZoneId}
                                    onChange={(e) => setCfZoneId(e.target.value)}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" htmlFor="cf-api-token">API Token de Cloudflare</label>
                                <input
                                    id="cf-api-token"
                                    className="form-input"
                                    type="password"
                                    placeholder="Token con permiso Edit DNS"
                                    value={cfApiToken}
                                    onChange={(e) => setCfApiToken(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                            <label className="form-label" htmlFor="cf-record-name">Nombre de Registro A (opcional)</label>
                            <input
                                id="cf-record-name"
                                className="form-input"
                                type="text"
                                placeholder="Si se deja vacío usa el Dominio Personalizado"
                                value={cfRecordName}
                                onChange={(e) => setCfRecordName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-lg)', flexWrap: 'wrap', gap: 12 }}>
                        {info?.cloudflare?.configured ? (
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={handleSyncCloudflare}
                                disabled={syncing}
                            >
                                {syncing ? <><span className="loading-spinner" style={{ width: 14, height: 14 }}></span> Sincronizando…</> : '⚡ Sincronizar DNS en Cloudflare Ahora'}
                            </button>
                        ) : <div></div>}

                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Guardando…' : '💾 Guardar Ajustes de Red'}
                        </button>
                    </div>
                </form>
            </div>

            {/* ── Router Port Forwarding Guide ── */}
            <div className="card" style={{ background: 'var(--bg-glass)' }}>
                <h3 className="card-title" style={{ fontSize: '1.1rem' }}>
                    🔌 Puertos Requeridos en tu Router (Port Forwarding)
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 'var(--space-md)' }}>
                    Para que los jugadores fuera de tu casa puedan conectarse, debes abrir los siguientes puertos en tu Router hacia la IP local de tu ordenador:
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-md)' }}>
                    <div style={{ padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--accent-primary)', marginBottom: 4 }}>☕ Minecraft Java Edition</div>
                        <div style={{ fontSize: '0.85rem' }}>
                            • Puerto: <strong>25565</strong><br />
                            • Protocolo: <strong>TCP</strong>
                        </div>
                    </div>

                    <div style={{ padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#a78bfa', marginBottom: 4 }}>🪨 Minecraft Bedrock Edition</div>
                        <div style={{ fontSize: '0.85rem' }}>
                            • Puerto: <strong>19132</strong><br />
                            • Protocolo: <strong>UDP</strong>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
