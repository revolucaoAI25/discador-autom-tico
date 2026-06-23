import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Nav() {
  const { pathname } = useRouter();
  return (
    <nav className="nav">
      <h1>📞 Discador</h1>
      <Link href="/" className={pathname === '/' ? 'active' : ''}>Dashboard</Link>
      <Link href="/contacts" className={pathname === '/contacts' ? 'active' : ''}>Contatos</Link>
      <Link href="/agent" className={pathname === '/agent' ? 'active' : ''}>Agente</Link>
    </nav>
  );
}
