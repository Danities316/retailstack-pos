import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { OfflineIndicator } from './components/OfflineIndicator';
import HomePage from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import EmailVerificationPage from './pages/EmailVerificationPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import PasswordResetPage from './pages/PasswordResetPage';
import { Dashboard } from './pages/DashboardPage';
import { ProductsPage } from './pages/ProductsPage';
import { SalesPage } from './pages/SalesPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { UsersPage } from './pages/UsersPage';
import { TenantsPage } from './pages/TenantsPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AlreadyAuthenticatedRoute } from './components/AlreadyAuthenticatedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
import { NewSalePage } from './pages/NewSalePage';
import { ProductImportPage } from './pages/ProductImportPage';
import { CreateProductPage } from './pages/CreateProductPage';
import { CreateCategoryPage } from './pages/CreateCategoryPage';
import { EditCategoryPage } from './pages/EditCategoryPage';
import { CreateSalePage } from './pages/CreateSalePage';
import { SaleDetailPage } from './pages/SaleDetailPage';
import { InviteUserPage } from './pages/InviteUserPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { TenantDetailPage } from './pages/TenantDetailPage';
import { AuthProvider } from './context/AuthContext';
function App() {
  return (

    <ThemeProvider>
      <AuthProvider>
        <OfflineIndicator />
        <Router>
          <Routes>
            {/* Public Routes - check if already authenticated */}
            <Route path="/" element={
              <AlreadyAuthenticatedRoute redirectToDashboard={false}>
                <HomePage />
              </AlreadyAuthenticatedRoute>
            } />
            <Route path="/login" element={
              <AlreadyAuthenticatedRoute redirectToDashboard={true}>
                <LoginPage />
              </AlreadyAuthenticatedRoute>
            } />
            <Route path="/onboard" element={
              <AlreadyAuthenticatedRoute redirectToDashboard={false}>
                <OnboardingPage />
              </AlreadyAuthenticatedRoute>
            } />
            <Route path="/register" element={
              <AlreadyAuthenticatedRoute redirectToDashboard={true}>
                <LoginPage />
              </AlreadyAuthenticatedRoute>
            } />
            <Route path="/verify-email/:token" element={<EmailVerificationPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<PasswordResetPage />} />
            <Route path="/tenants" element={<TenantsPage />} />

            {/* Protected Routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <Dashboard />
                </DashboardLayout>
              </ProtectedRoute>
            } />

            <Route path="/dashboard/products" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ProductsPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/products/import" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ProductImportPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />

            <Route path="/dashboard/sales" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <SalesPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/sales/new" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <NewSalePage />
                </DashboardLayout>
              </ProtectedRoute>
            } />

            <Route path="/dashboard/categories" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <CategoriesPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />

            <Route path="/dashboard/users" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <UsersPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />

            <Route path="/dashboard/tenants" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <TenantsPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />

            {/* Additional dashboard routes for create/edit flows */}
            <Route path="/dashboard/products/new" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <CreateProductPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/products/:id/edit" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <CreateProductPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/categories/create" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <CreateCategoryPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/categories/:id/edit" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EditCategoryPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/sales/create" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <CreateSalePage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/sales/:id" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <SaleDetailPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/users/invite" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <InviteUserPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/users/:id" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <UserDetailPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/tenants/:id" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <TenantDetailPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/settings" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <Dashboard />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/reports" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <Dashboard />
                </DashboardLayout>
              </ProtectedRoute>
            } />

            {/* Catch all route - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>

  );
}

export default App; 