import { useEffect, useRef, useState } from 'react';

async function fetchToken() {
  const res = await fetch('/api/token');
  const { token } = await res.json();
  return token;
}

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
    let destroyed = false;

    async function init() {
      try {
        const { Device } = await import('@twilio/voice-sdk');
        const token = await fetchToken();
        const device = new Device(token, { logLevel: 1 });
        deviceRef.current = device;

        device.on('registered', () => {
          console.log('[softphone] Device registered, identity:', device.identity, 'edge:', device.edge);
          setStatus('ready');
        });
        device.on('error', (err) => { setError(err.message); setStatus('error'); });

        // Access tokens expire (default ~1h). Without this, the Device silently
        // stops being able to receive calls while the UI still shows "conectado".
        device.on('tokenWillExpire', async () => {
          try {
            const freshToken = await fetchToken();
            if (!destroyed) device.updateToken(freshToken);
          } catch (e) {
            setError('Falha ao renovar token — recarregue a página');
            setStatus('error');
          }
        });

        // If the WebSocket registration drops for any other reason, surface it
        // instead of silently pretending everything's fine.
        device.on('unregistered', () => {
          if (!destroyed) setStatus('error');
        });

        device.on('incoming', (call) => {
          console.log('[softphone] incoming call received! parameters:', call.parameters);
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
    return () => { destroyed = true; deviceRef.current?.destroy(); };
  }, []);

  const map = {
    loading: { dot: 'sp-dot-gray',  label: 'Inicializando softphone…' },
    ready:   { dot: 'sp-dot-green', label: 'Softphone conectado' },
    ringing: { dot: 'sp-dot-amber', label: 'Conectando à sala…' },
    active:  { dot: 'sp-dot-amber', label: 'Na sala — aguardando/em ligação' },
    error:   { dot: 'sp-dot-red',   label: error ? `Erro: ${error}` : 'Desconectado — recarregue a página' },
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
