'use client';
import { useState, useEffect, useCallback } from 'react';
import { posApi, hotelApi } from '@/lib/api';
import { Plus, Minus, Trash2, ShoppingCart, ChefHat, CheckCircle, X } from 'lucide-react';

interface Category { id: number; name: string; sort_order: number; }
interface MenuItem { id: number; name: string; description?: string; price: number; category_id: number; is_available: boolean; preparation_time: number; }
interface CartItem { menu_item: MenuItem; quantity: number; notes: string; }
interface Order { id: number; order_number: string; status: string; total_amount: number; order_type: string; table_number?: string; items: { menu_item?: MenuItem; quantity: number; unit_price: number; subtotal: number }[]; created_at?: string; }
interface Reservation { id: number; guest: { full_name: string }; room: { id: number; room_number: string } }

const STATUS_COLORS: Record<string, string> = {
  pending: 'badge-yellow', preparing: 'badge-blue', ready: 'badge-green', delivered: 'badge-gray', cancelled: 'badge-red',
};
const STATUS_NEXT: Record<string, string> = { pending: 'preparing', preparing: 'ready', ready: 'delivered' };

export default function POSPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeReservations, setActiveReservations] = useState<Reservation[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState('restaurant');
  const [tableNumber, setTableNumber] = useState('');
  const [selectedResId, setSelectedResId] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [activeTab, setActiveTab] = useState<'menu' | 'orders'>('menu');
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [filterOrderStatus, setFilterOrderStatus] = useState('');

  const showToast = (msg: string, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const loadData = useCallback(async () => {
    try {
      const catsP = posApi.getCategories().catch(() => ({ data: [] }));
      const itemsP = posApi.getMenu().catch(() => ({ data: [] }));
      const ordsP = posApi.getOrders(filterOrderStatus || undefined).catch(() => ({ data: [] }));
      const resvsP = hotelApi.getReservations('checked_in').catch(() => ({ data: [] }));

      const [cats, items, ords, resvs] = await Promise.all([catsP, itemsP, ordsP, resvsP]);
      
      setCategories(cats.data);
      setMenuItems(items.data);
      setOrders(ords.data);
      setActiveReservations(resvs.data);
    } catch { showToast('Failed to load data', 'error'); }
  }, [filterOrderStatus]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { const id = setInterval(loadData, 15000); return () => clearInterval(id); }, [loadData]);

  const filteredItems = selectedCat ? menuItems.filter((i) => i.category_id === selectedCat) : menuItems;

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menu_item.id === item.id);
      if (existing) return prev.map((c) => c.menu_item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menu_item: item, quantity: 1, notes: '' }];
    });
  }

  function updateQty(itemId: number, delta: number) {
    setCart((prev) => prev.map((c) => c.menu_item.id === itemId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c).filter((c) => c.quantity > 0));
  }

  function removeFromCart(itemId: number) { setCart((prev) => prev.filter((c) => c.menu_item.id !== itemId)); }

  const cartTotal = cart.reduce((sum, c) => sum + Number(c.menu_item.price) * c.quantity, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  async function placeOrder() {
    if (!cart.length) return;
    if (orderType === 'room_service' && !selectedResId) {
      showToast('Please select a room/guest', 'error');
      return;
    }
    setPlacingOrder(true);
    let roomId: number | undefined;
    if (orderType === 'room_service') {
      const res = activeReservations.find(r => r.id === Number(selectedResId));
      roomId = res?.room.id;
    }

    try {
      await posApi.createOrder({
        order_type: orderType,
        table_number: orderType === 'restaurant' ? tableNumber || null : null,
        reservation_id: orderType === 'room_service' ? Number(selectedResId) : null,
        room_id: orderType === 'room_service' ? roomId : null,
        notes: orderNotes || null,
        items: cart.map((c) => ({ menu_item_id: c.menu_item.id, quantity: c.quantity, notes: c.notes || null })),
      });
      showToast(`Order placed! Rs.${cartTotal.toLocaleString()}`);
      setCart([]);
      setTableNumber('');
      setSelectedResId('');
      setOrderNotes('');
      setActiveTab('orders');
      loadData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to place order';
      showToast(msg, 'error');
    } finally { setPlacingOrder(false); }
  }

  async function advanceStatus(order: Order) {
    const next = STATUS_NEXT[order.status];
    if (!next) return;
    try {
      await posApi.updateOrderStatus(order.id, next);
      showToast(`Order ${order.order_number} → ${next}`);
      loadData();
    } catch { showToast('Failed to update status', 'error'); }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">POS Terminal</h1>
          <p className="page-subtitle">Place orders and track kitchen status</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setActiveTab('menu')} className={`btn ${activeTab === 'menu' ? 'btn-primary' : 'btn-ghost'}`} id="tab-menu">
            <ShoppingCart size={15} /> Menu
          </button>
          <button onClick={() => setActiveTab('orders')} className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-ghost'}`} id="tab-orders">
            <ChefHat size={15} /> Orders ({orders.filter((o) => ['pending', 'preparing'].includes(o.status)).length})
          </button>
        </div>
      </div>

      {activeTab === 'menu' ? (
        <div style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 190px)', minHeight: 0 }}>
          {/* Menu side */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            {/* Category filter */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexShrink: 0, flexWrap: 'wrap' }}>
              <button
                onClick={() => setSelectedCat(null)}
                style={{ padding: '7px 16px', borderRadius: '99px', border: '1px solid', fontSize: '13px', fontWeight: 500, cursor: 'pointer', background: !selectedCat ? 'var(--brand-dim)' : 'transparent', borderColor: !selectedCat ? 'var(--brand)' : 'var(--border)', color: !selectedCat ? 'var(--brand-light)' : 'var(--text-muted)' }}
                id="cat-all">All
              </button>
              {categories.map((cat) => (
                <button key={cat.id} onClick={() => setSelectedCat(cat.id)} id={`cat-${cat.id}`}
                  style={{ padding: '7px 16px', borderRadius: '99px', border: '1px solid', fontSize: '13px', fontWeight: 500, cursor: 'pointer', background: selectedCat === cat.id ? 'var(--brand-dim)' : 'transparent', borderColor: selectedCat === cat.id ? 'var(--brand)' : 'var(--border)', color: selectedCat === cat.id ? 'var(--brand-light)' : 'var(--text-muted)' }}>
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Menu items grid */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredItems.length === 0 ? (
                <div className="empty-state"><ChefHat size={40} style={{ opacity: 0.3 }} /><h3>No menu items</h3></div>
              ) : (
                <div className="menu-grid">
                  {filteredItems.map((item) => {
                    const cartItem = cart.find((c) => c.menu_item.id === item.id);
                    return (
                      <div key={item.id} className="menu-item-card" onClick={() => item.is_available && addToCart(item)}
                        style={{ opacity: item.is_available ? 1 : 0.5, position: 'relative' }} id={`menu-${item.id}`}>
                        {cartItem && (
                          <div style={{ position: 'absolute', top: '8px', right: '8px', width: '22px', height: '22px', borderRadius: '50%', background: 'var(--brand)', color: '#fff', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {cartItem.quantity}
                          </div>
                        )}
                        <div className="menu-item-name">{item.name}</div>
                        {item.description && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: 1.4 }}>{item.description}</div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div className="menu-item-price">Rs.{Number(item.price).toLocaleString()}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>~{item.preparation_time}m</div>
                        </div>
                        {!item.is_available && <div style={{ fontSize: '11px', color: 'var(--accent-red)', marginTop: '4px' }}>Unavailable</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Cart panel */}
          <div className="cart-panel" style={{ overflowY: 'auto', borderRadius: 'var(--radius-lg)', height: '100%' }}>
            <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Cart {cartCount > 0 && <span style={{ background: 'var(--brand)', color: '#fff', borderRadius: '99px', padding: '0 8px', fontSize: '12px', marginLeft: '6px' }}>{cartCount}</span>}</span>
              {cart.length > 0 && <button onClick={() => setCart([])} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}>Clear all</button>}
            </div>

            {cart.length === 0 ? (
              <div className="empty-state" style={{ flex: 1, padding: '40px 20px' }}>
                <ShoppingCart size={36} style={{ opacity: 0.2 }} />
                <p style={{ fontSize: '13px' }}>Click menu items to add</p>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {cart.map((ci) => (
                  <div key={ci.menu_item.id} style={{ background: 'var(--bg-raised)', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, flex: 1, paddingRight: '8px' }}>{ci.menu_item.name}</div>
                      <button onClick={() => removeFromCart(ci.menu_item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-red)', lineHeight: 1 }} id={`remove-${ci.menu_item.id}`}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button onClick={() => updateQty(ci.menu_item.id, -1)} className="btn btn-ghost" style={{ padding: '3px', borderRadius: '6px', lineHeight: 1 }} id={`dec-${ci.menu_item.id}`}><Minus size={12} /></button>
                        <span style={{ fontSize: '14px', fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>{ci.quantity}</span>
                        <button onClick={() => updateQty(ci.menu_item.id, 1)} className="btn btn-ghost" style={{ padding: '3px', borderRadius: '6px', lineHeight: 1 }} id={`inc-${ci.menu_item.id}`}><Plus size={12} /></button>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--brand-light)' }}>Rs.{(Number(ci.menu_item.price) * ci.quantity).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Order config */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '14px' }}>
              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label className="label">Order Type</label>
                <select className="input select" value={orderType} onChange={(e) => setOrderType(e.target.value)} id="order-type-select">
                  <option value="restaurant">Restaurant</option>
                  <option value="room_service">Room Service</option>
                  <option value="takeaway">Takeaway</option>
                </select>
              </div>
              {orderType === 'restaurant' && (
                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="label">Table Number</label>
                  <input className="input" placeholder="e.g. Table 5" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} id="table-number-input" />
                </div>
              )}
              {orderType === 'room_service' && (
                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="label">Select Guest Room</label>
                  <select className="input select" value={selectedResId} onChange={(e) => setSelectedResId(e.target.value)} id="room-service-select">
                    <option value="">Select a checked-in guest...</option>
                    {[...activeReservations].sort((a, b) => {
                      const roomA = parseInt(a.room?.room_number || '0', 10);
                      const roomB = parseInt(b.room?.room_number || '0', 10);
                      return roomA - roomB;
                    }).map(r => (
                      <option key={r.id} value={r.id}>
                        Room {r.room?.room_number || '??'} — {r.guest?.full_name || 'Guest'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', fontSize: '18px', fontWeight: 800 }}>
                <span>Total</span>
                <span style={{ color: 'var(--accent-green)' }}>Rs.{cartTotal.toLocaleString()}</span>
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '15px', fontWeight: 700 }}
                onClick={placeOrder} disabled={!cart.length || placingOrder} id="place-order-btn">
                {placingOrder ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Placing…</> : <><CheckCircle size={16} /> Place Order</>}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Orders tab */
        <div style={{ paddingBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            {['', 'pending', 'preparing', 'ready', 'delivered', 'cancelled'].map((s) => (
              <button key={s} onClick={() => setFilterOrderStatus(s)} id={`order-filter-${s || 'all'}`}
                style={{ padding: '6px 14px', borderRadius: '99px', border: '1px solid', fontSize: '13px', fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize', background: filterOrderStatus === s ? 'var(--brand-dim)' : 'transparent', borderColor: filterOrderStatus === s ? 'var(--brand)' : 'var(--border)', color: filterOrderStatus === s ? 'var(--brand-light)' : 'var(--text-muted)' }}>
                {s || 'All'} {s && `(${orders.filter((o) => o.status === s).length})`}
              </button>
            ))}
          </div>

          {orders.length === 0 ? (
            <div className="empty-state"><ChefHat size={48} style={{ opacity: 0.3 }} /><h3>No active kitchen orders</h3></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {orders.map((order) => (
                <div key={order.id} className="card" style={{ padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: 'var(--brand-light)' }}>{order.order_number}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {order.order_type.replace('_', ' ')}{order.table_number ? ` · Table ${order.table_number}` : ''}
                      </div>
                    </div>
                    <span className={`badge ${STATUS_COLORS[order.status] || 'badge-gray'}`} style={{ textTransform: 'capitalize' }}>{order.status}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                    {order.items.map((oi, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span>{oi.quantity}× {oi.menu_item?.name ?? 'Item'}</span>
                        <span style={{ color: 'var(--text-muted)' }}>Rs.{Number(oi.subtotal).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                    <span style={{ fontWeight: 700 }}>Rs.{Number(order.total_amount).toLocaleString()}</span>
                    {STATUS_NEXT[order.status] && (
                      <button className="btn btn-success" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => advanceStatus(order)} id={`advance-${order.id}`}>
                        Mark {STATUS_NEXT[order.status]}
                      </button>
                    )}
                    {order.status === 'cancelled' && <span style={{ fontSize: '12px', color: 'var(--accent-red)' }}>Cancelled</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {toast && <div className="toast-container"><div className={`toast toast-${toast.type}`}>{toast.msg}</div></div>}
    </div>
  );
}
