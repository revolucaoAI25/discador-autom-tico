import { useEffect, useRef, useState } from 'react';

// Every browser session gets its own Twilio Client identity — persisted per
// TAB (sessionStorage, not localStorage) so a reload keeps working mid-call
// but a different tab/device never collides with this one. Without this, all
// sessions shared one fixed identity and Twilio would ring EVERY connection
// registered under it — including a stale one left behind by a crashed tab,
// a dropped wifi, or a sleeping laptop — causing a real call to bridge into
// the wrong (or an extra) browser session at the same time.
function getSessionIdentity() {
  if (typeof window === 'undefined') return 'agent';
  const KEY = 'discador_agent_identity';
  let id = window.sessionStorage.getItem(KEY);
  if (!id) {
    id = `agent-${(crypto.randomUUID?.() || Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 20)}`;
    window.sessionStorage.setItem(KEY, id);
  }
  return id;
}

async function fetchToken(identity) {
  const res = await fetch(`/api/token?identity=${encodeURIComponent(identity)}`);
  const { token } = await res.json();
  return token;
}

export default function Softphone({ controlRef, onCallRinging, onCallConnected, onCallEnded }) {
  const deviceRef   = useRef(null);
  const callRef     = useRef(null);
  const acceptedRef = useRef(false);
  const identityRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [error, setError]   = useState(null);

  // Expose hangup + this session's identity to parent via controlRef
  useEffect(() => {
    if (controlRef) {
      controlRef.current = {
        hangup: () => callRef.current?.disconnect(),
        get identity() { return identityRef.current; },
      };
    }
  }, [controlRef]);

  useEffect(() => {
    let destroyed = false;

    async function init() {
      try {
        const { Device } = await import('@twilio/voice-sdk');
        const identity = getSessionIdentity();
        identityRef.current = identity;
        const token = await fetchToken(identity);
        const device = new Device(token, { logLevel: 1, edge: 'sao-paulo' });
        deviceRef.current = device;

        device.on('registered', () => setStatus('ready'));
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
          // Never bridge a second call on top of one already in progress — if
          // this ever fires while callRef is still set, it's a concurrency bug
          // upstream (e.g. two calls placed for the same agent identity) and
          // silently accepting it would mix two leads' audio into one call.
          if (callRef.current) {
            call.reject();
            return;
          }
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
    ringing: { dot: 'sp-dot-amber', label: 'Chamando…' },
    active:  { dot: 'sp-dot-amber', label: 'Chamada ativa' },
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
