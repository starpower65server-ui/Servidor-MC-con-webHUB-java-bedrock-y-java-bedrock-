import { useRef, useEffect, useState } from 'react';
import { useConsole } from '../hooks/useConsole';
import * as api from '../api/servers';

export default function Console({ serverId }) {
    const { lines, connected } = useConsole(serverId);
    const [command, setCommand] = useState('');
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const outputRef = useRef(null);
    const inputRef = useRef(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [lines]);

    const sendCmd = async (cmdStr) => {
        const cmd = cmdStr.trim();
        if (!cmd) return;
        try {
            await api.sendCommand(serverId, cmd);
            setHistory((prev) => [cmd, ...prev.slice(0, 49)]);
            setHistoryIndex(-1);
            setCommand('');
        } catch { /* ignore */ }
    };

    const handleSend = (e) => {
        e.preventDefault();
        sendCmd(command);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHistoryIndex((prev) => {
                const next = Math.min(prev + 1, history.length - 1);
                setCommand(history[next] || '');
                return next;
            });
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHistoryIndex((prev) => {
                const next = Math.max(prev - 1, -1);
                setCommand(next === -1 ? '' : history[next] || '');
                return next;
            });
        }
    };

    return (
        <div className="console-container animate-in">
            {/* Console Header & Quick Commands */}
            <div className="console-header" style={{ flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="console-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <div className="console-header-title">
                        <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: connected ? 'var(--mc-creeper-green)' : 'var(--mc-redstone-red)',
                            boxShadow: connected ? '0 0 10px var(--mc-creeper-green)' : 'none'
                        }}></span>
                        {connected ? 'Console Live' : 'Disconnected'}
                    </div>
                </div>

                {/* Quick Commands Bar */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn btn-quick" onClick={() => sendCmd('save-all')}>
                        ⚡ save-all
                    </button>
                    <button className="btn btn-quick" onClick={() => sendCmd('list')}>
                        👥 list
                    </button>
                    <button className="btn btn-quick" onClick={() => sendCmd('time set day')}>
                        ☀️ day
                    </button>
                    <button className="btn btn-quick" onClick={() => sendCmd('weather clear')}>
                        🌤️ clear weather
                    </button>
                </div>
            </div>

            {/* Console Output */}
            <div className="console-output" ref={outputRef}>
                {lines.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Server console output will appear here…
                    </div>
                ) : (
                    lines.map((line, i) => (
                        <div key={i} className={`console-line ${line.type}`}>
                            {line.text}
                        </div>
                    ))
                )}
            </div>

            {/* Console Command Input */}
            <form onSubmit={handleSend} className="console-input-wrapper">
                <span className="console-prompt">&gt;</span>
                <input
                    ref={inputRef}
                    className="console-input"
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a command (e.g. op PlayerName, gamemode creative)..."
                    autoComplete="off"
                    spellCheck={false}
                />
            </form>
        </div>
    );
}
