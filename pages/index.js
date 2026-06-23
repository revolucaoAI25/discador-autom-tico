import { useEffect, useState } from 'react';
import Head from 'next/head';
import Nav from '../components/Nav';

const RESULT_LABELS = {
  no_answer: 'Não atendeu',
  not_interested: 'Sem interesse',
  voicemail: 'Caixa postal',
  callback: 'Callback',
  interested: 'Interessado',
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch('/api/stats').then((r) => r.json()).then(setStats);
  }, []);

  return (
    <>
      <Head><title>Discador — Dashboard</title></Head>
      <Nav />
      <div className="container">
        <h2 style={{ marginBottom: 24 }}>Dashboard</h2>
        {!stats ? (
          <p style={{ color: '#64748b' }}>Carregando…</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 32 }}>
              {[
                { label: 'Total',        value: stats.contacts.total,        color: '#60a5fa' },
                { label: 'Pendentes',    value: stats.contacts.pending,      color: '#93c5fd' },
                { label: 'Ligados',      value: stats.contacts.called,       color: '#c4b5fd' },
                { label: 'Interessados', value: stats.contacts.interested,   color: '#86efac' },
                { label: 'Conversão',    value: `${stats.contacts.total > 0 ? ((stats.contacts.interested / stats.contacts.total) * 100).toFixed(1) : 0}%`, color: '#fbbf24' },
                { label: 'Total calls',  value: stats.calls.total_calls || 0, color: '#94a3b8' },
              ].map((s) => (
                <div key={s.label} className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="card">
              <h3 style={{ marginBottom: 16 }}>Últimos resultados</h3>
              {stats.recentOutcomes.length === 0 ? (
                <p style={{ color: '#64748b' }}>Nenhum resultado ainda.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Contato</th><th>Empresa</th><th>Resultado</th><th>Notas</th><th>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentOutcomes.map((o) => (
                      <tr key={o.id}>
                        <td>{o.name}</td>
                        <td>{o.company}</td>
                        <td><span className={`badge badge-${o.result}`}>{RESULT_LABELS[o.result] || o.result}</span></td>
                        <td style={{ color: '#94a3b8' }}>{o.notes}</td>
                        <td style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(o.created_at).toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
