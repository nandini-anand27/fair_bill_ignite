import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
});

// Attach JWT access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — clear session
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
  register:   (data) => api.post('/accounts/register/',    data),
  login:      (data) => api.post('/accounts/login/',       data),
  adminLogin: (data) => api.post('/accounts/admin-login/', data),
  profile:    ()     => api.get('/accounts/profile/'),
};

export const billAPI = {
  list:          ()          => api.get('/bills/'),
  detail:        (id)        => api.get(`/bills/${id}/`),
  upload:        (data)      => api.post('/bills/upload/', data),
  extractImage:  (formData)  => api.post('/bills/extract-image/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 90000,
  }),
  update:        (id, data)  => api.put(`/bills/${id}/update/`, data),
  compare:       (id, data)  => api.post(`/bills/${id}/compare/`, data),
  consent:       (data)      => api.post('/bills/consent/', data),
  delete:        (refCode)   => api.post('/bills/delete/', { reference_code: refCode }),
  hospitals:     ()          => api.get('/bills/hospitals/'),
};

export const adminAPI = {
  users:          ()           => api.get('/admin-panel/users/'),
  toggleUser:     (id)         => api.patch(`/admin-panel/users/${id}/toggle-active/`),
  deleteUser:     (id)         => api.delete(`/admin-panel/users/${id}/delete/`),
  stats:          ()           => api.get('/admin-panel/users/stats/'),
  pendingBills:   ()           => api.get('/admin-panel/bills/pending/'),
  allBills:       ()           => api.get('/admin-panel/bills/all/'),
  approveBill:    (id)         => api.post(`/admin-panel/bills/${id}/approve/`),
  rejectBill:     (id, reason) => api.post(`/admin-panel/bills/${id}/reject/`, { reason }),
  auditLog:       ()           => api.get('/admin-panel/audit-log/'),
  hospitals:      ()           => api.get('/admin-panel/hospitals/'),
  addHospital:    (data)       => api.post('/admin-panel/hospitals/', data),
  deleteHospital: (id)         => api.delete(`/admin-panel/hospitals/${id}/`),
  updateHospital: (id, data)   => api.put(`/admin-panel/hospitals/${id}/`, data),
};

export default api;
