import { ReactNode, useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'
import { Outlet } from 'react-router-dom'

interface DashboardLayoutProps {
  children: ReactNode
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { user } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [activePage, setActivePage] = useState('Dashboard')
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarCollapsed(false) // Don't auto-collapse on mobile
        setIsMobileMenuOpen(false) // Close mobile menu on resize
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false)
  }

  const handleSidebarToggleCollapse = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed)
  }

  return (
    <ThemeProvider tenantId={user?.tenantId}>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={handleMobileMenuClose}
          isCollapsed={isSidebarCollapsed} 
          toggleCollapse={handleSidebarToggleCollapse}
        />

        {/* Main Content */}
        <div
          className={`
            flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out
            ${isSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}
          `}
        >
          {/* Header */}
          {/* <Header 
            onMobileMenuClick={handleMobileMenuToggle}
          /> */}
        
        <Header
          toggleSidebar={toggleSidebar}
          isSidebarOpen={isSidebarOpen}
          storeName="Your Store"
        />
        

          {/* Page Content */}
          <main className="flex-1 min-h-0 overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            <div className="max-w-7xl w-full px-6 py-6 h-full">
              <div className="animate-in fade-in duration-200 h-full w-full">
                {children}
                <Outlet />
<<<<<<< HEAD
          </div>
          </div>
      </main>
    </div>
=======
              </div>
            </div>
          </main>
        </div>
>>>>>>> f3fdb7e (Initial commit)
      </div>
    </ThemeProvider>
  )
}