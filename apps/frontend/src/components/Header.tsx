import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import {
  Bell,
  Sun,
  Moon,
  User,
  ChevronDown,
  MenuIcon,
  Search as SearchIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  toggleSidebar: () => void
  isSidebarOpen: boolean
  storeName?: string
}

export const Header = ({
  toggleSidebar,
  isSidebarOpen,
  storeName,
}: HeaderProps) => {
  const { user, logout, isLoggingOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleLogout = async () => {
    setShowUserMenu(false)
    await logout()
  }

  const pathnames = location.pathname.split('/').filter(Boolean)
  const breadcrumbs = pathnames.map((name, index) => {
    const href = `/${pathnames.slice(0, index + 1).join('/')}`
    const label = name.charAt(0).toUpperCase() + name.slice(1)
    return { href, label }
  })

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-16 flex items-center px-4 sticky top-0 z-30">
      {/* Sidebar Toggle & Store Name */}
      <div className="flex items-center min-w-0">
        {/* Sidebar Toggle (mobile/desktop) */}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors lg:hidden"
        >
          <MenuIcon size={20} />
        </button>
        {/* Store Name */}
        <span className="text-xl font-bold text-blue-600 mx-4"> Adino POS - {storeName || 'Store Name'}</span>
      </div>
      {/* Centered Search Bar */}
      <div className="flex-1 flex justify-center px-6 md:px-0">
        <div className="w-full max-w-md hidden md:block">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Search..."
            />
          </div>
        </div>
      </div>
      {/* Right Section: Actions */}
      <div className="flex items-center space-x-4 ml-2">
        {/* Action Buttons (desktop only) */}
        <Button variant="outline" size="sm" className="hidden md:flex bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          New Sale
        </Button>
        <Button variant="outline" size="sm" className="hidden md:flex bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          Add Product
        </Button>
        {/* Theme Toggle */}
        {/* <button
          onClick={toggleTheme}
          className="p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={`Switch to ${theme.mode === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme.mode === 'light' ? (
            <Moon className="w-5 h-5" />
          ) : (
            <Sun className="w-5 h-5" />
          )}
        </button> */}
        {/* Notifications */}
        <button className="p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 relative transition-colors">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-base font-semibold text-gray-900 dark:text-white truncate max-w-[120px]">
                {user?.email}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                {user?.role}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>
          {/* User Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
              <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                <div className="text-base font-semibold text-gray-900 dark:text-white">
                  {user?.email}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {user?.email}
                </div>
              </div>
              <a
                href="/dashboard/settings"
                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setShowUserMenu(false)}
              >
                Settings
              </a>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingOut ? 'Signing out...' : 'Sign out'}
              </button>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={`Switch to ${theme.mode === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme.mode === 'light' ? (
                  <Moon className="w-5 h-5" />
                ) : (
                  <Sun className="w-5 h-5" />
                )}

              </button>

            </div>
          )}
        </div>
      </div>
    </header>
  )
} 