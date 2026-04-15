'use client';
import { useState, useEffect, useCallback } from 'react';
import { hotelApi } from '@/lib/api';
import { Plus, RefreshCw, BedDouble, Edit2, Trash2, Wrench } from 'lucide-react';

interface RoomType { id: number; name: string; base_price: number; capacity: number; amenities?: string; }
interface Room {
  id: number; room_number: string; floor?: number;
  room_type_id: number; room_type?: RoomType;
  status: string; notes?: string;
}

const STATUS_BADGE: Record<string, string> = {
  available: 'badge-green', occupied: 'badge-red',
  reserved: 'badge-yellow', maintenance: 'badge-gray', cleaning: 'badge-purple',
};
const STATUS_LABELS = ['all', 'available', 'occupied', 'reserved', 'maintenance', 'cleaning'];

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 className="modal-title" style={{ margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return <div className={`toast toast-${type}`}>{msg}</div>;
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Modals
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showAddType, setShowAddType] = useState(false);
  const [editRoom, setEditRoom] = useState<Room | null>(null);

  // Form state
  const [roomForm, setRoomForm] = useState({ room_number: '', floor: '', room_type_id: '', notes: '', status: 'available' });
  const [typeForm, setTypeForm] = useState({ name: '', base_price: '', capacity: '2', description: '', amenities: '' });
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [r, rt] = await Promise.all([hotelApi.getRooms(), hotelApi.getRoomTypes()]);
      setRooms(r.data);
      setRoomTypes(rt.data);
    } catch { showToast('Failed to load rooms', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = filterStatus === 'all' ? rooms : rooms.filter((r) => r.status === filterStatus);

  async function handleSaveRoom() {
    setSaving(true);
    try {
      const payload = { ...roomForm, floor: roomForm.floor ? Number(roomForm.floor) : undefined, room_type_id: Number(roomForm.room_type_id) };
      if (editRoom) {
        await hotelApi.updateRoom(editRoom.id, payload);
        showToast('Room updated');
      } else {
        await hotelApi.createRoom(payload);
        showToast('Room created');
      }
      setShowAddRoom(false);
      setEditRoom(null);
      setRoomForm({ room_number: '', floor: '', room_type_id: '', notes: '', status: 'available' });
      loadData();
    } catch { showToast('Failed to save room', 'error'); }
    finally { setSaving(false); }
  }

  async function handleSaveType() {
    setSaving(true);
    try {
      await hotelApi.createRoomType({ ...typeForm, base_price: Number(typeForm.base_price), capacity: Number(typeForm.capacity) });
      showToast('Room type created');
      setShowAddType(false);
      setTypeForm({ name: '', base_price: '', capacity: '2', description: '', amenities: '' });
      loadData();
    } catch { showToast('Failed to save room type', 'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete(room: Room) {
    if (!confirm(`Delete room ${room.room_number}?`)) return;
    try {
      await hotelApi.deleteRoom(room.id);
      showToast('Room deleted');
      loadData();
    } catch { showToast('Failed to delete room', 'error'); }
  }

  async function handleStatusChange(room: Room, status: string) {
    try {
      await hotelApi.updateRoom(room.id, { status });
      showToast(`Room ${room.room_number} → ${status}`);
      loadData();
    } catch { showToast('Failed to update status', 'error'); }
  }

  function openEdit(room: Room) {
    setEditRoom(room);
    setRoomForm({ room_number: room.room_number, floor: String(room.floor ?? ''), room_type_id: String(room.room_type_id), notes: room.notes ?? '', status: room.status });
    setShowAddRoom(true);
  }

  const statusCounts = rooms.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Rooms Management</h1>
          <p className="page-subtitle">{rooms.length} rooms · {statusCounts.available ?? 0} available</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-ghost" onClick={loadData} id="refresh-rooms-btn"><RefreshCw size={15} /></button>
          <button className="btn btn-ghost" onClick={() => setShowAddType(true)} id="add-room-type-btn"><Plus size={15} /> Room Type</button>
          <button className="btn btn-primary" onClick={() => { setEditRoom(null); setRoomForm({ room_number: '', floor: '', room_type_id: '', notes: '', status: 'available' }); setShowAddRoom(true); }} id="add-room-btn">
            <Plus size={15} /> Add Room
          </button>
        </div>
      </div>

      {/* Room type info chips */}
      {roomTypes.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {roomTypes.map((rt) => (
            <div key={rt.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 18px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '2px' }}>{rt.name}</div>
              <div style={{ fontSize: '13px', color: 'var(--brand-light)', fontWeight: 600 }}>Rs.{Number(rt.base_price).toLocaleString()}/night</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Up to {rt.capacity} guests</div>
            </div>
          ))}
        </div>
      )}

      {/* Status filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {STATUS_LABELS.map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)} id={`filter-${s}`}
            style={{
              padding: '6px 14px', borderRadius: '99px', border: '1px solid',
              fontSize: '13px', fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize',
              background: filterStatus === s ? 'var(--brand-dim)' : 'transparent',
              borderColor: filterStatus === s ? 'var(--brand)' : 'var(--border)',
              color: filterStatus === s ? 'var(--brand-light)' : 'var(--text-muted)',
            }}>
            {s === 'all' ? `All (${rooms.length})` : `${s} (${statusCounts[s] ?? 0})`}
          </button>
        ))}
      </div>

      {/* Room grid */}
      {loading ? (
        <div className="empty-state"><div className="spinner" /><span>Loading rooms…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <BedDouble size={48} style={{ opacity: 0.3 }} />
          <h3>No rooms found</h3>
          <p style={{ fontSize: '13px' }}>Add your first room to get started</p>
        </div>
      ) : (
        <div className="rooms-grid">
          {filtered.map((room) => (
            <div key={room.id} className={`room-card ${room.status}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <div className="room-number">#{room.room_number}</div>
                <span className={`badge ${STATUS_BADGE[room.status] || 'badge-gray'}`} style={{ textTransform: 'capitalize' }}>{room.status}</span>
              </div>
              <div className="room-type">{room.room_type?.name ?? '—'}</div>
              {room.floor && <div className="room-type">Floor {room.floor}</div>}
              <div style={{ fontSize: '13px', color: 'var(--brand-light)', fontWeight: 600, marginBottom: '10px' }}>
                Rs.{room.room_type ? Number(room.room_type.base_price).toLocaleString() : '—'}/night
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <select
                  value={room.status}
                  onChange={(e) => handleStatusChange(room, e.target.value)}
                  className="input select"
                  style={{ padding: '5px 8px', fontSize: '12px', flex: 1, minWidth: 0 }}
                  id={`room-status-${room.id}`}>
                  {['available', 'occupied', 'reserved', 'maintenance', 'cleaning'].map((s) => (
                    <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>
                  ))}
                </select>
                <button onClick={() => openEdit(room)} className="btn btn-ghost" style={{ padding: '5px 8px', flexShrink: 0 }} id={`edit-room-${room.id}`}><Edit2 size={13} /></button>
                <button onClick={() => handleDelete(room)} className="btn btn-danger" style={{ padding: '5px 8px', flexShrink: 0 }} id={`delete-room-${room.id}`}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Room Modal */}
      {showAddRoom && (
        <Modal title={editRoom ? `Edit Room #${editRoom.room_number}` : 'Add New Room'} onClose={() => { setShowAddRoom(false); setEditRoom(null); }}>
          <div className="form-group">
            <label className="label">Room Number *</label>
            <input className="input" placeholder="e.g. 101" value={roomForm.room_number} onChange={(e) => setRoomForm({ ...roomForm, room_number: e.target.value })} id="room-number-input" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="label">Floor</label>
              <input className="input" type="number" placeholder="1" value={roomForm.floor} onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })} id="room-floor-input" />
            </div>
            <div className="form-group">
              <label className="label">Status</label>
              <select className="input select" value={roomForm.status} onChange={(e) => setRoomForm({ ...roomForm, status: e.target.value })} id="room-status-select">
                {['available', 'occupied', 'reserved', 'maintenance', 'cleaning'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="label">Room Type *</label>
            <select className="input select" value={roomForm.room_type_id} onChange={(e) => setRoomForm({ ...roomForm, room_type_id: e.target.value })} id="room-type-select">
              <option value="">Select room type…</option>
              {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name} — Rs.{Number(rt.base_price).toLocaleString()}/night</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Notes</label>
            <input className="input" placeholder="Optional notes…" value={roomForm.notes} onChange={(e) => setRoomForm({ ...roomForm, notes: e.target.value })} id="room-notes-input" />
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => { setShowAddRoom(false); setEditRoom(null); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveRoom} disabled={saving || !roomForm.room_number || !roomForm.room_type_id} id="save-room-btn">
              {saving ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Saving…</> : editRoom ? 'Update Room' : 'Create Room'}
            </button>
          </div>
        </Modal>
      )}

      {/* Add Room Type Modal */}
      {showAddType && (
        <Modal title="Add Room Type" onClose={() => setShowAddType(false)}>
          <div className="form-group">
            <label className="label">Type Name *</label>
            <input className="input" placeholder="e.g. Deluxe Suite" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} id="type-name-input" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="label">Base Price (Rs./night) *</label>
              <input className="input" type="number" placeholder="3500" value={typeForm.base_price} onChange={(e) => setTypeForm({ ...typeForm, base_price: e.target.value })} id="type-price-input" />
            </div>
            <div className="form-group">
              <label className="label">Capacity (guests)</label>
              <input className="input" type="number" placeholder="2" value={typeForm.capacity} onChange={(e) => setTypeForm({ ...typeForm, capacity: e.target.value })} id="type-capacity-input" />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Description</label>
            <input className="input" placeholder="Brief description…" value={typeForm.description} onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Amenities</label>
            <input className="input" placeholder="WiFi, AC, TV, Mini-bar…" value={typeForm.amenities} onChange={(e) => setTypeForm({ ...typeForm, amenities: e.target.value })} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setShowAddType(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveType} disabled={saving || !typeForm.name || !typeForm.base_price} id="save-type-btn">
              {saving ? 'Saving…' : 'Create Type'}
            </button>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && <div className="toast-container"><Toast msg={toast.msg} type={toast.type} /></div>}
    </div>
  );
}
