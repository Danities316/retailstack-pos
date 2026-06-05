import { ReactNode, useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'
import { Outlet } from 'react-router-dom'
import SyncStatus from '@/components/SyncStatus'

interface DashboardLayoutProps {
  children: ReactNode
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { user } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarCollapsed(false)
        setIsMobileMenuOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ── Cashier layout ─────────────────────────────────────────────────────────
  // A cashier sees nothing but the POS. No sidebar, no header, no chrome.
  // The POS page itself contains the only UI they need: product grid,
  // cart, payment modal, and an Exit button.
  if (user?.role === 'CASHIER') {
    return (
      <ThemeProvider tenantId={user?.tenantId}>
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            {children}
            <Outlet />
          </div>
        </div>
      </ThemeProvider>
    )
  }

  // ── Owner / Manager / Super Admin layout ───────────────────────────────────
  return (
    <ThemeProvider tenantId={user?.tenantId}>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <Sidebar
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
          isCollapsed={isSidebarCollapsed}
          toggleCollapse={() => setIsSidebarCollapsed(v => !v)}
        />

        <div
          className={`
            flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out
            ${isSidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[260px]'}
          `}
        >
          <Header
            toggleSidebar={() => setIsMobileMenuOpen(v => !v)}
            isSidebarOpen={!isSidebarCollapsed}
          />

          <div className="px-6 pt-4 pb-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <SyncStatus />
          </div>

          <main className="flex-1 overflow-y-auto">
            {children}
            <Outlet />
          </main>
        </div>
      </div>
    </ThemeProvider>
  )
}

// import { ReactNode, useState, useEffect } from 'react'
// import { useAuth } from '@/context/AuthContext'
// import { ThemeProvider } from '@/context/ThemeContext'
// import { Sidebar } from '@/components/Sidebar'
// import { Header } from '@/components/Header'
// import { Outlet } from 'react-router-dom'
// import Outbox from '@/components/Outbox'
// import SyncStatus from '@/components/SyncStatus'

// interface DashboardLayoutProps {
//   children: ReactNode
// }

// export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
//   const { user } = useAuth()
//   const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
//   const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
//   const [isSidebarOpen, setIsSidebarOpen] = useState(true)
//   const [activePage, setActivePage] = useState('Dashboard')
//   const toggleSidebar = () => {
//     setIsSidebarOpen(!isSidebarOpen)
//   }

//   // Auto-collapse sidebar on mobile
//   useEffect(() => {
//     const handleResize = () => {
//       if (window.innerWidth < 1024) {
//         setIsSidebarCollapsed(false) // Don't auto-collapse on mobile
//         setIsMobileMenuOpen(false) // Close mobile menu on resize
//       }
//     }

//     window.addEventListener('resize', handleResize)
//     return () => window.removeEventListener('resize', handleResize)
//   }, [])

//   const handleMobileMenuToggle = () => {
//     setIsMobileMenuOpen(!isMobileMenuOpen)
//   }

//   const handleMobileMenuClose = () => {
//     setIsMobileMenuOpen(false)
//   }

//   const handleSidebarToggleCollapse = () => {
//     setIsSidebarCollapsed(!isSidebarCollapsed)
//   }

//   return (
//     <ThemeProvider tenantId={user?.tenantId}>
//       <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
//         {/* Sidebar */}
//         <Sidebar
//           isMobileOpen={isMobileMenuOpen}
//           onMobileClose={handleMobileMenuClose}
//           isCollapsed={isSidebarCollapsed}
//           toggleCollapse={handleSidebarToggleCollapse}
//         />

//         {/* Main Content */}
//         <div
//           className={`
//             flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out
//             ${isSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}
//           `}
//         >
//           {/* Header */}
//           {/* <Header
//             onMobileMenuClick={handleMobileMenuToggle}
//           /> */}

//           <Header
//             toggleSidebar={toggleSidebar}
//             isSidebarOpen={isSidebarOpen}
//             storeName="Danities Supermarket"
//           />

//           {/* Sync Status Bar */}
//           <div className="px-6 pt-4 pb-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
//             <SyncStatus />
//           </div>


//           {/* Page Content */}
//           <main className="flex-1 min-h-0 overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
//             <div className="max-w-7xl w-full px-6 py-6 h-full">
//               <div className="animate-in fade-in duration-200 h-full w-full">
//                 {children}
//                 <Outlet />
//                 <Outbox />
//               </div>
//             </div>
//           </main>
//         </div>
//       </div>
//     </ThemeProvider>
//   )
// }