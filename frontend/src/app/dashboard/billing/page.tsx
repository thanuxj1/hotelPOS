'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { billingApi, hotelApi } from '@/lib/api';
import { FileText, Plus, CreditCard, DollarSign, TrendingDown, RefreshCw } from 'lucide-react';

interface Invoice {
  id: number; invoice_number: string; reservation_id: number;
  status: string; room_charges: number; food_charges: number;
  other_charges: number; discount_amount: number; tax_rate: number;
  tax_amount: number; total_amount: number; paid_amount: number;
  balance_due: number; notes?: string;
  payments: { id: number; amount: number; method: string; reference?: string; created_at?: string }[];
  created_at?: string;
}
interface Reservation { id: number; reservation_number: string; guest: { full_name: string }; room: { room_number: string }; status: string; }

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-gray', issued: 'badge-blue',
  partially_paid: 'badge-yellow', paid: 'badge-green', cancelled: 'badge-red',
};

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

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [billingStats, setBillingStats] = useState<{ total_billed: number; total_collected: number; outstanding: number } | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const autoShowDone = useRef(false);

  const [showCreateInv, setShowCreateInv] = useState(false);
  const [showPayModal, setShowPayModal] = useState<Invoice | null>(null);
  const [selectedInv, setSelectedInv] = useState<Invoice | null>(null);

  const [invForm, setInvForm] = useState({ reservation_id: '', discount_amount: '0', other_charges: '0', tax_rate: '12', notes: '' });
  const [payForm, setPayForm] = useState({ amount: '', method: 'cash', reference: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, res, stats] = await Promise.all([
        billingApi.getInvoices(filterStatus || undefined),
        hotelApi.getReservations(),
        billingApi.getStats(),
      ]);
      setInvoices(inv.data);
      setReservations(res.data);
      setBillingStats(stats.data);
    } catch { showToast('Failed to load billing data', 'error'); }
    finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-show final invoice if referred from checkout
  useEffect(() => {
    if (!loading && invoices.length > 0 && !autoShowDone.current) {
      const params = new URLSearchParams(window.location.search);
      const checkoutId = params.get('checkout_res_id');
      if (checkoutId) {
        const targetInv = invoices.find((inv) => inv.reservation_id === Number(checkoutId));
        if (targetInv) {
          setSelectedInv(targetInv);
          autoShowDone.current = true;
          // Clean up the URL
          window.history.replaceState({}, '', '/dashboard/billing');
        }
      }
    }
  }, [loading, invoices]);

  async function handleCreateInvoice() {
    setSaving(true);
    try {
      await billingApi.createInvoice({
        reservation_id: Number(invForm.reservation_id),
        discount_amount: Number(invForm.discount_amount),
        other_charges: Number(invForm.other_charges),
        tax_rate: Number(invForm.tax_rate),
        notes: invForm.notes || null,
      });
      showToast('Invoice created successfully!');
      setShowCreateInv(false);
      setInvForm({ reservation_id: '', discount_amount: '0', other_charges: '0', tax_rate: '12', notes: '' });
      loadData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to create invoice';
      showToast(msg, 'error');
    } finally { setSaving(false); }
  }

  async function handleAddPayment() {
    if (!showPayModal) return;
    setSaving(true);
    try {
      await billingApi.addPayment(showPayModal.id, {
        amount: Number(payForm.amount),
        method: payForm.method,
        reference: payForm.reference || null,
        notes: payForm.notes || null,
      });
      showToast(`Payment of Rs.${Number(payForm.amount).toLocaleString()} recorded`);
      setShowPayModal(null);
      setPayForm({ amount: '', method: 'cash', reference: '', notes: '' });
      loadData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Payment failed';
      showToast(msg, 'error');
    } finally { setSaving(false); }
  }

  function getResLabel(id: number) {
    const r = reservations.find((r) => r.id === id);
    return r ? `${r.reservation_number} — ${r.guest.full_name} (Room ${r.room.room_number})` : `Reservation #${id}`;
  }

  // Only checked_in/confirmed reservations without invoices for new invoice creation
  const billableReservations = reservations.filter((r) => ['confirmed', 'checked_in', 'checked_out'].includes(r.status));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing & Invoices</h1>
          <p className="page-subtitle">{invoices.length} invoices · Manage payments</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-ghost" onClick={loadData}><RefreshCw size={15} /></button>
          <button className="btn btn-primary" onClick={() => setShowCreateInv(true)} id="create-invoice-btn">
            <Plus size={15} /> Generate Invoice
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: 'Total Billed', value: billingStats?.total_billed ?? 0, icon: FileText, color: 'var(--brand)', bg: 'var(--brand-dim)' },
          { label: 'Total Collected', value: billingStats?.total_collected ?? 0, icon: DollarSign, color: 'var(--accent-green)', bg: 'rgba(16,185,129,0.12)' },
          { label: 'Outstanding', value: billingStats?.outstanding ?? 0, icon: TrendingDown, color: 'var(--accent-yellow)', bg: 'rgba(245,158,11,0.12)' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-label">{label}</span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} style={{ color }} />
              </div>
            </div>
            <div className="stat-value" style={{ color }}>Rs.{Number(value).toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['', 'issued', 'partially_paid', 'paid', 'cancelled'].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)} id={`inv-filter-${s || 'all'}`}
            style={{ padding: '6px 14px', borderRadius: '99px', border: '1px solid', fontSize: '13px', fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize', background: filterStatus === s ? 'var(--brand-dim)' : 'transparent', borderColor: filterStatus === s ? 'var(--brand)' : 'var(--border)', color: filterStatus === s ? 'var(--brand-light)' : 'var(--text-muted)' }}>
            {s ? s.replace('_', ' ') : 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : invoices.length === 0 ? (
            <div className="empty-state">
              <FileText size={40} style={{ opacity: 0.3 }} />
              <h3>No invoices found</h3>
              <p style={{ fontSize: '13px' }}>Generate an invoice from a reservation</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th><th>Reservation</th><th>Room</th>
                  <th>Food</th><th>Tax</th><th>Total</th>
                  <th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedInv(inv)}>
                    <td><span style={{ fontFamily: 'monospace', color: 'var(--brand-light)', fontSize: '13px' }}>{inv.invoice_number}</span></td>
                    <td style={{ fontSize: '13px' }}>{getResLabel(inv.reservation_id).split(' — ')[1] || `Res #${inv.reservation_id}`}</td>
                    <td style={{ fontSize: '13px' }}>Rs.{Number(inv.room_charges).toLocaleString()}</td>
                    <td style={{ fontSize: '13px' }}>Rs.{Number(inv.food_charges).toLocaleString()}</td>
                    <td style={{ fontSize: '13px' }}>Rs.{Number(inv.tax_amount).toLocaleString()}</td>
                    <td><span style={{ fontWeight: 700 }}>Rs.{Number(inv.total_amount).toLocaleString()}</span></td>
                    <td><span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>Rs.{Number(inv.paid_amount).toLocaleString()}</span></td>
                    <td><span style={{ color: Number(inv.balance_due) > 0 ? 'var(--accent-yellow)' : 'var(--text-muted)', fontWeight: 600 }}>Rs.{Number(inv.balance_due).toLocaleString()}</span></td>
                    <td><span className={`badge ${STATUS_BADGE[inv.status] || 'badge-gray'}`} style={{ textTransform: 'capitalize' }}>{inv.status.replace('_', ' ')}</span></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {['issued', 'partially_paid'].includes(inv.status) && Number(inv.balance_due) > 0 && (
                        <button className="btn btn-success" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => { setShowPayModal(inv); setPayForm({ amount: String(inv.balance_due), method: 'cash', reference: '', notes: '' }); }} id={`pay-${inv.id}`}>
                          <CreditCard size={12} /> Pay
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Invoice Modal */}
      {showCreateInv && (
        <Modal title="Generate Invoice" onClose={() => setShowCreateInv(false)}>
          <div className="form-group">
            <label className="label">Reservation *</label>
            <select className="input select" value={invForm.reservation_id} onChange={(e) => setInvForm({ ...invForm, reservation_id: e.target.value })} id="inv-res-select">
              <option value="">Select reservation…</option>
              {billableReservations.map((r) => (
                <option key={r.id} value={r.id}>{r.reservation_number} — {r.guest.full_name} (Room {r.room.room_number})</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="label">Tax Rate (%)</label>
              <input className="input" type="number" value={invForm.tax_rate} onChange={(e) => setInvForm({ ...invForm, tax_rate: e.target.value })} id="inv-tax" />
            </div>
            <div className="form-group">
              <label className="label">Discount (Rs.)</label>
              <input className="input" type="number" value={invForm.discount_amount} onChange={(e) => setInvForm({ ...invForm, discount_amount: e.target.value })} id="inv-discount" />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Other Charges (Rs.)</label>
            <input className="input" type="number" placeholder="Laundry, extras…" value={invForm.other_charges} onChange={(e) => setInvForm({ ...invForm, other_charges: e.target.value })} id="inv-other" />
          </div>
          <div className="form-group">
            <label className="label">Notes</label>
            <input className="input" placeholder="Invoice notes…" value={invForm.notes} onChange={(e) => setInvForm({ ...invForm, notes: e.target.value })} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setShowCreateInv(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateInvoice} disabled={saving || !invForm.reservation_id} id="gen-invoice-btn">
              {saving ? 'Generating…' : 'Generate Invoice'}
            </button>
          </div>
        </Modal>
      )}

      {/* Payment Modal */}
      {showPayModal && (
        <Modal title={`Record Payment — ${showPayModal.invoice_number}`} onClose={() => setShowPayModal(null)}>
          <div style={{ background: 'var(--bg-raised)', borderRadius: '10px', padding: '14px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Total Amount</span>
              <span style={{ fontWeight: 600 }}>Rs.{Number(showPayModal.total_amount).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Paid So Far</span>
              <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>Rs.{Number(showPayModal.paid_amount).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
              <span style={{ fontWeight: 700 }}>Balance Due</span>
              <span style={{ color: 'var(--accent-yellow)', fontWeight: 800 }}>Rs.{Number(showPayModal.balance_due).toLocaleString()}</span>
            </div>
          </div>
          <div className="form-group">
            <label className="label">Payment Amount (Rs.) *</label>
            <input className="input" type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} id="pay-amount-input" />
          </div>
          <div className="form-group">
            <label className="label">Payment Method *</label>
            <select className="input select" value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })} id="pay-method-select">
              <option value="cash">💵 Cash</option>
              <option value="card">💳 Card / Swipe</option>
              <option value="upi">📱 UPI</option>
              <option value="bank_transfer">🏦 Bank Transfer</option>
              <option value="complimentary">🎁 Complimentary</option>
            </select>
          </div>
          <div className="form-group">
            <label className="label">Reference / Transaction ID</label>
            <input className="input" placeholder="Optional…" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setShowPayModal(null)}>Cancel</button>
            <button className="btn btn-success" onClick={handleAddPayment} disabled={saving || !payForm.amount} id="confirm-payment-btn">
              {saving ? 'Recording…' : '✓ Record Payment'}
            </button>
          </div>
        </Modal>
      )}

      {/* Invoice Detail Modal */}
      {selectedInv && (
        <Modal title={selectedInv.invoice_number} onClose={() => setSelectedInv(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            {[
              ['Room Charges', `Rs.${Number(selectedInv.room_charges).toLocaleString()}`],
              ['Food Charges', `Rs.${Number(selectedInv.food_charges).toLocaleString()}`],
              ['Other Charges', `Rs.${Number(selectedInv.other_charges).toLocaleString()}`],
              ['Discount', `-Rs.${Number(selectedInv.discount_amount).toLocaleString()}`],
              ['Tax', `${selectedInv.tax_rate}% = Rs.${Number(selectedInv.tax_amount).toLocaleString()}`],
              ['Total', `Rs.${Number(selectedInv.total_amount).toLocaleString()}`],
              ['Paid', `Rs.${Number(selectedInv.paid_amount).toLocaleString()}`],
              ['Balance', `Rs.${Number(selectedInv.balance_due).toLocaleString()}`],
            ].map(([k, v]) => (
              <div key={String(k)} style={{ background: 'var(--bg-raised)', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase' }}>{k}</div>
                <div style={{ fontWeight: 700 }}>{String(v)}</div>
              </div>
            ))}
          </div>

          {selectedInv.payments.length > 0 && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment History</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedInv.payments.map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-raised)', borderRadius: '8px', padding: '8px 14px', fontSize: '13px' }}>
                    <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{p.method}{p.reference ? ` · ${p.reference}` : ''}</span>
                    <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>Rs.{Number(p.amount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setSelectedInv(null)}>Close</button>
            {['issued', 'partially_paid'].includes(selectedInv.status) && Number(selectedInv.balance_due) > 0 && (
              <button className="btn btn-success" onClick={() => { setShowPayModal(selectedInv); setSelectedInv(null); setPayForm({ amount: String(selectedInv.balance_due), method: 'cash', reference: '', notes: '' }); }}>
                <CreditCard size={14} /> Record Payment
              </button>
            )}
          </div>
        </Modal>
      )}

      {toast && <div className="toast-container"><div className={`toast toast-${toast.type}`}>{toast.msg}</div></div>}
    </div>
  );
}
