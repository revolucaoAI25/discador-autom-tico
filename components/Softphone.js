import { useEffect, useRef, useState } from 'react';

export default function Softphone({ onCallConnected, onCallEnded }) {
  const deviceRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    let Device;
    async function init() {
      try {
        const mod = await import('@twilio/voice-sdk');
        Device = mod.Device;

        const res = await fetch('/api/token');
        const { token } = await res.json();

        const device = new Device(token, { logLevel: 1 });
        deviceRef.current = device;

        device.on('registered', () => setStatus('ready'));
        device.on('error', (err) => setError(err.message));
        device.on('incoming', (call) => {
          call.accept();
          setStatus('active');
          onCallConnected?.(call);
          call.on('disconnect', () => {
            setStatus('ready');
            onCallEnded?.();
          });
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

  return (
    <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
      Softphone:{' '}
      {status === 'loading' && <span>Inicializando…</span>}
      {status === 'ready'   && <span style={{ color: '#86efac' }}>● Pronto</span>}
      {status === 'active'  && <span style={{ color: '#fbbf24' }}>● Chamada ativa</span>}
      {status === 'error'   && <span style={{ color: '#fca5a5' }}>● Erro: {error}</span>}
    </div>
  );
}
