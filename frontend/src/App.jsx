import { useState, useEffect } from 'react';
import * as api from './api/servers';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import CreateServer from './components/CreateServer';
import ServerDetail from './components/ServerDetail';
import NetworkSettings from './components/NetworkSettings';

export default function App() {
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    const [mainTab, setMainTab] = useState('servers'); // 'servers' | 'users'
    const [view, setView] = useState('list'); // 'list' | 'detail'
    const [servers, setServers] = useState([]);
    const [selectedServer, setSelectedServer] = useState(null);
    const [loading, setLoading] = useState(true);

    // Verify session on initial load
    useEffect(() => {
        const token = api.getToken();
        if (!token) {
            setAuthLoading(false);
            return;
        }

        api.getMe()
            .then((res) => {
                setUser(res.user);
                loadServers();
            })
            .catch(() => {
                api.removeToken();
                setUser(null);
            })
            .finally(() => setAuthLoading(false));
    }, []);

    const loadServers = async () => {
        try {
            const data = await api.getServers();
            setServers(data);
        } catch { /* ignore */ }
        setLoading(false);
    };

    const handleLoginSuccess = (loggedInUser) => {
        setUser(loggedInUser);
        loadServers();
    };

    const handleLogout = async () => {
        try { await api.logout(); } catch { }
        setUser(null);
        setSelectedServer(null);
        setView('list');
    };

    const handleCreated = (server) => {
        setSelectedServer(server);
        setView('detail');
        loadServers();
    };

    const handleSelectServer = (server) => {
        setSelectedServer(server);
        setView('detail');
    };

    const handleBack = () => {
        setView('list');
        setSelectedServer(null);
        loadServers();
    };

    const handleDelete = async (e, serverId) => {
        e.stopPropagation();
        if (!window.confirm('Delete this server and all its files? This cannot be undone.')) return;
        try {
            await api.deleteServer(serverId);
            loadServers();
        } catch { /* ignore */ }
    };

    if (authLoading) {
        return (
            <div className="loading-overlay" style={{ minHeight: '100vh' }}>
                <span className="loading-spinner" style={{ width: 32, height: 32 }}></span>
                <div className="loading-text">Verificando sesión…</div>
            </div>
        );
    }

    if (!user) {
        return <Login onLoginSuccess={handleLoginSuccess} />;
    }

    if (view === 'detail' && selectedServer) {
        return (
            <div className="app-container">
                <ServerDetail server={selectedServer} onBack={handleBack} />
            </div>
        );
    }

    return (
        <div className="app-container">
            {/* Header & User Navigation Bar */}
            <header className="app-header" style={{ paddingBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '1.2rem' }}>👤</span>
                        <span style={{ fontWeight: 600 }}>{user.username}</span>
                        <span className={`software-badge ${user.role === 'admin' ? 'forge' : 'paper'}`}>
                            {user.role === 'admin' ? '👑 Admin' : '👤 Usuario'}
                        </span>
                    </div>

                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleLogout}
                        style={{ color: 'var(--accent-red)' }}
                    >
                        🚪 Cerrar Sesión
                    </button>
                </div>

                <h1 className="app-logo">
                    <span className="app-logo-icon">⛏</span>
                    MC Server Manager
                </h1>
                <p className="app-subtitle">Crea y gestiona servidores de Minecraft de forma segura</p>

                {/* Main Navigation Tabs */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 'var(--space-lg)' }}>
                    <button
                        className={`btn ${mainTab === 'servers' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setMainTab('servers')}
                    >
                        🎮 Servidores
                    </button>
                    <button
                        className={`btn ${mainTab === 'network' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setMainTab('network')}
                    >
                        🌐 Red y Dominio
                    </button>
                    {user.role === 'admin' && (
                        <button
                            className={`btn ${mainTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setMainTab('users')}
                        >
                            👥 Gestión de Cuentas (Admin)
                        </button>
                    )}
                </div>
            </header>

            {/* Main Content Body */}
            {mainTab === 'users' && user.role === 'admin' ? (
                <UserManagement currentUser={user} />
            ) : mainTab === 'network' ? (
                <NetworkSettings />
            ) : (
                <>
                    {/* Existing Servers List */}
                    {!loading && servers.length > 0 && (
                        <div className="card animate-in" style={{ marginBottom: 'var(--space-xl)' }}>
                            <h2 className="card-title">📋&ensp;Tus Servidores</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                {servers.map((s) => (
                                    <div
                                        key={s.id}
                                        onClick={() => handleSelectServer(s)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: 'var(--space-md) var(--space-lg)',
                                            background: 'var(--bg-glass)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            transition: 'all var(--transition-fast)',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = 'var(--border-glow)';
                                            e.currentTarget.style.background = 'var(--bg-card-hover)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = 'var(--border-color)';
                                            e.currentTarget.style.background = 'var(--bg-glass)';
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                            <span className={`status-badge ${s.status}`}>
                                                <span className="status-dot"></span>
                                                {s.status}
                                            </span>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{s.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span>v{s.version}</span>
                                                    <span>·</span>
                                                    <span>Puerto {s.port}</span>
                                                    <span>·</span>
                                                    <span className={`software-badge ${s.type || 'vanilla'}`}>
                                                        {s.type === 'paper' ? '🔌 Paper' : (s.type === 'fabric' ? '🧩 Fabric' : (s.type === 'forge' ? '⚒️ Forge' : '☕ Vanilla'))}
                                                    </span>
                                                    <span>·</span>
                                                    <span className={`software-badge ${s.edition === 'bedrock' ? 'forge' : 'fabric'}`}
                                                        style={s.edition === 'bedrock' ? { background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' } : {}}>
                                                        {s.edition === 'bedrock' ? '🪨 Bedrock' : '☕ Java'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            className="btn btn-outline btn-sm"
                                            onClick={(e) => handleDelete(e, s.id)}
                                            style={{ color: 'var(--accent-red)', borderColor: 'rgba(239,68,68,0.2)' }}
                                        >
                                            🗑
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Create Server Form */}
                    <CreateServer onCreated={handleCreated} />
                </>
            )}
        </div>
    );
}
