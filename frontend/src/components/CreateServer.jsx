import { useState, useEffect } from 'react';
import * as api from '../api/servers';

// Helper: get label & icon for software type
function typeLabel(type) {
    switch (type) {
        case 'paper': return '🔌 PaperMC';
        case 'fabric': return '🧩 Fabric';
        case 'forge': return '⚒️ Forge';
        default: return '☕ Vanilla';
    }
}

export default function CreateServer({ onCreated }) {
    const [edition, setEdition] = useState('java');   // 'java' | 'bedrock' | 'crossplay'
    const [name, setName] = useState('');
    const [type, setType] = useState('vanilla');
    const [version, setVersion] = useState('');
    const [versions, setVersions] = useState([]);
    const [latestVersion, setLatestVersion] = useState('');
    const [javaStatus, setJavaStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('');
    const [progressPercent, setProgressPercent] = useState(0);
    const [loadingVersions, setLoadingVersions] = useState(true);
    const [error, setError] = useState(null);

    // Fetch Java status once (only relevant for Java/Crossplay)
    useEffect(() => {
        api.getJavaStatus().then(setJavaStatus).catch(() => setJavaStatus({ installed: false }));
    }, []);

    // Fetch versions whenever edition or software type changes
    useEffect(() => {
        setLoadingVersions(true);
        setError(null);
        setVersion('');
        setVersions([]);

        const effectiveType = edition === 'crossplay' ? 'paper' : type;

        const fetchPromise = edition === 'bedrock'
            ? api.getBedrockVersions()
            : api.getJavaVersions(effectiveType);

        fetchPromise
            .then((data) => {
                setVersions(data.versions || []);
                setLatestVersion(data.latest || '');
                if (data.latest) setVersion(data.latest);
                setLoadingVersions(false);
            })
            .catch((err) => {
                setError(`Failed to load versions: ` + err.message);
                setLoadingVersions(false);
            });
    }, [edition, type]);

    const handleEditionChange = (newEdition) => {
        setEdition(newEdition);
        if (newEdition === 'bedrock') {
            setType('vanilla');
        } else if (newEdition === 'crossplay') {
            setType('paper');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim() || !version) return;
        setLoading(true);
        setError(null);
        setProgressPercent(0);

        const isCrossPlay = edition === 'crossplay';
        const actualEdition = isCrossPlay ? 'java' : edition;
        const actualType = isCrossPlay ? 'paper' : type;

        try {
            if (isCrossPlay) {
                setLoadingText('Paso 1/2: Descargando motor PaperMC…');
            } else if (edition === 'bedrock') {
                setLoadingText('Descargando ejecutable Bedrock Dedicated Server…');
            } else {
                setLoadingText(`Descargando servidor ${type.toUpperCase()}…`);
            }

            const server = await api.createServerStream(
                name.trim(),
                version,
                actualType,
                actualEdition,
                (percent) => {
                    setProgressPercent(percent);
                }
            );

            if (isCrossPlay) {
                setProgressPercent(0);
                setLoadingText('Paso 2/2: Descargando e instalando GeyserMC y Floodgate…');
                try {
                    await api.installGeyser(server.id);
                } catch (geyserErr) {
                    console.warn('[GeyserMC Auto-Install Warning]', geyserErr.message);
                }
            }

            setProgressPercent(100);
            setLoadingText('¡Servidor creado con éxito!');

            setTimeout(() => {
                onCreated(server);
            }, 300);

        } catch (err) {
            setError(err.message);
            setLoading(false);
            setProgressPercent(0);
        }
    };

    return (
        <div className="animate-in">
            {/* Java Status Banner — for Java or Cross-Play edition */}
            {edition !== 'bedrock' && (
                javaStatus === null ? (
                    <div className="java-banner loading">
                        <span className="loading-spinner"></span>
                        Comprobando estado de Java…
                    </div>
                ) : javaStatus.readyForMinecraft ? (
                    <div className="java-banner ok">
                        ✓&ensp;Java 25 preparado ({javaStatus.source === 'portable' ? 'Portátil auto-instalado' : `Sistema - v${javaStatus.version}`})
                    </div>
                ) : (
                    <div className="java-banner ok" style={{ background: 'rgba(99, 102, 241, 0.15)', borderColor: 'var(--accent-primary)' }}>
                        🚀&ensp;Java 25 portátil se descargará automáticamente al arrancar tu servidor (Sistema actual: Java {javaStatus.version || 'No detectado'})
                    </div>
                )
            )}

            {/* Bedrock info banner */}
            {edition === 'bedrock' && (
                <div className="java-banner ok" style={{ background: 'rgba(139, 92, 246, 0.15)', borderColor: '#8b5cf6' }}>
                    🪨&ensp;Bedrock Dedicated Server — Servidor nativo para Bedrock. No requiere Java.
                </div>
            )}

            {/* Cross-Play info banner */}
            {edition === 'crossplay' && (
                <div className="java-banner ok" style={{ background: 'rgba(236, 72, 153, 0.15)', borderColor: '#ec4899', color: '#f472b6' }}>
                    🌐&ensp;Cross-Play (Java + Bedrock) — Se creará un servidor PaperMC e instalará GeyserMC + Floodgate para que jueguen juntos desde PC, móvil y consolas.
                </div>
            )}

            <div className="card">
                <h2 className="card-title">
                    🆕&ensp;Crear Nuevo Servidor
                </h2>

                {error && (
                    <div className="alert alert-error">{error}</div>
                )}

                {loading ? (
                    <div className="loading-overlay" style={{ padding: 'var(--space-xl) var(--space-lg)' }}>
                        <div className="loading-spinner" style={{ width: 44, height: 44, borderWidth: 3.5, marginBottom: 'var(--space-md)' }}></div>

                        {/* Status Message */}
                        <div className="loading-text" style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
                            {loadingText}
                        </div>

                        {/* Animated Percentage Badge */}
                        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-primary)', margin: '4px 0' }}>
                            {progressPercent}%
                        </div>

                        {/* Visual Progress Bar */}
                        <div style={{
                            width: '100%',
                            maxWidth: 400,
                            height: 10,
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: 5,
                            overflow: 'hidden',
                            margin: 'var(--space-sm) auto var(--space-md) auto',
                            border: '1px solid var(--border-color)'
                        }}>
                            <div style={{
                                width: `${progressPercent}%`,
                                height: '100%',
                                background: edition === 'crossplay'
                                    ? 'linear-gradient(90deg, #db2777, #ec4899)'
                                    : edition === 'bedrock'
                                        ? 'linear-gradient(90deg, #7c3aed, #8b5cf6)'
                                        : 'linear-gradient(90deg, var(--accent-primary), #818cf8)',
                                transition: 'width 0.3s ease',
                                borderRadius: 5
                            }}></div>
                        </div>

                        <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            Descargando desde los servidores oficiales de Mojang / PaperMC / GeyserMC…
                        </small>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>

                        {/* ── Edition Selector ── */}
                        <div className="form-group">
                            <label className="form-label">Tipo / Edición de Servidor</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>

                                {/* Java Option */}
                                <button
                                    type="button"
                                    onClick={() => handleEditionChange('java')}
                                    style={{
                                        padding: '12px 10px',
                                        borderRadius: 'var(--radius-md)',
                                        border: `2px solid ${edition === 'java' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                        background: edition === 'java' ? 'rgba(99,102,241,0.18)' : 'var(--bg-glass)',
                                        color: edition === 'java' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                        fontWeight: edition === 'java' ? 700 : 400,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        fontSize: '0.9rem',
                                        textAlign: 'center'
                                    }}
                                >
                                    ☕ Java Edition
                                </button>

                                {/* Bedrock Option */}
                                <button
                                    type="button"
                                    onClick={() => handleEditionChange('bedrock')}
                                    style={{
                                        padding: '12px 10px',
                                        borderRadius: 'var(--radius-md)',
                                        border: `2px solid ${edition === 'bedrock' ? '#8b5cf6' : 'var(--border-color)'}`,
                                        background: edition === 'bedrock' ? 'rgba(139,92,246,0.18)' : 'var(--bg-glass)',
                                        color: edition === 'bedrock' ? '#a78bfa' : 'var(--text-secondary)',
                                        fontWeight: edition === 'bedrock' ? 700 : 400,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        fontSize: '0.9rem',
                                        textAlign: 'center'
                                    }}
                                >
                                    🪨 Bedrock Edition
                                </button>

                                {/* Cross-Play Option */}
                                <button
                                    type="button"
                                    onClick={() => handleEditionChange('crossplay')}
                                    style={{
                                        padding: '12px 10px',
                                        borderRadius: 'var(--radius-md)',
                                        border: `2px solid ${edition === 'crossplay' ? '#ec4899' : 'var(--border-color)'}`,
                                        background: edition === 'crossplay' ? 'rgba(236,72,153,0.18)' : 'var(--bg-glass)',
                                        color: edition === 'crossplay' ? '#f472b6' : 'var(--text-secondary)',
                                        fontWeight: edition === 'crossplay' ? 700 : 400,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        fontSize: '0.9rem',
                                        textAlign: 'center'
                                    }}
                                >
                                    🌐 Cross-Play (Java + Bedrock)
                                </button>
                            </div>
                        </div>

                        {/* ── Server Name ── */}
                        <div className="form-group">
                            <label className="form-label" htmlFor="server-name">Nombre del Servidor</label>
                            <input
                                id="server-name"
                                className="form-input"
                                type="text"
                                placeholder={edition === 'crossplay' ? 'Mi Servidor Crossplay' : 'Mi Servidor de Minecraft'}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                autoFocus
                                maxLength={64}
                            />
                        </div>

                        {/* ── Software Type (Java standard only) ── */}
                        {edition === 'java' && (
                            <div className="form-group">
                                <label className="form-label" htmlFor="server-type">Motor / Software</label>
                                <select
                                    id="server-type"
                                    className="form-select"
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                >
                                    <option value="vanilla">☕ Vanilla (Original Minecraft)</option>
                                    <option value="paper">🔌 PaperMC (Alto Rendimiento + Plugins)</option>
                                    <option value="fabric">🧩 Fabric (Ligero + Mods)</option>
                                    <option value="forge">⚒️ Forge (Mods Tradicionales)</option>
                                </select>
                            </div>
                        )}

                        {/* ── Version Selector ── */}
                        <div className="form-group">
                            <label className="form-label" htmlFor="server-version">
                                Versión de Minecraft
                            </label>
                            {loadingVersions ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                    <span className="loading-spinner"></span>
                                    Cargando versiones disponibles…
                                </div>
                            ) : (
                                <select
                                    id="server-version"
                                    className="form-select"
                                    value={version}
                                    onChange={(e) => setVersion(e.target.value)}
                                    required
                                >
                                    <option value="" disabled>Selecciona una versión</option>
                                    {versions.map((v) => (
                                        <option key={v.id} value={v.id}>
                                            {v.id}{v.id === latestVersion ? ' (última recomendada)' : ''}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={!name.trim() || !version}
                                style={
                                    edition === 'crossplay'
                                        ? { background: 'linear-gradient(135deg, #db2777, #ec4899)', borderColor: '#db2777' }
                                        : edition === 'bedrock'
                                            ? { background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', borderColor: '#7c3aed' }
                                            : {}
                                }
                            >
                                {edition === 'crossplay'
                                    ? `🌐 Crear Servidor Cross-Play`
                                    : edition === 'bedrock'
                                        ? `🪨 Crear Servidor Bedrock`
                                        : `⚡ Crear Servidor ${type.toUpperCase()}`}
                            </button>
                        </div>
                    </form>
                )}
            </div>

            <div style={{ marginTop: 'var(--space-lg)', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {edition === 'bedrock' ? (
                        <>
                            🪨 Al crear un servidor Bedrock se aceptan los Términos de Servidor Bedrock de Mojang.
                            <br />
                            <a href="https://www.minecraft.net/en-us/download/server/bedrock" target="_blank" rel="noopener" style={{ color: '#8b5cf6' }}>
                                Saber más sobre Bedrock Server
                            </a>
                        </>
                    ) : (
                        <>
                            ⚠️ Al crear un servidor Java o Cross-Play, el EULA de Minecraft se acepta automáticamente.
                            <br />
                            <a href="https://aka.ms/MinecraftEULA" target="_blank" rel="noopener" style={{ color: 'var(--accent-primary)' }}>
                                Leer el EULA de Minecraft
                            </a>
                        </>
                    )}
                </p>
            </div>
        </div>
    );
}
