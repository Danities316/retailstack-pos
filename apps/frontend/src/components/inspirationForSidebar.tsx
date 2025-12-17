import React from 'react'
import {
  LayoutDashboardIcon,
  PackageIcon,
  ShoppingCartIcon,
  UsersIcon,
  UserIcon,
  BarChart3Icon,
  SettingsIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react'
interface SidebarProps {
  isOpen: boolean
  activePage: string
  setActivePage: (page: string) => void
}
export const Sidebar = ({
  isOpen,
  activePage,
  setActivePage,
}: SidebarProps) => {
  const menuItems = [
    {
      name: 'Dashboard',
      icon: <LayoutDashboardIcon size={20} />,
    },
    {
      name: 'Products',
      icon: <PackageIcon size={20} />,
    },
    {
      name: 'Sales',
      icon: <ShoppingCartIcon size={20} />,
    },
    {
      name: 'Customers',
      icon: <UsersIcon size={20} />,
    },
    {
      name: 'Employees',
      icon: <UserIcon size={20} />,
    },
    {
      name: 'Reports',
      icon: <BarChart3Icon size={20} />,
    },
    {
      name: 'Settings',
      icon: <SettingsIcon size={20} />,
    },
  ]
  return (
    <>
      {/* Desktop & Tablet Sidebar */}
      <div
        className={`hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ease-in-out ${isOpen ? 'w-64' : 'w-20'} h-full`}
      >
        <div
          className={`flex items-center justify-center h-16 border-b border-gray-200 ${isOpen ? 'px-4' : 'px-2'}`}
        >
          {isOpen ? (
            <h1 className="text-xl font-bold text-blue-600">RetailStack</h1>
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">R</span>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="px-2 space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.name}
                onClick={() => setActivePage(item.name)}
                className={`flex items-center w-full px-3 py-3 rounded-lg transition-colors ${activePage === item.name ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                <div className="flex items-center justify-center">
                  {item.icon}
                </div>
                {isOpen && (
                  <span className="ml-3 font-medium">{item.name}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>
      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-gray-200 z-10">
        <div className="flex justify-around items-center h-16">
          {menuItems.map((item) => (
            <button
              key={item.name}
              onClick={() => setActivePage(item.name)}
              className={`flex flex-col items-center justify-center p-2 ${activePage === item.name ? 'text-blue-600' : 'text-gray-600'}`}
            >
              {item.icon}
              <span className="text-xs mt-1">{item.name}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
