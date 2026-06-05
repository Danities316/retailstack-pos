import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { OfflineIndicator } from './components/OfflineIndicator';
import HomePage from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import EmailVerificationPage from './pages/EmailVerificationPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import PasswordResetPage from './pages/PasswordResetPage';
import { Dashboard } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
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
import { BarcodeProductPage } from './pages/BarcodeProductPage';
import { EditProductPage } from './pages/EditProductPage';
import { CreateCategoryPage } from './pages/CreateCategoryPage';
import { EditCategoryPage } from './pages/EditCategoryPage';
// import { CreateSalePage } from './pages/CreateSalePage';
import { SaleDetailPage } from './pages/SaleDetailPage';
import { InviteUserPage } from './pages/InviteUserPage';
import UserInviteSetupPage from './pages/UserInviteSetupPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { TenantDetailPage } from './pages/TenantDetailPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OfflineSyncProvider } from './context/OfflineSyncContext';
import { getPostLoginRoute } from './lib/postLoginRoute';
// Onboarding placeholder pages (UI implemented in next step)
import OnboardingProductPage from './pages/OnboardingProductPage';
import OnboardingFirstSalePage from './pages/OnboardingFirstSalePage';
import CustomerDebtPage from '@/pages/CustomerDebtPage'

// ─── Session-restore redirect guard ────────────────────────────────────────
// Runs inside Router so it has access to navigate/location.
// When an authenticated user refreshes the page, we re-check their correct
// destination and redirect them if they are on the wrong route.
//
// ONBOARDING ROUTES are intentionally excluded from redirect so a user who
// is mid-flow and refreshes stays on the onboarding step they were on.
const ONBOARDING_PATHS = ['/onboarding/product', '/onboarding/first-sale']

const SessionRestoreGuard = () => {
  const { isAuthenticated, loading, user, onboarding } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  React.useEffect(() => {
    // Only act once auth state has finished loading
    if (loading) return
    // Only act on authenticated sessions
    if (!isAuthenticated || !user) return
    // Don't interrupt a user who is actively in an onboarding flow
    if (ONBOARDING_PATHS.includes(location.pathname)) return
    // Don't interfere with public/auth pages
    const publicPaths = ['/', '/login', '/onboard', '/register', '/forgot-password']
    if (publicPaths.includes(location.pathname)) return

    const correctRoute = getPostLoginRoute(user, onboarding)

    // Only redirect when the user is definitively in the wrong place.
    // Specifically: a cashier who somehow lands on /dashboard should go to /pos.
    // We don't redirect owners away from /dashboard even if onboarding is incomplete —
    // they may have navigated there manually. The redirect only fires from /pos → correct.
    if (user.role === 'CASHIER' && location.pathname.startsWith('/dashboard')) {
      navigate(correctRoute, { replace: true })
    }
  }, [loading, isAuthenticated, user, onboarding, location.pathname])

  return null
}

function App() {
  return (
    <OfflineSyncProvider>
      <ThemeProvider>
        <AuthProvider>
          <OfflineIndicator />
          <Router>
            {/* Session-restore guard runs on every route, no UI */}
            <SessionRestoreGuard />
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
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />

              {/* Onboarding routes — protected, owner-only */}
              <Route path="/onboarding/product" element={
                <ProtectedRoute allowedRoles={['OWNER', 'SUPER_ADMIN']}>
                  <OnboardingProductPage />
                </ProtectedRoute>
              } />
              <Route path="/onboarding/first-sale" element={
                <ProtectedRoute allowedRoles={['OWNER', 'SUPER_ADMIN']}>
                  <OnboardingFirstSalePage />
                </ProtectedRoute>
              } />

              <Route path="/pos" element={
                <ProtectedRoute>
                  <NewSalePage />
                </ProtectedRoute>
              } />
              <Route path="/verify-email" element={<EmailVerificationPage />} />
              <Route path="/verify-email/:token" element={<EmailVerificationPage />} />
              <Route path="/auth/setup" element={<UserInviteSetupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password/:token" element={<PasswordResetPage />} />
              {/* <Route path="/tenants" element={<TenantsPage />} /> */}
              <Route path="/dashboard/sales/new" element={<Navigate to="/pos" replace />} />
              <Route path="/dashboard/sales/create" element={<Navigate to="/pos" replace />} />

              {/* Protected Routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Dashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              } />


              <Route path="/dashboard/debts" element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <CustomerDebtPage />
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
              <Route path="/dashboard/products/scan" element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <BarcodeProductPage />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              <Route path="/dashboard/products/:id/edit" element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <EditProductPage />
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
                    <SettingsPage />
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
    </OfflineSyncProvider>

  );
}

export default App;


// import React from 'react';
// import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// import { ThemeProvider } from './context/ThemeContext';
// import { OfflineIndicator } from './components/OfflineIndicator';
// import HomePage from './pages/HomePage';
// import { LoginPage } from './pages/LoginPage';
// import OnboardingPage from './pages/OnboardingPage';
// import EmailVerificationPage from './pages/EmailVerificationPage';
// import ForgotPasswordPage from './pages/ForgotPasswordPage';
// import PasswordResetPage from './pages/PasswordResetPage';
// import { Dashboard } from './pages/DashboardPage';
// import { SettingsPage } from './pages/SettingsPage';
// import { ProductsPage } from './pages/ProductsPage';
// import { SalesPage } from './pages/SalesPage';
// import { CategoriesPage } from './pages/CategoriesPage';
// import { UsersPage } from './pages/UsersPage';
// import { TenantsPage } from './pages/TenantsPage';
// import { ProtectedRoute } from './components/ProtectedRoute';
// import { AlreadyAuthenticatedRoute } from './components/AlreadyAuthenticatedRoute';
// import { DashboardLayout } from './layouts/DashboardLayout';
// import { NewSalePage } from './pages/NewSalePage';
// import { ProductImportPage } from './pages/ProductImportPage';
// import { CreateProductPage } from './pages/CreateProductPage';
// import { EditProductPage } from './pages/EditProductPage';
// import { CreateCategoryPage } from './pages/CreateCategoryPage';
// import { EditCategoryPage } from './pages/EditCategoryPage';
// // import { CreateSalePage } from './pages/CreateSalePage';
// import { SaleDetailPage } from './pages/SaleDetailPage';
// import { InviteUserPage } from './pages/InviteUserPage';
// import { UserDetailPage } from './pages/UserDetailPage';
// import { TenantDetailPage } from './pages/TenantDetailPage';
// import { AuthProvider } from './context/AuthContext';
// import { OfflineSyncProvider } from './context/OfflineSyncContext';
// function App() {
//   return (
//     <OfflineSyncProvider>
//       <ThemeProvider>
//         <AuthProvider>
//           <OfflineIndicator />
//           <Router>
//             <Routes>
//               {/* Public Routes - check if already authenticated */}
//               <Route path="/" element={
//                 <AlreadyAuthenticatedRoute redirectToDashboard={false}>
//                   <HomePage />
//                 </AlreadyAuthenticatedRoute>
//               } />
//               <Route path="/login" element={
//                 <AlreadyAuthenticatedRoute redirectToDashboard={true}>
//                   <LoginPage />
//                 </AlreadyAuthenticatedRoute>
//               } />
//               <Route path="/onboard" element={
//                 <AlreadyAuthenticatedRoute redirectToDashboard={false}>
//                   <OnboardingPage />
//                 </AlreadyAuthenticatedRoute>
//               } />
//               <Route path="/register" element={
//                 <AlreadyAuthenticatedRoute redirectToDashboard={true}>
//                   <LoginPage />
//                 </AlreadyAuthenticatedRoute>
//               } />

//               <Route path="/pos" element={
//                 <ProtectedRoute>
//                   <NewSalePage />
//                 </ProtectedRoute>
//               } />
//               <Route path="/verify-email/:token" element={<EmailVerificationPage />} />
//               <Route path="/forgot-password" element={<ForgotPasswordPage />} />
//               <Route path="/reset-password/:token" element={<PasswordResetPage />} />
//               {/* <Route path="/tenants" element={<TenantsPage />} /> */}
//               <Route path="/dashboard/sales/new" element={<Navigate to="/pos" replace />} />
//               <Route path="/dashboard/sales/create" element={<Navigate to="/pos" replace />} />

//               {/* Protected Routes */}
//               <Route path="/dashboard" element={
//                 <ProtectedRoute>
//                   <DashboardLayout>
//                     <Dashboard />
//                   </DashboardLayout>
//                 </ProtectedRoute>
//               } />

//               <Route path="/dashboard/products" element={
//                 <ProtectedRoute>
//                   <DashboardLayout>
//                     <ProductsPage />
//                   </DashboardLayout>
//                 </ProtectedRoute>
//               } />
//               <Route path="/dashboard/products/import" element={
//                 <ProtectedRoute>
//                   <DashboardLayout>
//                     <ProductImportPage />
//                   </DashboardLayout>
//                 </ProtectedRoute>
//               } />

//               <Route path="/dashboard/sales" element={
//                 <ProtectedRoute>
//                   <DashboardLayout>
//                     <SalesPage />
//                   </DashboardLayout>
//                 </ProtectedRoute>
//               } />
//               {/* <Route path="/dashboard/sales/new" element={
//                 <ProtectedRoute>
//                   <DashboardLayout>
//                     <NewSalePage />
//                   </DashboardLayout>
//                 </ProtectedRoute>
//               } /> */}

//               <Route path="/dashboard/categories" element={
//                 <ProtectedRoute>
//                   <DashboardLayout>
//                     <CategoriesPage />
//                   </DashboardLayout>
//                 </ProtectedRoute>
//               } />

//               <Route path="/dashboard/users" element={
//                 <ProtectedRoute>
//                   <DashboardLayout>
//                     <UsersPage />
//                   </DashboardLayout>
//                 </ProtectedRoute>
//               } />

//               <Route path="/dashboard/tenants" element={
//                 <ProtectedRoute>
//                   <DashboardLayout>
//                     <TenantsPage />
//                   </DashboardLayout>
//                 </ProtectedRoute>
//               } />

//               {/* Additional dashboard routes for create/edit flows */}
//               <Route path="/dashboard/products/new" element={
//                 <ProtectedRoute>
//                   <DashboardLayout>
//                     <CreateProductPage />
//                   </DashboardLayout>
//                 </ProtectedRoute>
//               } />
//               <Route path="/dashboard/products/:id/edit" element={
//                 <ProtectedRoute>
//                   <DashboardLayout>
//                     <EditProductPage />
//                   </DashboardLayout>
//                 </ProtectedRoute>
//               } />
//               <Route path="/dashboard/categories/create" element={
//                 <ProtectedRoute>
//                   <DashboardLayout>
//                     <CreateCategoryPage />
//                   </DashboardLayout>
//                 </ProtectedRoute>
//               } />
//               <Route path="/dashboard/categories/:id/edit" element={
//                 <ProtectedRoute>
//                   <DashboardLayout>
//                     <EditCategoryPage />
//                   </DashboardLayout>
//                 </ProtectedRoute>
//               } />
//               {/* <Route path="/dashboard/sales/create" element={
//                 <ProtectedRoute>
//                   <DashboardLayout>
//                     <CreateSalePage />
//                   </DashboardLayout>
//                 </ProtectedRoute>
//               } /> */}
//               <Route path="/dashboard/sales/:id" element={
//                 <ProtectedRoute>
//                   <DashboardLayout>
//                     <SaleDetailPage />
//                   </DashboardLayout>
//                 </ProtectedRoute>
//               } />
//               <Route path="/dashboard/users/invite" element={
//                 <ProtectedRoute>
//                   <DashboardLayout>
//                     <InviteUserPage />
//                   </DashboardLayout>
//                 </ProtectedRoute>
//               } />
//               <Route path="/dashboard/users/:id" element={
//                 <ProtectedRoute>
//                   <DashboardLayout>
//                     <UserDetailPage />
//                   </DashboardLayout>
//                 </ProtectedRoute>
//               } />
//               <Route path="/dashboard/tenants/:id" element={
//                 <ProtectedRoute>
//                   <DashboardLayout>
//                     <TenantDetailPage />
//                   </DashboardLayout>
//                 </ProtectedRoute>
//               } />
//               <Route path="/dashboard/settings" element={
//                 <ProtectedRoute>
//                   <DashboardLayout>
//                     <SettingsPage />
//                   </DashboardLayout>
//                 </ProtectedRoute>
//               } />
//               <Route path="/dashboard/reports" element={
//                 <ProtectedRoute>
//                   <DashboardLayout>
//                     <Dashboard />
//                   </DashboardLayout>
//                 </ProtectedRoute>
//               } />

//               {/* Catch all route - redirect to home */}
//               <Route path="*" element={<Navigate to="/" replace />} />
//             </Routes>
//           </Router>
//         </AuthProvider>
//       </ThemeProvider>
//     </OfflineSyncProvider>

//   );
// }

// export default App; 