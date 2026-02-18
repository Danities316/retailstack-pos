import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import {
  LayoutDashboard,
  Settings,
  Users,
  Package,
  Tags,
  ShoppingCart,
  Building2,
  ChevronLeft,
  ChevronRight,
  LogOut
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles?: string[]
}

interface SidebarProps {
  isMobileOpen: boolean
  onMobileClose: () => void
  isCollapsed: boolean
  toggleCollapse: () => void
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Products', href: '/dashboard/products', icon: Package, roles: ['OWNER', 'MANAGER'] },
  { label: 'POS Terminal', href: '/dashboard/sales/new', icon: ShoppingCart, roles: ['CASHIER', 'OWNER', 'MANAGER'] },
  { label: 'Sales', href: '/dashboard/sales', icon: ShoppingCart, roles: ['CASHIER', 'OWNER', 'MANAGER'] },
  { label: 'Sales Reports', href: '/dashboard/sales', icon: ShoppingCart, roles: ['OWNER', 'MANAGER'] },
  { label: 'Categories', href: '/dashboard/categories', icon: Tags, roles: ['OWNER', 'MANAGER'] },
  { label: 'Users', href: '/dashboard/users', icon: Users, roles: ['OWNER', 'MANAGER'] },
  { label: 'Tenants', href: '/dashboard/tenants', icon: Building2, roles: ['SUPER_ADMIN'] },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings, roles: ['SUPER_ADMIN', 'OWNER'] }
]

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, onMobileClose, isCollapsed, toggleCollapse }) => {
  const { user, logout, isLoggingOut } = useAuth()
  const { theme } = useTheme()
  const location = useLocation()
  const isDark = theme.mode === 'dark'

  const handleLogout = async () => {
    onMobileClose()
    await logout()
  }

  const getInitial = (): string => user?.email?.charAt(0).toUpperCase() || 'R'
  const hasPermission = (item: NavItem): boolean => !item.roles || item.roles.includes(user?.role || '')
  const isActive = (href: string): boolean => {
    if (href === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname === href || location.pathname.startsWith(href + '/');
  }

  return (
    <aside
      className={`fixed top-0 left-0 z-50 h-screen max-h-screen flex flex-col
        ${isDark ? 'bg-gray-900' : 'bg-white'}
        border-r border-gray-100 dark:border-gray-800
        
        transition-all duration-300
        ${isCollapsed ? 'w-20' : 'w-64'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
    >
      {/* Logo/Header */}
      <div className={`flex items-center justify-between h-16 border-b border-gray-100 dark:border-gray-800 px-4`}>
        <div className="flex items-center gap-x-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">{getInitial()}</span>
          </div>
          {!isCollapsed && <span className="text-xl font-bold text-blue-600">RetailStack</span>}
        </div>
        <button
          onClick={toggleCollapse}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.filter(hasPermission).map(item => (
          <Link
            key={item.label}
            to={item.href}
            onClick={isMobileOpen ? onMobileClose : undefined}
            className={`flex items-center gap-x-3 w-full px-3 py-3 rounded-lg transition-colors
              ${isActive(item.href)
                ? 'bg-blue-50 text-blue-600 font-semibold'
                : 'text-gray-700 hover:bg-gray-100 font-medium'}
              ${isCollapsed ? 'justify-center px-0' : ''}`}
            style={isActive(item.href) ? { fontWeight: 700 } : {}}
          >
            <item.icon className="w-6 h-6" />
            {!isCollapsed && <span className="ml-1">{item.label}</span>}
          </Link>
        ))}
        {/* Divider before logout */}
        <div className="my-4 border-t border-gray-100 dark:border-gray-800 opacity-60" />
      </nav>
      {/* Footer/Logout */}
      <div className="mt-auto px-4 pb-6">
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`flex items-center gap-x-3 w-full px-3 py-3 rounded-lg transition-colors
      text-gray-500 hover:bg-red-50 hover:text-red-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed
      ${isCollapsed ? 'justify-center px-0' : ''}`}
        >
          <LogOut className="w-6 h-6" />
          {!isCollapsed && <span>{isLoggingOut ? 'Signing out...' : 'Logout'}</span>}
        </button>
      </div>
      {/* <div className="mt-auto px-4 pb-6">
        <button
          onClick={() => {
            setToken(null)
            onMobileClose()
          }}
          className={`flex items-center gap-x-3 w-full px-3 py-3 rounded-lg transition-colors
            text-gray-500 hover:bg-red-50 hover:text-red-600 font-medium
            ${isCollapsed ? 'justify-center px-0' : ''}`}
        >
          <LogOut className="w-6 h-6" />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div> */}
    </aside>
  )
}