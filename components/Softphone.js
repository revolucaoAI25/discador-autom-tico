import { useEffect, useRef, useState } from 'react';

export default function Softphone({ controlRef, onCallRinging, onCallConnected, onCallEnded }) {
  const deviceRef   = useRef(null);
  const callRef     = useRef(null);
  const acceptedRef = useRef(false);
  const [status, setStatus] = useState('loading');
  const [error, setError]   = useState(null);

  // Expose hangup to parent via controlRef
  useEffect(() => {
    if (controlRef) {
      controlRef.current = {
        hangup: () => callRef.current?.disconnect(),
      };
    }
  }, [controlRef]);

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
          callRef.current     = call;
          acceptedRef.current = false;
          setStatus('ringing');
          onCallRinging?.();
          call.accept();
          call.on('accept', () => {
            acceptedRef.current = true;
            setStatus('active');
            onCallConnected?.(call);
          });
          const finish = (wasAnswered) => {
            acceptedRef.current = false;
            callRef.current     = null;
            setStatus('ready');
            onCallEnded?.(wasAnswered);
          };
          call.on('disconnect', () => finish(acceptedRef.current));
          call.on('cancel',     () => finish(false));
          call.on('reject',     () => finish(false));
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
