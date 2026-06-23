import { useEffect, useRef, useState } from 'react';

export default function Softphone({ onCallConnected, onCallEnded }) {
  const deviceRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        const mod = await import('@twilio/voice-sdk');
        const { Device } = mod;

        const res = await fetch('/api/token');
        const { token } = await res.json();

        const device = new Device(token, { logLevel: 1 });
        deviceRef.current = device;

        device.on('registered', () => setStatus('ready'));
        device.on('error', (err) => { setError(err.message); setStatus('error'); });
        device.on('incoming', (call) => {
          call.accept();
          setStatus('active');
          onCallConnected?.(call);
          call.on('disconnect', () => { setStatus('ready'); onCallEnded?.(); });
        });

        await device.register();
      } catch (e) {
        setError(e.message);
        setStatus('error');
      }
    }
    init();
    return () => deviceRef.current?.destroy();
  }, []);

  const configs = {
    loading: { cls: 'softphone-loading', dot: null,            label: 'Inicializando softphone…' },
    ready:   { cls: 'softphone-ready',   dot: 'pulse-green',   label: 'Softphone pronto' },
    active:  { cls: 'softphone-active',  dot: 'pulse-warning', label: 'Chamada ativa' },
    error:   { cls: 'softphone-error',   dot: null,            label: `Erro: ${error}` },
  };

  const cfg = configs[status];

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
      <span className={`softphone-status ${cfg.cls}`}>
        {cfg.dot && <span className={`pulse-dot ${cfg.dot}`} />}
        {cfg.label}
      </span>
    </div>
  );
}
