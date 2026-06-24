import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Nav from '../components/Nav';

const RESULT_LABELS = {
  no_answer:      'Não atendeu',
  not_interested: 'Sem interesse',
  voicemail:      'Caixa postal',
  callback:       'Callback',
  interested:     'Interessado',
};

const RESULT_BADGE = {
  no_answer:      'badge-no_answer',
  not_interested: 'badge-not_interested',
  voicemail:      'badge-no_answer',
  callback:       'badge-called',
  interested:     'badge-interested',
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  function load() {
    fetch('/api/stats').then((r) => r.json()).then(setStats);
  }

  useEffect(() => { load(); }, []);

  const c  = stats?.contacts  || {};
  const ca = stats?.calls     || {};
  const progress = c.total > 0 ? ((c.total - c.pending) / c.total) * 100 : 0;
  const convRate = c.total > 0 ? ((c.interested / c.total) * 100).toFixed(1) : '—';
  const avgMin   = ca.avg_duration
    ? `${Math.floor(ca.avg_duration / 60)}m ${ca.avg_duration % 60}s`
    : '—';

  return (
    <>
      <Head><title>Dashboard — Discador Pro</title></Head>
      <Nav />
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href="/agent">
              <button className="btn-primary" style={{ padding: '7px 16px' }}>→ Abrir agente</button>
            </Link>
            <button className="btn-secondary" onClick={load} style={{ padding: '7px 12px' }}>↺</button>
          </div>
        </div>

        {!stats ? (
          <p style={{ color: 'var(--text-3)' }}>Carregando…</p>
        ) : (
          <>
            {/* Stat cards */}
            <div className="stat-grid">
              {[
                { label: 'Total',         value: c.total ?? 0,     note: 'importados',        accent: false },
                { label: 'Na fila',       value: c.pending ?? 0,   note: 'aguardando',        accent: false },
                { label: 'Discados',      value: c.called ?? 0,    note: 'contactados',       accent: false },
                { label: 'Interessados',  value: c.interested ?? 0, note: 'leads quentes',    accent: true  },
                { label: 'Conversão',     value: `${convRate}%`,   note: 'taxa de sucesso',   accent: true  },
                { label: 'Duração média', value: avgMin,           note: 'por chamada',        accent: false },
              ].map((s) => (
                <div key={s.label} className="stat-card">
                  <div className={`stat-value${s.accent ? ' accent' : ''}`}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-note">{s.note}</div>
                </div>
              ))}
            </div>

            {/* Progress */}
            {c.total > 0 && (
              <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Progresso da fila
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {c.total - c.pending} / {c.total} discados
                  </span>
                </div>
                <div className="progress-wrap">
                  <div className="progress-bar" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {/* Status breakdown */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                Cadência de status
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { status: 'pending',        label: 'Pendente',      count: c.pending        },
                  { status: 'called',         label: 'Ligado',        count: c.called         },
                  { status: 'interested',     label: 'Interessado',   count: c.interested     },
                  { status: 'not_interested', label: 'Sem interesse', count: c.not_interested },
                  { status: 'no_answer',      label: 'Não atendeu',   count: c.no_answer      },
                ].map((s) => (
                  <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', flex: '1 1 140px' }}>
                    <span className={`badge badge-${s.status}`} style={{ gap: 0, padding: 0, background: 'none', border: 'none' }}>
                      <span className="badge-dot" />
                    </span>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1 }}>{s.count ?? 0}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent outcomes */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Últimos resultados</span>
              <Link href="/contacts" style={{ fontSize: 12, color: 'var(--text-3)' }}>Ver contatos →</Link>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Contato</th><th>Empresa</th><th>Resultado</th><th>Notas</th><th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats.recentOutcomes || []).length === 0 ? (
                    <tr><td colSpan={5} className="empty-state">Nenhum resultado ainda.</td></tr>
                  ) : stats.recentOutcomes.map((o) => (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 500 }}>{o.name}</td>
                      <td style={{ color: 'var(--text-2)' }}>{o.company || '—'}</td>
                      <td>
                        <span className={`badge ${RESULT_BADGE[o.result] || 'badge-no_answer'}`}>
                          <span className="badge-dot" />
                          {RESULT_LABELS[o.result] || o.result}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-3)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.notes || '—'}</td>
                      <td style={{ color: 'var(--text-3)', whiteSpace: 'nowrap', fontSize: 11 }}>{new Date(o.created_at).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
