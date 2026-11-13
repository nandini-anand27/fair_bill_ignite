import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/accounts/register/', data),
  login: (data) => api.post('/accounts/login/', data),
  adminLogin: (data) => api.post('/accounts/admin-login/', data),
  profile: () => api.get('/accounts/profile/'),
};

export const billAPI = {
  list: () => api.get('/bills/'),
  detail: (id) => api.get(`/bills/${id}/`),
  upload: (data) => api.post('/bills/upload/', data),
  update: (id, data) => api.put(`/bills/${id}/update/`, data),
  compare: (id, data) => api.post(`/bills/${id}/compare/`, data),
  consent: (data) => api.post('/bills/consent/', data),
  delete: (referenceCode) => api.post('/bills/delete/', { reference_code: referenceCode }),
  hospitals: () => api.get('/bills/hospitals/'),
};

export const adminAPI = {
  users: () => api.get('/admin-panel/users/'),
  toggleUser: (id) => api.patch(`/admin-panel/users/${id}/toggle-active/`),
  deleteUser: (id) => api.delete(`/admin-panel/users/${id}/delete/`),
  stats: () => api.get('/admin-panel/users/stats/'),
  pendingBills: () => api.get('/admin-panel/bills/pending/'),
  allBills: () => api.get('/admin-panel/bills/all/'),
  approveBill: (id) => api.post(`/admin-panel/bills/${id}/approve/`),
  rejectBill: (id, reason) => api.post(`/admin-panel/bills/${id}/reject/`, { reason }),
  auditLog: () => api.get('/admin-panel/audit-log/'),
};

export default api;
