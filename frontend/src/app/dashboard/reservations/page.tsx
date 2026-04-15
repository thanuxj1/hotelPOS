'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { hotelApi, billingApi } from '@/lib/api';
import { Plus, Search, RefreshCw, UserCheck, UserX, LogIn, LogOut, CalendarCheck } from 'lucide-react';

interface Guest { id: number; full_name: string; email?: string; phone?: string; id_type?: string; id_number?: string; }
interface Room { id: number; room_number: string; room_type?: { name: string; base_price: number }; status: string; }
interface Reservation {
  id: number; reservation_number: string;
  guest: Guest; room: Room;
  check_in_date: string; check_out_date: string;
  actual_check_in?: string; actual_check_out?: string;
  status: string; adults: number; children: number;
  room_rate?: number; total_nights?: number; total_room_charges?: number;
  special_requests?: string;
}

const STATUS_BADGE: Record<string, string> = {
  confirmed: 'badge-blue', checked_in: 'badge-green',
  checked_out: 'badge-gray', cancelled: 'badge-red', no_show: 'badge-yellow',
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 className="modal-title" style={{ margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function ReservationsPage() {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Create reservation modal
  const [showCreate, setShowCreate] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null);

  // Form state
  const [resForm, setResForm] = useState({
    guest_id: '', room_id: '', check_in_date: '', check_out_date: '', adults: '1', children: '0', special_requests: '',
  });
  const [guestForm, setGuestForm] = useState({ full_name: '', email: '', phone: '', id_type: 'passport', id_number: '' });
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [saving, setSaving] = useState(false);
  const [guestSearch, setGuestSearch] = useState('');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [res, g, r] = await Promise.all([
        hotelApi.getReservations(filterStatus || undefined),
        hotelApi.getGuests(),
        hotelApi.getRooms('available'),
      ]);
      setReservations(res.data);
      setGuests(g.data);
      setRooms(r.data);
    } catch { showToast('Failed to load data', 'error'); }
    finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { loadData(); }, [loadData]);

  // Check availability when dates change
  async function checkAvailability() {
    if (!resForm.check_in_date || !resForm.check_out_date) return;
    try {
      const res = await hotelApi.checkAvailability(resForm.check_in_date, resForm.check_out_date);
      setAvailableRooms(res.data);
    } catch { setAvailableRooms([]); }
  }
  useEffect(() => { checkAvailability(); }, [resForm.check_in_date, resForm.check_out_date]); // eslint-disable-line

  async function handleCreateReservation() {
    setSaving(true);
    try {
      await hotelApi.createReservation({ ...resForm, guest_id: Number(resForm.guest_id), room_id: Number(resForm.room_id), adults: Number(resForm.adults), children: Number(resForm.children) });
      showToast('Reservation created!');
      setShowCreate(false);
      setResForm({ guest_id: '', room_id: '', check_in_date: '', check_out_date: '', adults: '1', children: '0', special_requests: '' });
      loadData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to create reservation';
      showToast(msg, 'error');
    } finally { setSaving(false); }
  }

  async function handleCreateGuest() {
    setSaving(true);
    try {
      const g = await hotelApi.createGuest(guestForm);
      setGuests((prev) => [...prev, g.data]);
      setResForm((f) => ({ ...f, guest_id: String(g.data.id) }));
      showToast(`Guest "${g.data.full_name}" created`);
      setShowGuestModal(false);
      setGuestForm({ full_name: '', email: '', phone: '', id_type: 'passport', id_number: '' });
    } catch { showToast('Failed to create guest', 'error'); }
    finally { setSaving(false); }
  }

  async function handleCheckIn(res: Reservation) {
    try {
      await hotelApi.checkIn(res.id);
      showToast(`${res.guest.full_name} checked in to Room ${res.room.room_number}`);
      loadData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Check-in failed';
      showToast(msg, 'error');
    }
  }

  async function handleCheckOut(res: Reservation) {
    try {
      await hotelApi.checkOut(res.id);
      
      try {
        await billingApi.createInvoice({
          reservation_id: res.id,
          discount_amount: 0,
          other_charges: 0,
          tax_rate: 12,
        });
      } catch {
        // Ignore if invoice was already created manully earlier
      }
      
      showToast(`${res.guest.full_name} checked out. Redirecting to billing…`);
      router.push(`/dashboard/billing?checkout_res_id=${res.id}`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Check-out failed';
      showToast(msg, 'error');
    }
  }

  async function handleCancel(res: Reservation) {
    if (!confirm(`Cancel reservation ${res.reservation_number}?`)) return;
    try {
      await hotelApi.cancelReservation(res.id);
      showToast('Reservation cancelled');
      loadData();
    } catch { showToast('Cancel failed', 'error'); }
  }

  const filteredGuests = guests.filter((g) =>
    g.full_name.toLowerCase().includes(guestSearch.toLowerCase()) ||
    g.email?.toLowerCase().includes(guestSearch.toLowerCase()) ||
    g.phone?.includes(guestSearch)
  );

  const displayed = reservations.filter((r) =>
    r.guest.full_name.toLowerCase().includes(search.toLowerCase()) ||
    r.reservation_number.toLowerCase().includes(search.toLowerCase()) ||
    r.room.room_number.includes(search)
  );

  const statusTabs = [
    { key: '', label: 'All' }, { key: 'confirmed', label: 'Confirmed' },
    { key: 'checked_in', label: 'Checked In' }, { key: 'checked_out', label: 'Checked Out' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reservations</h1>
          <p className="page-subtitle">{reservations.length} total reservations</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-ghost" onClick={loadData}><RefreshCw size={15} /></button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="new-reservation-btn">
            <Plus size={15} /> New Reservation
          </button>
        </div>
      </div>

      {/* Status tabs + search */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {statusTabs.map((t) => (
            <button key={t.key} onClick={() => setFilterStatus(t.key)} id={`res-filter-${t.key || 'all'}`}
              style={{
                padding: '6px 14px', borderRadius: '99px', border: '1px solid', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                background: filterStatus === t.key ? 'var(--brand-dim)' : 'transparent',
                borderColor: filterStatus === t.key ? 'var(--brand)' : 'var(--border)',
                color: filterStatus === t.key ? 'var(--brand-light)' : 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}>{t.label}</button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" style={{ paddingLeft: '34px' }} placeholder="Search by guest, room, or number…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : displayed.length === 0 ? (
            <div className="empty-state">
              <CalendarCheck size={40} style={{ opacity: 0.3 }} />
              <h3>No reservations found</h3>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Reservation</th><th>Guest</th><th>Room</th>
                  <th>Check-In</th><th>Check-Out</th><th>Nights</th>
                  <th>Amount</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((res) => (
                  <tr key={res.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedRes(res)}>
                    <td><span style={{ fontFamily: 'monospace', color: 'var(--brand-light)', fontSize: '13px' }}>{res.reservation_number}</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{res.guest.full_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{res.guest.phone || res.guest.email}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>#{res.room.room_number}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{res.room.room_type?.name}</div>
                    </td>
                    <td style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>{new Date(res.check_in_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                    <td style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>{new Date(res.check_out_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                    <td style={{ textAlign: 'center' }}>{res.total_nights ?? '—'}</td>
                    <td><span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>Rs.{Number(res.total_room_charges ?? 0).toLocaleString()}</span></td>
                    <td><span className={`badge ${STATUS_BADGE[res.status] || 'badge-gray'}`} style={{ textTransform: 'capitalize' }}>{res.status.replace('_', ' ')}</span></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {res.status === 'confirmed' && (
                          <button className="btn btn-success" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => handleCheckIn(res)} id={`checkin-${res.id}`}>
                            <LogIn size={12} /> In
                          </button>
                        )}
                        {res.status === 'checked_in' && (
                          <button className="btn btn-primary" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => handleCheckOut(res)} id={`checkout-${res.id}`}>
                            <LogOut size={12} /> Out
                          </button>
                        )}
                        {['confirmed', 'checked_in'].includes(res.status) && (
                          <button className="btn btn-danger" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => handleCancel(res)} id={`cancel-res-${res.id}`}>
                            <UserX size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Reservation Modal */}
      {showCreate && (
        <Modal title="New Reservation" onClose={() => setShowCreate(false)}>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="label" style={{ margin: 0 }}>Guest *</label>
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setShowGuestModal(true)}>+ New Guest</button>
            </div>
            <input className="input" style={{ marginBottom: '6px' }} placeholder="Search guest…" value={guestSearch} onChange={(e) => setGuestSearch(e.target.value)} />
            <select className="input select" value={resForm.guest_id} onChange={(e) => setResForm({ ...resForm, guest_id: e.target.value })} id="res-guest-select">
              <option value="">Select guest…</option>
              {filteredGuests.map((g) => <option key={g.id} value={g.id}>{g.full_name}{g.phone ? ` — ${g.phone}` : ''}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="label">Check-in Date *</label>
              <input className="input" type="date" value={resForm.check_in_date} onChange={(e) => setResForm({ ...resForm, check_in_date: e.target.value })} id="checkin-date" />
            </div>
            <div className="form-group">
              <label className="label">Check-out Date *</label>
              <input className="input" type="date" value={resForm.check_out_date} onChange={(e) => setResForm({ ...resForm, check_out_date: e.target.value })} id="checkout-date" />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Available Room *</label>
            <select className="input select" value={resForm.room_id} onChange={(e) => setResForm({ ...resForm, room_id: e.target.value })} id="res-room-select">
              <option value="">Select room…</option>
              {(resForm.check_in_date && resForm.check_out_date ? availableRooms : rooms).map((r) => (
                <option key={r.id} value={r.id}>Room #{r.room_number} — {r.room_type?.name} (Rs.{Number(r.room_type?.base_price ?? 0).toLocaleString()}/night)</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="label">Adults</label>
              <input className="input" type="number" min="1" value={resForm.adults} onChange={(e) => setResForm({ ...resForm, adults: e.target.value })} id="res-adults" />
            </div>
            <div className="form-group">
              <label className="label">Children</label>
              <input className="input" type="number" min="0" value={resForm.children} onChange={(e) => setResForm({ ...resForm, children: e.target.value })} id="res-children" />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Special Requests</label>
            <input className="input" placeholder="Early check-in, extra pillows…" value={resForm.special_requests} onChange={(e) => setResForm({ ...resForm, special_requests: e.target.value })} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateReservation}
              disabled={saving || !resForm.guest_id || !resForm.room_id || !resForm.check_in_date || !resForm.check_out_date} id="create-res-btn">
              {saving ? 'Creating…' : 'Create Reservation'}
            </button>
          </div>
        </Modal>
      )}

      {/* New Guest Modal */}
      {showGuestModal && (
        <Modal title="Register New Guest" onClose={() => setShowGuestModal(false)}>
          <div className="form-group">
            <label className="label">Full Name *</label>
            <input className="input" placeholder="Guest full name" value={guestForm.full_name} onChange={(e) => setGuestForm({ ...guestForm, full_name: e.target.value })} id="guest-name-input" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="label">Phone</label>
              <input className="input" placeholder="+91 98765 43210" value={guestForm.phone} onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="guest@email.com" value={guestForm.email} onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="label">ID Type</label>
              <select className="input select" value={guestForm.id_type} onChange={(e) => setGuestForm({ ...guestForm, id_type: e.target.value })}>
                <option value="passport">Passport</option>
                <option value="national_id">National ID / Aadhaar</option>
                <option value="driving_license">Driving License</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">ID Number</label>
              <input className="input" placeholder="ID no." value={guestForm.id_number} onChange={(e) => setGuestForm({ ...guestForm, id_number: e.target.value })} />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setShowGuestModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateGuest} disabled={saving || !guestForm.full_name} id="save-guest-btn">
              {saving ? 'Saving…' : 'Register Guest'}
            </button>
          </div>
        </Modal>
      )}

      {/* Detail Modal */}
      {selectedRes && (
        <Modal title={`Reservation ${selectedRes.reservation_number}`} onClose={() => setSelectedRes(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
            {[
              ['Guest', selectedRes.guest.full_name],
              ['Room', `#${selectedRes.room.room_number} — ${selectedRes.room.room_type?.name}`],
              ['Check-In', selectedRes.check_in_date],
              ['Check-Out', selectedRes.check_out_date],
              ['Nights', selectedRes.total_nights ?? '—'],
              ['Rate/Night', `Rs.${Number(selectedRes.room_rate ?? 0).toLocaleString()}`],
              ['Adults', selectedRes.adults],
              ['Children', selectedRes.children],
              ['Total Charges', `Rs.${Number(selectedRes.total_room_charges ?? 0).toLocaleString()}`],
              ['Status', selectedRes.status.replace('_', ' ')],
            ].map(([k, v]) => (
              <div key={String(k)} style={{ background: 'var(--bg-raised)', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</div>
                <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{String(v)}</div>
              </div>
            ))}
          </div>
          {selectedRes.special_requests && (
            <div style={{ marginTop: '12px', background: 'var(--bg-raised)', borderRadius: '8px', padding: '10px 14px', fontSize: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>SPECIAL REQUESTS</div>
              <div>{selectedRes.special_requests}</div>
            </div>
          )}
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setSelectedRes(null)}>Close</button>
            {selectedRes.status === 'confirmed' && (
              <button className="btn btn-success" onClick={() => { handleCheckIn(selectedRes); setSelectedRes(null); }}>
                <UserCheck size={14} /> Check In
              </button>
            )}
            {selectedRes.status === 'checked_in' && (
              <button className="btn btn-primary" onClick={() => { handleCheckOut(selectedRes); setSelectedRes(null); }}>
                <LogOut size={14} /> Check Out
              </button>
            )}
          </div>
        </Modal>
      )}

      {toast && <div className="toast-container"><div className={`toast toast-${toast.type}`}>{toast.msg}</div></div>}
    </div>
  );
}
