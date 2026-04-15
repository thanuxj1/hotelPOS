'use client';
import { useState, useEffect, useCallback } from 'react';
import { hotelApi, billingApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { BedDouble, CalendarCheck, TrendingUp, DollarSign, ArrowUp, Clock } from 'lucide-react';

const ROOM_STATUS_COLORS: Record<string, string> = {
  available: '#10b981',
  occupied: '#ef4444',
  reserved: '#f59e0b',
  maintenance: '#64748b',
  cleaning: '#8b5cf6',
};

const MOCK_OCCUPANCY = [
  { day: 'Mon', occupancy: 62 }, { day: 'Tue', occupancy: 75 },
  { day: 'Wed', occupancy: 68 }, { day: 'Thu', occupancy: 82 },
  { day: 'Fri', occupancy: 91 }, { day: 'Sat', occupancy: 95 },
  { day: 'Sun', occupancy: 78 },
];

const MOCK_REVENUE = [
  { day: 'Mon', revenue: 84000 }, { day: 'Tue', revenue: 112000 },
  { day: 'Wed', revenue: 97000 },  { day: 'Thu', revenue: 135000 },
  { day: 'Fri', revenue: 158000 }, { day: 'Sat', revenue: 172000 },
  { day: 'Sun', revenue: 124000 },
];

interface HotelStats {
  total_rooms: number;
  occupied: number;
  available: number;
  room_stats: Record<string, number>;
  check_ins_today: number;
  check_outs_today: number;
}
interface BillingStats {
  total_billed: number;
  total_collected: number;
  outstanding: number;
}

export default function DashboardPage() {
  const { hasPermission } = useAuthStore();
  const [hotelStats, setHotelStats] = useState<HotelStats | null>(null);
  const [billingStats, setBillingStats] = useState<BillingStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const [h, b] = await Promise.all([hotelApi.getStats(), billingApi.getStats()]);
      setHotelStats(h.data);
      setBillingStats(b.data);
    } catch { /* backend may not be seeded yet */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const occupancyRate = hotelStats
    ? Math.round(((hotelStats.occupied + (hotelStats.room_stats?.reserved ?? 0)) / Math.max(hotelStats.total_rooms, 1)) * 100)
    : 0;

  const pieData = hotelStats
    ? Object.entries(hotelStats.room_stats || {}).map(([status, count]) => ({ name: status, value: count }))
    : [];

  const kpis = [
    {
      label: 'Total Rooms', value: hotelStats?.total_rooms ?? '—',
      sub: `${hotelStats?.available ?? 0} available`, icon: BedDouble,
      color: 'var(--brand)', bg: 'var(--brand-dim)',
      perm: 'rooms:read'
    },
    {
      label: 'Occ. Rate', value: loading ? '—' : `${occupancyRate}%`,
      sub: `${hotelStats?.occupied ?? 0} occupied`, icon: TrendingUp,
      color: 'var(--accent-green)', bg: 'rgba(16,185,129,0.12)',
      perm: 'rooms:read'
    },
    {
      label: "Check-ins Today", value: hotelStats?.check_ins_today ?? '—',
      sub: `${hotelStats?.check_outs_today ?? 0} check-outs`, icon: CalendarCheck,
      color: 'var(--accent-yellow)', bg: 'rgba(245,158,11,0.12)',
      perm: 'reservations:read'
    },
    {
      label: 'Revenue Collected', value: billingStats ? `Rs.${(billingStats.total_collected / 1000).toFixed(0)}K` : '—',
      sub: `Rs.${((billingStats?.outstanding ?? 0) / 1000).toFixed(0)}K outstanding`, icon: DollarSign,
      color: 'var(--accent-purple)', bg: 'rgba(139,92,246,0.12)',
      perm: 'billing:read'
    },
  ].filter(k => !k.perm || hasPermission(k.perm));

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
        <div style={{ fontSize: '16px', fontWeight: 700 }}>{payload[0].value}%</div>
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Overview</h1>
          <p className="page-subtitle">Real-time hotel operations at a glance</p>
        </div>
        <button onClick={loadStats} className="btn btn-ghost" id="refresh-dashboard-btn">
          <Clock size={15} /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        {kpis.map(({ label, value, sub, icon: Icon, color, bg }) => (
          <div key={label} className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="stat-label">{label}</span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} style={{ color }} />
              </div>
            </div>
            <div className="stat-value" style={{ color }}>{String(value)}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowUp size={12} style={{ color: 'var(--accent-green)' }} />
              {sub}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: hasPermission('rooms:read') ? 'repeat(auto-fit, minmax(300px, 1fr))' : '1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Occupancy */}
        {hasPermission('rooms:read') && (
          <div className="card">
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '20px' }}>Weekly Occupancy Rate</div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={MOCK_OCCUPANCY}>
                  <defs>
                    <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="occupancy" stroke="#3b82f6" strokeWidth={2.5} fill="url(#occGrad)" dot={{ r: 4, fill: '#3b82f6' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Room Status Pie */}
        {hasPermission('rooms:read') && (
          <div className="card">
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '20px' }}>Room Status</div>
            <div className="chart-container" style={{ height: '240px' }}>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="40%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={4}>
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={ROOM_STATUS_COLORS[entry.name] || '#94a3b8'} stroke="none" />
                      ))}
                    </Pie>
                    <Legend
                      layout="vertical"
                      verticalAlign="middle"
                      align="right"
                      formatter={(value) => (
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'capitalize', fontWeight: 500 }}>{value}</span>
                      )}
                      iconType="circle"
                      iconSize={10}
                    />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '10px' }}
                      itemStyle={{ fontSize: '12px', textTransform: 'capitalize' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state" style={{ padding: '20px' }}>
                  <div className="spinner" />
                  <span style={{ fontSize: '13px' }}>No data yet</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Revenue Chart */}
      {hasPermission('billing:read') && (
        <div className="card">
          <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '20px' }}>Weekly Revenue (Rs.)</div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MOCK_REVENUE} barCategoryGap="35%">
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `Rs.${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  formatter={(v) => [`Rs.${Number(v).toLocaleString('en-IN')}`, 'Revenue']}
                  contentStyle={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '10px' }}
                  labelStyle={{ color: 'var(--text-muted)', fontSize: '12px' }}
                />
                <Bar dataKey="revenue" fill="url(#revGrad)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
