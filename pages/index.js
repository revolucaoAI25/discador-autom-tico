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

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  function load() {
    fetch('/api/stats').then((r) => r.json()).then(setStats);
  }

  useEffect(() => { load(); }, []);

  const c  = stats?.contacts;
  const ca = stats?.calls;
  const convRate = c?.total > 0 ? ((c.interested / c.total) * 100).toFixed(1) : '0.0';
  const avgMin   = ca?.avg_duration ? `${Math.floor(ca.avg_duration / 60)}m ${ca.avg_duration % 60}s` : '—';

  return (
    <>
      <Head><title>Dashboard — Discador Pro</title></Head>
      <Nav />
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <button className="btn-ghost" onClick={load} style={{ fontSize: 12 }}>↺ Atualizar</button>
        </div>

        {!stats ? (
          <p style={{ color: 'var(--text-muted)' }}>Carregando…</p>
        ) : (
          <>
            <div className="stat-grid">
              {[
                { label: 'Total',         value: c.total,         note: 'contatos importados' },
                { label: 'Na fila',       value: c.pending,       note: 'aguardando discagem' },
                { label: 'Discados',      value: c.called,        note: 'já contactados' },
                { label: 'Interessados',  value: c.interested,    note: 'leads quentes' },
                { label: 'Conversão',     value: `${convRate}%`,  note: 'taxa de sucesso' },
                { label: 'Duração média', value: avgMin,          note: 'por chamada' },
              ].map((s) => (
                <div key={s.label} className="stat-card">
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{s.note}</div>
                </div>
              ))}
            </div>

            {/* Status bar */}
            {c.total > 0 && (
              <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Progresso da fila</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.total - c.pending} / {c.total}</span>
                </div>
                <div style={{ background: 'var(--bg-raised)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--green)', borderRadius: 6, width: `${((c.total - c.pending) / c.total) * 100}%`, transition: 'width 0.5s ease', boxShadow: '0 0 10px var(--green-glow)' }} />
                </div>
              </div>
            )}

            {/* Recent outcomes */}
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Últimos resultados</span>
              <Link href="/contacts" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>Ver todos →</Link>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Contato</th>
                    <th>Empresa</th>
                    <th>Resultado</th>
                    <th>Notas</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentOutcomes.length === 0 ? (
                    <tr><td colSpan={5} className="empty-state">Nenhum resultado ainda.</td></tr>
                  ) : stats.recentOutcomes.map((o) => (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 600 }}>{o.name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{o.company}</td>
                      <td><span className={`badge badge-${o.result}`}>{RESULT_LABELS[o.result] || o.result}</span></td>
                      <td style={{ color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.notes || '—'}</td>
                      <td style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(o.created_at).toLocaleString('pt-BR')}</td>
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
