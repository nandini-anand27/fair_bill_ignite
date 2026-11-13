import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, admin = false }) {
  const token = localStorage.getItem('access_token');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr) {
    return <Navigate to={admin ? '/admin-login' : '/login'} replace />;
  }

  const user = JSON.parse(userStr);

  if (admin && !user.is_admin && !user.is_staff) {
    return <Navigate to="/admin-login" replace />;
  }

  return children;
}
