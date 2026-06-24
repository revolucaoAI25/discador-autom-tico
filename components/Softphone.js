import { useEffect, useRef, useState } from 'react';

export default function Softphone({ onCallRinging, onCallConnected, onCallEnded }) {
  const deviceRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        const { Device } = await import('@twilio/voice-sdk');
        const res = await fetch('/api/token');
        const { token } = await res.json();
        const device = new Device(token, { logLevel: 1 });
        deviceRef.current = device;
        device.on('registered', () => setStatus('ready'));
        device.on('error', (err) => { setError(err.message); setStatus('error'); });
        device.on('incoming', (call) => {
          setStatus('ringing');
          onCallRinging?.();
          call.accept();
          call.on('accept', () => {
            setStatus('active');
            onCallConnected?.(call);
          });
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

  const map = {
    loading: { dot: 'sp-dot-gray',  label: 'Inicializando softphone…' },
    ready:   { dot: 'sp-dot-green', label: 'Softphone conectado' },
    ringing: { dot: 'sp-dot-amber', label: 'Chamando…' },
    active:  { dot: 'sp-dot-amber', label: 'Chamada ativa' },
    error:   { dot: 'sp-dot-red',   label: `Erro: ${error}` },
  };

  const cfg = map[status];

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
      <span className="sp-status">
        <span className={`sp-dot ${cfg.dot}`} />
        {cfg.label}
      </span>
    </div>
  );
}
