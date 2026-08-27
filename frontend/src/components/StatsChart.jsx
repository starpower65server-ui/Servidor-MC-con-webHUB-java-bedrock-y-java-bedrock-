import { useState, useEffect } from 'react';
import * as api from '../api/servers';

export default function StatsChart({ server }) {
    const [history, setHistory] = useState([]);
    const [currentStats, setCurrentStats] = useState({
        cpu: 0,
        ramMb: 0,
        totalRamMb: 8192,
        ramPercent: 0,
        online: false
    });

    useEffect(() => {
        let isMounted = true;

        // Fetch initial stats
        api.getServerStats(server.id).then(data => {
            if (isMounted && data) {
                setCurrentStats(data);
                setHistory(prev => [...prev.slice(-29), data]);
            }
        }).catch(() => { });

        // Poll stats every 2 seconds
        const interval = setInterval(async () => {
            try {
                const data = await api.getServerStats(server.id);
                if (isMounted && data) {
                    setCurrentStats(data);
                    setHistory(prev => [...prev.slice(-29), data]);
                }
            } catch { /* ignore */ }
        }, 2000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [server.id]);

    const maxHistoryPoints = 30;
    const historyData = history.length > 0 ? history : [currentStats];

    // Compute SVG path for CPU %
    const svgWidth = 500;
    const svgHeight = 150;
    const padding = 20;

    const pointsCpu = historyData.map((d, index) => {
        const x = padding + (index / (maxHistoryPoints - 1 || 1)) * (svgWidth - padding * 2);
        const y = svgHeight - padding - ((d.cpu || 0) / 100) * (svgHeight - padding * 2);
        return `${x},${y}`;
    }).join(' ');

    // Compute SVG path for RAM %
    const pointsRam = historyData.map((d, index) => {
        const x = padding + (index / (maxHistoryPoints - 1 || 1)) * (svgWidth - padding * 2);
        const y = svgHeight - padding - ((d.ramPercent || 0) / 100) * (svgHeight - padding * 2);
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="card animate-in" style={{ marginTop: 'var(--space-md)' }}>
            <h3 className="card-title" style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>📊 Rendimiento en Tiempo Real</span>
                <span className={`status-badge ${currentStats.online ? 'online' : 'offline'}`} style={{ fontSize: '0.75rem' }}>
                    {currentStats.online ? '🟢 Monitorizando' : '⚪ Servidor Apagado'}
                </span>
            </h3>

            {/* Instant Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)', margin: 'var(--space-md) 0' }}>

                {/* CPU Gauge */}
                <div style={{ padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Carga de CPU</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-primary)', marginTop: 4 }}>
                        {currentStats.online ? `${currentStats.cpu}%` : '0%'}
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, currentStats.cpu)}%`, height: '100%', background: 'var(--accent-primary)', transition: 'width 0.5s' }}></div>
                    </div>
                </div>

                {/* RAM Gauge */}
                <div style={{ padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Uso de Memoria RAM</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#4ade80', marginTop: 4 }}>
                        {currentStats.ramMb} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>MB</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {currentStats.ramPercent}% de {currentStats.totalRamMb} MB totales
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, currentStats.ramPercent)}%`, height: '100%', background: '#4ade80', transition: 'width 0.5s' }}></div>
                    </div>
                </div>
            </div>

            {/* Timeline SVG Chart */}
            <div style={{ position: 'relative', width: '100%', height: svgHeight, background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', padding: 10, border: '1px solid var(--border-color)' }}>
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>

                    {/* Grid lines */}
                    <line x1={padding} y1={padding} x2={svgWidth - padding} y2={padding} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                    <line x1={padding} y1={svgHeight / 2} x2={svgWidth - padding} y2={svgHeight / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                    <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="rgba(255,255,255,0.1)" />

                    {/* RAM Line */}
                    {pointsRam && (
                        <polyline
                            fill="none"
                            stroke="#4ade80"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={pointsRam}
                        />
                    )}

                    {/* CPU Line */}
                    {pointsCpu && (
                        <polyline
                            fill="none"
                            stroke="var(--accent-primary)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={pointsCpu}
                        />
                    )}
                </svg>

                {/* Legend */}
                <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', fontSize: '0.75rem', marginTop: 4 }}>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>● CPU (%)</span>
                    <span style={{ color: '#4ade80', fontWeight: 600 }}>● RAM (%)</span>
                </div>
            </div>
        </div>
    );
}
