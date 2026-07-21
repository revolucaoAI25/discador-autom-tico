import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Nav() {
  const { pathname } = useRouter();
  return (
    <nav className="nav">
      <div className="nav-brand">
        <div className="nav-brand-icon">📞</div>
        <span className="nav-brand-name">Discador Pro</span>
      </div>
      <Link href="/" className={pathname === '/' ? 'active' : ''}>Dashboard</Link>
      <Link href="/contacts" className={pathname === '/contacts' ? 'active' : ''}>Contatos</Link>
      <Link href="/duplicates" className={pathname === '/duplicates' ? 'active' : ''}>Duplicados</Link>
      <Link href="/kanban" className={pathname === '/kanban' ? 'active' : ''}>Kanban</Link>
      <Link href="/queue" className={pathname === '/queue' ? 'active' : ''}>Fila</Link>
      <Link href="/agent" className={pathname === '/agent' ? 'active' : ''}>Agente</Link>
      <Link href="/settings" className={pathname === '/settings' ? 'active' : ''}>Config</Link>
    </nav>
  );
}
