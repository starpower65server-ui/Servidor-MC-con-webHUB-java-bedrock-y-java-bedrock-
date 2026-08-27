import { useState } from 'react';
import * as api from '../api/servers';

export default function Login({ onLoginSuccess }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username.trim() || !password) return;
        setLoading(true);
        setError(null);

        try {
            const data = await api.login(username.trim(), password);
            api.setToken(data.token);
            onLoginSuccess(data.user);
        } catch (err) {
            setError(err.message || 'Invalid login credentials');
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '80vh',
            padding: 'var(--space-md)'
        }}>
            <div className="card animate-in" style={{ maxWidth: 440, width: '100%', padding: 'var(--space-2xl)' }}>
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: 8, filter: 'drop-shadow(0 0 15px rgba(44, 212, 84, 0.5))' }}>
                        🛡️
                    </div>
                    <h2 className="app-logo" style={{ fontSize: '1.8rem' }}>
                        MC Server Manager
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
                        Panel de Acceso Protegido
                    </p>
                </div>

                {error && (
                    <div className="alert alert-error">
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="login-username">Usuario</label>
                        <input
                            id="login-username"
                            className="form-input"
                            type="text"
                            placeholder="Introduce tu usuario"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="login-password">Contraseña</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                id="login-password"
                                className="form-input"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                style={{ paddingRight: 44 }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: 10,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '1.1rem',
                                    opacity: 0.7,
                                    padding: 4
                                }}
                                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: 'var(--space-md)', padding: 'var(--space-md)' }}
                        disabled={loading || !username.trim() || !password}
                    >
                        {loading ? (
                            <>
                                <span className="loading-spinner"></span>
                                Iniciando sesión…
                            </>
                        ) : (
                            '🔐 Iniciar Sesión'
                        )}
                    </button>
                </form>

                <div style={{
                    marginTop: 'var(--space-xl)',
                    padding: 'var(--space-md)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    textAlign: 'center'
                }}>
                    <strong style={{ color: 'var(--mc-creeper-green)' }}>Acceso Inicial por Defecto:</strong><br />
                    Usuario: <code style={{ color: 'var(--text-primary)' }}>admin</code> &ensp;·&ensp; Contraseña: <code style={{ color: 'var(--text-primary)' }}>admin</code>
                </div>
            </div>
        </div>
    );
}
