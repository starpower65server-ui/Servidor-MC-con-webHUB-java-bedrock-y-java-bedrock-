import { useState, useEffect } from 'react';
import * as api from '../api/servers';

export default function UserManagement({ currentUser }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Form state
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [newRole, setNewRole] = useState('user');
    const [creating, setCreating] = useState(false);
    const [successMsg, setSuccessMsg] = useState(null);

    // Change password modal state
    const [changeUser, setChangeUser] = useState(null); // { id, username }
    const [changePasswordVal, setChangePasswordVal] = useState('');
    const [showChangePasswordVal, setShowChangePasswordVal] = useState(false);
    const [updatingPassword, setUpdatingPassword] = useState(false);

    const loadUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.getUsers();
            setUsers(res.users || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (!newUsername.trim() || !newPassword) return;
        setCreating(true);
        setError(null);
        setSuccessMsg(null);

        try {
            await api.createUser(newUsername.trim(), newPassword, newRole);
            setSuccessMsg(`Cuenta "${newUsername.trim()}" creada con éxito.`);
            setNewUsername('');
            setNewPassword('');
            setShowNewPassword(false);
            setNewRole('user');
            loadUsers();
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleSavePasswordChange = async (e) => {
        e.preventDefault();
        if (!changeUser || !changePasswordVal.trim()) return;
        setUpdatingPassword(true);
        setError(null);

        try {
            await api.changeUserPassword(changeUser.id, changePasswordVal.trim());
            setSuccessMsg(`Contraseña de "${changeUser.username}" actualizada con éxito.`);
            setChangeUser(null);
            setChangePasswordVal('');
            setShowChangePasswordVal(false);
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err) {
            setError('Error al cambiar contraseña: ' + err.message);
        } finally {
            setUpdatingPassword(false);
        }
    };

    const handleDeleteUser = async (user) => {
        if (user.id === currentUser.id) {
            alert('No puedes eliminar tu propia cuenta mientras tienes sesión iniciada.');
            return;
        }
        if (!confirm(`¿Estás seguro de eliminar el usuario "${user.username}"?`)) return;

        try {
            await api.deleteUser(user.id);
            loadUsers();
        } catch (err) {
            setError('Error al eliminar: ' + err.message);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }} className="animate-in">
            {error && <div className="alert alert-error">{error}</div>}
            {successMsg && <div className="alert alert-info">✅ {successMsg}</div>}

            {/* Create User Form Card */}
            <div className="card">
                <h3 className="card-title">
                    👤 Crear Nueva Cuenta de Usuario
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 'var(--space-lg)' }}>
                    Como administrador, puedes registrar cuentas para tu equipo. El registro público está deshabilitado por seguridad.
                </p>

                <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)', alignItems: 'end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Nombre de Usuario</label>
                        <input
                            className="form-input"
                            type="text"
                            placeholder="ej. Alex, MinecraftAdmin..."
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Contraseña</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                className="form-input"
                                type={showNewPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                style={{ paddingRight: 40 }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                style={{
                                    position: 'absolute',
                                    right: 8,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    opacity: 0.7
                                }}
                                title={showNewPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                            >
                                {showNewPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Rol / Permisos</label>
                        <select
                            className="form-select"
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value)}
                        >
                            <option value="user">👤 Usuario Estándar</option>
                            <option value="admin">👑 Administrador</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={creating || !newUsername.trim() || !newPassword}
                    >
                        {creating ? 'Creando…' : '➕ Crear Cuenta'}
                    </button>
                </form>
            </div>

            {/* Existing Users Table */}
            <div className="card">
                <h3 className="card-title">
                    📋 Cuentas Registradas ({users.length})
                </h3>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: 'var(--space-lg)', color: 'var(--text-muted)' }}>
                        <span className="loading-spinner"></span> Cargando usuarios…
                    </div>
                ) : users.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 'var(--space-lg)', color: 'var(--text-muted)' }}>
                        No hay usuarios adicionales registrados.
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '12px 16px' }}>Usuario</th>
                                <th style={{ padding: '12px 16px' }}>Rol</th>
                                <th style={{ padding: '12px 16px' }}>Fecha de Registro</th>
                                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                                        {u.username}
                                        {u.id === currentUser.id && (
                                            <span style={{ fontSize: '0.75rem', color: 'var(--mc-creeper-green)', marginLeft: 8 }}>(Tú)</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <span className={`software-badge ${u.role === 'admin' ? 'forge' : 'paper'}`}>
                                            {u.role === 'admin' ? '👑 Admin' : '👤 Usuario'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                                        {new Date(u.createdAt).toLocaleDateString()}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => {
                                                    setChangeUser(u);
                                                    setChangePasswordVal('');
                                                    setShowChangePasswordVal(false);
                                                }}
                                                title="Cambiar contraseña de usuario"
                                            >
                                                🔑 Cambiar Contraseña
                                            </button>

                                            <button
                                                className="btn btn-secondary btn-sm"
                                                style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                                                onClick={() => handleDeleteUser(u)}
                                                disabled={u.id === currentUser.id}
                                                title="Eliminar usuario"
                                            >
                                                🗑️ Borrar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Change Password Modal */}
            {changeUser && (
                <div className="modal-backdrop">
                    <div className="modal card" style={{ maxWidth: 440, width: '90%' }}>
                        <h3 className="card-title">
                            🔑 Cambiar Contraseña: {changeUser.username}
                        </h3>
                        <form onSubmit={handleSavePasswordChange}>
                            <div className="form-group">
                                <label className="form-label">Nueva Contraseña</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        className="form-input"
                                        type={showChangePasswordVal ? 'text' : 'password'}
                                        placeholder="Introduce la nueva contraseña..."
                                        value={changePasswordVal}
                                        onChange={(e) => setChangePasswordVal(e.target.value)}
                                        required
                                        autoFocus
                                        style={{ paddingRight: 44 }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowChangePasswordVal(!showChangePasswordVal)}
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
                                        title={showChangePasswordVal ? 'Ocultar contraseña' : 'Ver contraseña'}
                                    >
                                        {showChangePasswordVal ? '🙈' : '👁️'}
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 'var(--space-lg)' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setChangeUser(null)}
                                    disabled={updatingPassword}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={updatingPassword || !changePasswordVal.trim()}
                                >
                                    {updatingPassword ? 'Guardando…' : '💾 Guardar Contraseña'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
