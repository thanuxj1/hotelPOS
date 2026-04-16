import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 → redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) => {
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', password);
    return api.post('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },
  me: () => api.get('/auth/me'),
};

// ─── Hotel ────────────────────────────────────────────────────────────────────
export const hotelApi = {
  getStats: () => api.get('/hotel/stats'),
  getRoomTypes: () => api.get('/hotel/room-types'),
  createRoomType: (data: unknown) => api.post('/hotel/room-types', data),
  getRooms: (status?: string) => api.get('/hotel/rooms', { params: status ? { status } : {} }),
  createRoom: (data: unknown) => api.post('/hotel/rooms', data),
  updateRoom: (id: number, data: unknown) => api.patch(`/hotel/rooms/${id}`, data),
  deleteRoom: (id: number) => api.delete(`/hotel/rooms/${id}`),
  checkAvailability: (check_in: string, check_out: string, room_type_id?: number) =>
    api.get('/hotel/rooms/availability', {
      params: { check_in_date: check_in, check_out_date: check_out, ...(room_type_id ? { room_type_id } : {}) },
    }),
  getGuests: (search?: string) => api.get('/hotel/guests', { params: search ? { search } : {} }),
  createGuest: (data: unknown) => api.post('/hotel/guests', data),
  getReservations: (status?: string) => api.get('/hotel/reservations', { params: status ? { status } : {} }),
  createReservation: (data: unknown) => api.post('/hotel/reservations', data),
  checkIn: (id: number) => api.post(`/hotel/reservations/${id}/check-in`),
  checkOut: (id: number) => api.post(`/hotel/reservations/${id}/check-out`),
  cancelReservation: (id: number) => api.post(`/hotel/reservations/${id}/cancel`),
};

// ─── POS ──────────────────────────────────────────────────────────────────────
export const posApi = {
  getCategories: () => api.get('/pos/categories'),
  getMenu: (category_id?: number) =>
    api.get('/pos/menu', { params: { available_only: true, ...(category_id ? { category_id } : {}) } }),
  createCategory: (data: unknown) => api.post('/pos/categories', data),
  createMenuItem: (data: unknown) => api.post('/pos/menu', data),
  updateMenuItem: (id: number, data: unknown) => api.patch(`/pos/menu/${id}`, data),
  deleteMenuItem: (id: number) => api.delete(`/pos/menu/${id}`),
  getOrders: (status?: string) => api.get('/pos/orders', { params: status ? { status } : {} }),
  createOrder: (data: unknown) => api.post('/pos/orders', data),
  updateOrderStatus: (id: number, status: string) =>
    api.patch(`/pos/orders/${id}/status`, null, { params: { status } }),
};

// ─── Billing ──────────────────────────────────────────────────────────────────
export const billingApi = {
  getStats: () => api.get('/billing/stats'),
  getInvoices: (status?: string) => api.get('/billing/invoices', { params: status ? { status } : {} }),
  createInvoice: (data: unknown) => api.post('/billing/invoices', data),
  getInvoice: (id: number) => api.get(`/billing/invoices/${id}`),
  getInvoiceByReservation: (resId: number) => api.get(`/billing/invoices/reservation/${resId}`),
  addPayment: (invoiceId: number, data: unknown) =>
    api.post(`/billing/invoices/${invoiceId}/payments`, data),
};
