'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import {
  LayoutDashboard, BedDouble, CalendarCheck, ShoppingCart,
  FileText, Settings, LogOut, Building2,
} from 'lucide-react';

const NAV = [
  {
    section: 'Main',
    items: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { href: '/dashboard/rooms', label: 'Rooms', icon: BedDouble, perm: 'rooms:read' },
      { href: '/dashboard/reservations', label: 'Reservations', icon: CalendarCheck, perm: 'reservations:read' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { href: '/dashboard/pos', label: 'POS Terminal', icon: ShoppingCart, perm: 'pos:read' },
      { href: '/dashboard/billing', label: 'Billing', icon: FileText, perm: 'billing:read' },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout, hasPermission } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    // Role-based root redirect
    if (pathname === '/dashboard' || pathname === '/dashboard/') {
      if (user?.role?.name === 'kitchen') {
        router.replace('/dashboard/pos');
        return;
      }
      if (user?.role?.name === 'housekeeping') {
        router.replace('/dashboard/rooms');
        return;
      }
    }

    // Strict route protection
    const allItems = NAV.flatMap(s => s.items);
    const currentItem = allItems.find(i => pathname === i.href || (i.href !== '/dashboard' && pathname.startsWith(i.href)));
    
    if (currentItem?.perm && !hasPermission(currentItem.perm)) {
      // Redirect to a safe page they have access to
      const allowed = allItems.find(i => !i.perm || hasPermission(i.perm));
      router.replace(allowed?.href || '/login');
    }
  }, [isAuthenticated, router, pathname, user, hasPermission]);

  if (!isAuthenticated) {
    return <div className="loading-page"><div className="spinner" /><p>Loading…</p></div>;
  }

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? 'U';

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Building2 size={18} color="#fff" />
          </div>
          <div>
            <div className="sidebar-logo-text">Hotel POS</div>
            <div className="sidebar-logo-sub">{user?.tenant_id ?? 'demo_hotel'}</div>
          </div>
        </div>

        {/* Navigation */}
        {NAV.map((section) => {
          // Filter items based on permissions
          const visibleItems = section.items.filter(item => 
            !item.perm || hasPermission(item.perm) || 
            (item.href === '/dashboard' && (hasPermission('rooms:read') || hasPermission('billing:read')))
          );
          
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.section} className="nav-section">
              <div className="nav-label">{section.section}</div>
              {visibleItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
                return (
                  <Link key={href} href={href} className={`nav-item ${active ? 'active' : ''}`}>
                    <Icon size={17} className="nav-icon" />
                    {label}
                  </Link>
                );
              })}
            </div>
          );
        })}

        {/* Footer */}
        <div className="sidebar-footer">
          {/* User info card */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px', marginBottom: '4px',
            background: 'var(--bg-raised)', borderRadius: 'var(--radius-md)',
          }}>
            <div style={{
              width: '36px', height: '36px', flexShrink: 0,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--brand), var(--accent-purple))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 700, color: '#fff',
            }}>{initials}</div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.full_name || user?.email}
              </div>
              <div style={{
                display: 'inline-block', marginTop: '2px',
                fontSize: '10px', fontWeight: 600, color: 'var(--brand-light)',
                background: 'var(--brand-dim)', borderRadius: '99px',
                padding: '1px 8px', textTransform: 'capitalize',
              }}>{user?.role?.name}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="nav-item"
            id="logout-btn"
            style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--accent-red)', marginTop: '2px' }}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {NAV.flatMap((s) => s.items).find((i) => pathname === i.href || (i.href !== '/dashboard' && pathname.startsWith(i.href))) && (
              <>
                {(() => {
                  const item = NAV.flatMap((s) => s.items).find((i) => pathname === i.href || (i.href !== '/dashboard' && pathname.startsWith(i.href)));
                  const Icon = item!.icon;
                  return <>
                    <Icon size={18} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '15px', fontWeight: 600 }}>{item!.label}</span>
                  </>;
                })()}
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </header>

        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}
