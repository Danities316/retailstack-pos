import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { SettingsPage } from './pages/SettingsPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { DashboardLayout } from './layouts/DashboardLayout'
import { Dashboard } from './pages/DashboardPage'
import { TenantRegisterPage } from './pages/TenantRegisterPage'
import { CreateProductPage } from './pages/CreateProductPage'
import { CreateSalePage } from './pages/CreateSalePage'
import { ProductsPage } from './pages/ProductsPage'
import { SalesPage } from './pages/SalesPage'
import { SaleDetailPage } from './pages/SaleDetailPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { CreateCategoryPage } from './pages/CreateCategoryPage'
import { EditCategoryPage } from './pages/EditCategoryPage'
import { UsersPage } from './pages/UsersPage'
import { InviteUserPage } from './pages/InviteUserPage'
import { UserSetupPage } from './pages/UserSetupPage'
import { UserDetailPage } from './pages/UserDetailPage'
import { TenantsPage } from './pages/TenantsPage'
import { TenantDetailPage } from './pages/TenantDetailPage'
import HomePage from './pages/HomePage'
import { useEffect } from 'react'
import { offlineDB } from '@/lib/indexedDB'
import { syncService } from '@/services/syncService'
// import './styles/globals.css'

function App() {
  useEffect(() => {
    // Initialize IndexedDB
    offlineDB.init()
    
    // Start background sync
    syncService.startBackgroundSync()

    return () => {
      syncService.stopBackgroundSync()
    }
  }, [])

  return (
    <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
            <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<TenantRegisterPage />} />
            <Route path="/users/setup/:token" element={<UserSetupPage />} />
          {/* <Route path="/login/:slug" element={<LoginPage />} /> */}
       

        <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
                  <Route path="settings" element={<SettingsPage />} />
                    <Route path="register/tenant" element={<TenantRegisterPage />} />
                    <Route path="products" element={<ProductsPage />} />
                    <Route path="products/create" element={<CreateProductPage />} />
                    <Route path="sales" element={<SalesPage />} />
                    <Route path="sales/create" element={<CreateSalePage />} />
              <Route path="sales/:id" element={<SaleDetailPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="categories/create" element={<CreateCategoryPage />} />
              <Route path="categories/:id/edit" element={<EditCategoryPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="users/invite" element={<InviteUserPage />} />
              <Route path="users/:id" element={<UserDetailPage />} />
              <Route path="tenants" element={<TenantsPage />} />
              <Route path="tenants/:id" element={<TenantDetailPage />} />
            </Route>
           </Routes>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
