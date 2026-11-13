import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

// User pages
import Login from './pages/user/Login';
import Register from './pages/user/Register';
import Dashboard from './pages/user/Dashboard';
import UploadBill from './pages/user/UploadBill';
import ReviewBill from './pages/user/ReviewBill';
import Results from './pages/user/Results';
import DeleteBill from './pages/user/DeleteBill';

// Admin pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import BillReview from './pages/admin/BillReview';
import Monitoring from './pages/admin/Monitoring';

function NavbarWrapper({ children }) {
  const location = useLocation();
  const hideNavbar = ['/admin-login'].includes(location.pathname);
  if (hideNavbar) return <>{children}</>;
  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* User Auth */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* User Pages */}
      <Route path="/dashboard" element={
        <ProtectedRoute><NavbarWrapper><Dashboard /></NavbarWrapper></ProtectedRoute>
      } />
      <Route path="/upload" element={
        <ProtectedRoute><NavbarWrapper><UploadBill /></NavbarWrapper></ProtectedRoute>
      } />
      <Route path="/review/:id" element={
        <ProtectedRoute><NavbarWrapper><ReviewBill /></NavbarWrapper></ProtectedRoute>
      } />
      <Route path="/results/:id" element={
        <ProtectedRoute><NavbarWrapper><Results /></NavbarWrapper></ProtectedRoute>
      } />
      <Route path="/delete-bill" element={
        <ProtectedRoute><NavbarWrapper><DeleteBill /></NavbarWrapper></ProtectedRoute>
      } />

      {/* Admin Auth */}
      <Route path="/admin-login" element={<AdminLogin />} />

      {/* Admin Pages */}
      <Route path="/admin/dashboard" element={
        <ProtectedRoute admin={true}><NavbarWrapper><AdminDashboard /></NavbarWrapper></ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute admin={true}><NavbarWrapper><UserManagement /></NavbarWrapper></ProtectedRoute>
      } />
      <Route path="/admin/bills" element={
        <ProtectedRoute admin={true}><NavbarWrapper><BillReview /></NavbarWrapper></ProtectedRoute>
      } />
      <Route path="/admin/monitoring" element={
        <ProtectedRoute admin={true}><NavbarWrapper><Monitoring /></NavbarWrapper></ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
