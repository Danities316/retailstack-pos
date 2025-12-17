import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage.1tsx';
import ProductsPage from './pages/ProductsPage';
import SalesPage from './pages/SalesPage';
import CategoriesPage from './pages/CategoriesPage';
import UsersPage from './pages/UsersPage';
import TenantsPage from './pages/TenantsPage';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import NewSalePage from './pages/NewSalePage';
import ProductImportPage from './pages/ProductImportPage'

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<LoginPage />} />
          <Route path="/tenants" element={<TenantsPage />} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardLayout>
                <DashboardPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/products" element={
            <ProtectedRoute>
              <DashboardLayout>
                <ProductsPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/products/import" element={
            <ProtectedRoute>
              <DashboardLayout>
                <ProductImportPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/sales" element={
            <ProtectedRoute>
              <DashboardLayout>
                <SalesPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/sales/new" element={
            <ProtectedRoute>
              <DashboardLayout>
                <NewSalePage />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/categories" element={
            <ProtectedRoute>
              <DashboardLayout>
                <CategoriesPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/users" element={
            <ProtectedRoute>
              <DashboardLayout>
                <UsersPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/tenants" element={
            <ProtectedRoute>
              <DashboardLayout>
                <TenantsPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          {/* Catch all route - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App; 