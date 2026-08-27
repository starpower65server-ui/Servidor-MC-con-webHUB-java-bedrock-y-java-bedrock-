import { useState, useEffect, useRef } from 'react';
import * as api from '../api/servers';

export default function FileManager({ server }) {
    const [currentPath, setCurrentPath] = useState(server.type === 'paper' ? 'plugins' : (server.type === 'fabric' || server.type === 'forge' ? 'mods' : ''));
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Upload state
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(null);
    const fileInputRef = useRef(null);

    // Text Editor Modal state
    const [editorFile, setEditorFile] = useState(null); // { relPath, content }
    const [editorContent, setEditorContent] = useState('');
    const [saving, setSaving] = useState(false);

    const loadFiles = async (path = currentPath) => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.listFiles(server.id, path);
            setFiles(res.files || []);
            setCurrentPath(res.currentPath || '');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFiles(currentPath);
    }, [server.id]);

    // Handle Upload
    const handleUploadFiles = async (fileList) => {
        if (!fileList || fileList.length === 0) return;
        setUploading(true);
        setError(null);
        try {
            for (let i = 0; i < fileList.length; i++) {
                const file = fileList[i];
                setUploadProgress(`Uploading ${file.name} (${i + 1}/${fileList.length})…`);
                await api.uploadFile(server.id, file, currentPath);
            }
            setUploadProgress('Upload complete!');
            setTimeout(() => setUploadProgress(null), 2000);
            loadFiles(currentPath);
        } catch (err) {
            setError('Upload failed: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    // Drag & Drop handlers
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleUploadFiles(e.dataTransfer.files);
        }
    };

    // Open File Editor
    const handleOpenFile = async (file) => {
        if (file.isDirectory) {
            loadFiles(file.relPath);
            return;
        }

        const editableExts = ['.properties', '.json', '.txt', '.yml', '.yaml', '.log', '.cfg', '.toml'];
        const isEditable = editableExts.some(ext => file.name.toLowerCase().endsWith(ext));

        if (!isEditable) return;

        setLoading(true);
        try {
            const data = await api.readFileContent(server.id, file.relPath);
            setEditorFile(file);
            setEditorContent(data.content || '');
        } catch (err) {
            setError('Could not open file: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Save File Editor
    const handleSaveFile = async () => {
        if (!editorFile) return;
        setSaving(true);
        try {
            await api.writeFileContent(server.id, editorFile.relPath, editorContent);
            setEditorFile(null);
            loadFiles(currentPath);
        } catch (err) {
            setError('Save failed: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Delete File
    const handleDeleteFile = async (file) => {
        if (!confirm(`Are you sure you want to delete "${file.name}"?`)) return;
        try {
            await api.deleteFile(server.id, file.relPath);
            loadFiles(currentPath);
        } catch (err) {
            setError('Failed to delete file: ' + err.message);
        }
    };

    // Breadcrumb Navigation
    const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : [];

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {error && <div className="alert alert-error">{error}</div>}

            {/* Top Toolbar & Quick Shortcuts */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                {/* Breadcrumbs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                        onClick={() => loadFiles('')}
                    >
                        🏠 Root
                    </button>
                    {pathParts.map((part, index) => {
                        const subPath = pathParts.slice(0, index + 1).join('/');
                        return (
                            <span key={subPath} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>/</span>
                                <button
                                    className="btn btn-secondary"
                                    style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                                    onClick={() => loadFiles(subPath)}
                                >
                                    {part}
                                </button>
                            </span>
                        );
                    })}
                </div>

                {/* Quick Shortcuts */}
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={() => loadFiles('mods')}
                    >
                        🧩 Mods Folder
                    </button>
                    <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={() => loadFiles('plugins')}
                    >
                        🔌 Plugins Folder
                    </button>
                    <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={() => handleOpenFile({ name: 'server.properties', relPath: 'server.properties' })}
                    >
                        📄 Edit server.properties
                    </button>
                </div>
            </div>

            {/* Drag & Drop Upload Dropzone */}
            <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                    border: '2px dashed var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-lg)',
                    textAlign: 'center',
                    background: 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => handleUploadFiles(e.target.files)}
                />
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>📥</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {uploading ? uploadProgress : `Drag & Drop .jar mods or plugins here to upload into /${currentPath || 'root'}`}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    or click to select files from your computer
                </div>
            </div>

            {/* File List Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: 'var(--space-lg)', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <span className="loading-spinner"></span> Loading files…
                    </div>
                ) : files.length === 0 ? (
                    <div style={{ padding: 'var(--space-lg)', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Folder is empty. Upload mods or plugins above!
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '12px 16px' }}>Name</th>
                                <th style={{ padding: '12px 16px', width: 120 }}>Size</th>
                                <th style={{ padding: '12px 16px', width: 80, textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {files.map((file) => {
                                const isJar = file.name.endsWith('.jar');
                                const isConfig = ['.properties', '.json', '.txt', '.yml', '.yaml'].some(ext => file.name.endsWith(ext));

                                return (
                                    <tr
                                        key={file.name}
                                        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)', cursor: file.isDirectory || isConfig ? 'pointer' : 'default' }}
                                        onClick={() => (file.isDirectory || isConfig) && handleOpenFile(file)}
                                    >
                                        <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span style={{ fontSize: '1.1rem' }}>
                                                {file.isDirectory ? '📁' : (isJar ? '🧩' : (isConfig ? '📄' : '📝'))}
                                            </span>
                                            <span style={{ color: file.isDirectory ? 'var(--accent-primary)' : 'var(--text-primary)', fontWeight: file.isDirectory ? 600 : 400 }}>
                                                {file.name}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                                            {file.isDirectory ? 'Directory' : formatBytes(file.size)}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                            <button
                                                className="btn btn-secondary"
                                                style={{ padding: '4px 8px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteFile(file);
                                                }}
                                                title="Delete file"
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal Text File Editor */}
            {editorFile && (
                <div className="modal-backdrop">
                    <div className="modal card" style={{ maxWidth: 800, width: '90%' }}>
                        <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>
                            📄 Editing {editorFile.name}
                        </h3>
                        <textarea
                            value={editorContent}
                            onChange={(e) => setEditorContent(e.target.value)}
                            style={{
                                width: '100%',
                                height: 380,
                                background: '#0a0d14',
                                color: '#e2e8f0',
                                fontFamily: 'Consolas, Monaco, monospace',
                                fontSize: '0.85rem',
                                padding: 12,
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-color)',
                                resize: 'vertical',
                                lineHeight: 1.4
                            }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 'var(--space-md)' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setEditorFile(null)}
                                disabled={saving}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleSaveFile}
                                disabled={saving}
                            >
                                {saving ? 'Saving…' : '💾 Save File'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
