import React from 'react'
import { MenuIcon, BellIcon, UserIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
interface HeaderProps {
  toggleSidebar: () => void
  isSidebarOpen: boolean
  storeName: string
}
export const Header = ({
  toggleSidebar,
  isSidebarOpen,
  storeName,
}: HeaderProps) => {
  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center px-4 sticky top-0 z-10">
      <div className="flex items-center">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-md text-gray-500 hover:bg-gray-100 md:flex hidden"
        >
          <MenuIcon size={20} />
        </button>
        <h2 className="text-lg font-semibold ml-2 text-gray-800 md:block hidden">
          {storeName}
        </h2>
      </div>
      <div className="flex-1 flex justify-center px-4 md:px-0">
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
      <div className="flex items-center space-x-4">
        <Button variant="default" size="sm" className="hidden md:flex">
          New Sale
        </Button>
        <Button variant="outline" size="sm" className="hidden md:flex">
          Add Product
        </Button>
        <button className="p-2 rounded-md text-gray-500 hover:bg-gray-100 relative">
          <BellIcon size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
          <UserIcon size={16} className="text-gray-500" />
        </div>
      </div>
    </header>
  )
}
