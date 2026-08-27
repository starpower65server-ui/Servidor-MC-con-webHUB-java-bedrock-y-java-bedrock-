import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to manage a WebSocket console connection for a server.
 */
export function useConsole(serverId) {
    const [lines, setLines] = useState([]);
    const [connected, setConnected] = useState(false);
    const wsRef = useRef(null);
    const reconnectTimer = useRef(null);

    const connect = useCallback(() => {
        if (!serverId) return;

        // Determine WebSocket URL based on current location
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const url = `${protocol}//${host}/ws?serverId=${serverId}`;

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            setConnected(true);
            console.log('[WS] Connected');
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'history') {
                    setLines(msg.lines.map((l) => ({ text: l, type: lineType(l) })));
                } else if (msg.type === 'console') {
                    setLines((prev) => {
                        const next = [...prev, { text: msg.data, type: lineType(msg.data) }];
                        // Keep last 500 lines in the browser
                        return next.length > 500 ? next.slice(-500) : next;
                    });
                } else if (msg.type === 'status') {
                    // Status changes are handled by polling; we could add a callback here
                }
            } catch { /* ignore parse errors */ }
        };

        ws.onclose = () => {
            setConnected(false);
            wsRef.current = null;
            // Try to reconnect after a delay
            reconnectTimer.current = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
            ws.close();
        };
    }, [serverId]);

    useEffect(() => {
        connect();
        return () => {
            clearTimeout(reconnectTimer.current);
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [connect]);

    const clearLines = useCallback(() => setLines([]), []);

    return { lines, connected, clearLines };
}

function lineType(text) {
    if (text.startsWith('>')) return 'command';
    if (/\bERROR\b/i.test(text) || /\[ERROR\]/i.test(text)) return 'error';
    if (/\bWARN\b/i.test(text)) return 'warn';
    return 'normal';
}
