import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import {
  LayoutDashboard,
  ShoppingCart,
  BarChart2,
  Package,
  Tags,
  Users,
  Building2,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  Zap,
  TrendingUp,
  Layers,
  Shield,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  AlertTriangle,
  Clock,
  Receipt,
  Boxes,
  UserCog,
  FileText,
  BookOpen,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string; size?: number }>
  roles?: string[]
  badge?: string
  badgeColor?: string
}

interface NavGroup {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string; size?: number }>
  items: NavItem[]
  roles?: string[]
  defaultOpen?: boolean
}

interface SidebarProps {
  isMobileOpen: boolean
  onMobileClose: () => void
  isCollapsed: boolean
  toggleCollapse: () => void
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'core',
    label: 'Core',
    icon: LayoutDashboard,
    defaultOpen: true,
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      {
        label: 'POS Terminal',
        href: '/pos',
        icon: Zap,
        roles: ['CASHIER', 'OWNER', 'MANAGER'],
        badge: 'Live',
        badgeColor: 'green',
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: ShoppingCart,
    defaultOpen: true,
    roles: ['OWNER', 'MANAGER', 'CASHIER'],
    items: [
      { label: 'Sales', href: '/dashboard/sales', icon: ShoppingCart, roles: ['CASHIER', 'OWNER', 'MANAGER'] },
      { label: 'Products', href: '/dashboard/products', icon: Package, roles: ['OWNER', 'MANAGER'] },
      { label: 'Categories', href: '/dashboard/categories', icon: Tags, roles: ['OWNER', 'MANAGER'] },
      { label: 'Inventory', href: '/dashboard/products', icon: Boxes, roles: ['OWNER', 'MANAGER'] },
    ],
  },
  {
    id: 'management',
    label: 'Management',
    icon: TrendingUp,
    defaultOpen: false,
    roles: ['OWNER', 'MANAGER'],
    items: [
      { label: 'Reports', href: '/dashboard/reports', icon: BarChart2, roles: ['OWNER', 'MANAGER'] },
      { label: 'Shifts', href: '/dashboard/sales', icon: Clock, roles: ['OWNER', 'MANAGER'] },
      { label: 'Receipts', href: '/dashboard/sales', icon: Receipt, roles: ['OWNER', 'MANAGER'] },
      { label: 'Users', href: '/dashboard/users', icon: Users, roles: ['OWNER', 'MANAGER'] },
    ],
  },
  {
    id: 'system',
    label: 'System',
    icon: Shield,
    defaultOpen: false,
    roles: ['SUPER_ADMIN', 'OWNER'],
    items: [
      { label: 'Settings', href: '/dashboard/settings', icon: Settings, roles: ['SUPER_ADMIN', 'OWNER'] },
      { label: 'Tenants', href: '/dashboard/tenants', icon: Building2, roles: ['SUPER_ADMIN'] },
      { label: 'Audit Logs', href: '/dashboard/settings', icon: FileText, roles: ['SUPER_ADMIN', 'OWNER'] },
      { label: 'User Roles', href: '/dashboard/users', icon: UserCog, roles: ['SUPER_ADMIN', 'OWNER'] },
    ],
  },
]

const ROLE_META: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: '#7C3AED' },
  OWNER: { label: 'Owner', color: '#D4AF37' },
  MANAGER: { label: 'Manager', color: '#2563EB' },
  CASHIER: { label: 'Cashier', color: '#16A34A' },
}

interface QuickAction {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string; size?: number }>
  color: string
  roles: string[]
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'New Sale', href: '/pos', icon: Zap, color: '#D4AF37', roles: ['OWNER', 'MANAGER', 'CASHIER'] },
  { label: 'Add Product', href: '/dashboard/products/new', icon: Package, color: '#2563EB', roles: ['OWNER', 'MANAGER'] },
  { label: 'Reports', href: '/dashboard/reports', icon: BarChart2, color: '#16A34A', roles: ['OWNER', 'MANAGER'] },
  {
    label: 'Customer Debts', icon: BookOpen, color: '#720d21', href: '/dashboard/debts', roles: ['OWNER', 'MANAGER', 'SUPER_ADMIN'],
  },
]

export const Sidebar: React.FC<SidebarProps> = ({
  isMobileOpen,
  onMobileClose,
  isCollapsed,
  toggleCollapse,
}) => {
  const { user, logout, isLoggingOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const isDark = theme.mode === 'dark'

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    NAV_GROUPS.forEach(g => { initial[g.id] = g.defaultOpen ?? false })
    return initial
  })

  useEffect(() => {
    const saved = localStorage.getItem('rs-sidebar-groups')
    if (saved) {
      try { setOpenGroups(JSON.parse(saved)) } catch { }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('rs-sidebar-groups', JSON.stringify(openGroups))
  }, [openGroups])

  useEffect(() => {
    NAV_GROUPS.forEach(group => {
      const hasActive = group.items.some(item => isActive(item.href))
      if (hasActive) setOpenGroups(prev => ({ ...prev, [group.id]: true }))
    })
  }, [location.pathname])

  const [isOnline, setIsOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const handleLogout = async () => { onMobileClose(); await logout() }
  const hasPermission = (roles?: string[]) => !roles || roles.includes(user?.role || '')
  const isActive = (href: string) => {
    if (href === '/dashboard') return location.pathname === '/dashboard'
    return location.pathname === href || location.pathname.startsWith(href + '/')
  }
  const toggleGroup = (id: string) => setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }))

  const roleMeta = ROLE_META[user?.role || ''] ?? { label: user?.role ?? '', color: '#64748B' }
  const userInitial = (user?.name || user?.email || 'R').charAt(0).toUpperCase()
  const visibleActions = QUICK_ACTIONS.filter(a => hasPermission(a.roles))

  const GOLD = '#D4AF37'
  const sidebarBg = isDark ? '#0F172A' : '#FFFFFF'
  const borderColor = isDark ? '#1E293B' : '#F1F5F9'
  const textPrimary = isDark ? '#F1F5F9' : '#0F172A'
  const textMuted = isDark ? '#64748B' : '#94A3B8'
  const activeBg = isDark ? '#1E293B' : '#FFFBEB'
  const hoverBg = isDark ? '#1E293B' : '#F8FAFC'
  const groupLabel = isDark ? '#334155' : '#CBD5E1'

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm"
          onClick={onMobileClose}
        />
      )}

      <aside
        style={{ background: sidebarBg, borderRight: `1px solid ${borderColor}` }}
        className={`
          fixed top-0 left-0 z-50 h-screen flex flex-col
          transition-all duration-300 ease-in-out select-none
          ${isCollapsed ? 'w-[72px]' : 'w-[260px]'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div
          style={{ borderBottom: `1px solid ${borderColor}`, height: 64 }}
          className="flex items-center justify-between px-4 shrink-0"
        >
          {isCollapsed ? (
            <div className="flex items-center justify-between w-full">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto" style={{ background: GOLD }}>
                <Layers size={16} className="text-white" />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: GOLD }}>
                  <Layers size={16} className="text-white" />
                </div>
                <div>
                  <div className="font-bold text-sm tracking-wide" style={{ color: textPrimary }}>RetailStack</div>
                  <div className="text-[10px] font-medium" style={{ color: textMuted }}>POS Enterprise</div>
                </div>
              </div>
              <button
                onClick={toggleCollapse}
                className="p-1.5 rounded-md transition-colors"
                style={{ color: textMuted }}
                onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
              </button>
            </>
          )}
        </div>

        {/* Expand button when collapsed */}
        {isCollapsed && (
          <button
            onClick={toggleCollapse}
            className="absolute -right-3 top-5 w-6 h-6 rounded-full border flex items-center justify-center z-10"
            style={{ background: sidebarBg, borderColor, color: textMuted }}
          >
            <ChevronRight size={12} />
          </button>
        )}

        {/* Connectivity */}
        {!isCollapsed && (
          <div
            className="mx-3 mt-3 px-3 py-1.5 rounded-md flex items-center gap-2"
            style={{
              background: isOnline ? (isDark ? '#052e16' : '#f0fdf4') : (isDark ? '#431407' : '#fff7ed'),
              border: `1px solid ${isOnline ? (isDark ? '#14532d' : '#bbf7d0') : (isDark ? '#7c2d12' : '#fed7aa')}`,
            }}
          >
            {isOnline
              ? <Wifi size={12} style={{ color: '#16a34a' }} />
              : <WifiOff size={12} style={{ color: '#ea580c' }} />
            }
            <span className="text-[11px] font-medium" style={{ color: isOnline ? '#16a34a' : '#ea580c' }}>
              {isOnline ? 'Connected — data uploaded' : 'Offline mode'}
            </span>
            {!isOnline && <AlertTriangle size={11} style={{ color: '#ea580c', marginLeft: 'auto' }} />}
          </div>
        )}

        {/* Quick actions */}
        {!isCollapsed && visibleActions.length > 0 && (
          <div className="px-3 mt-3 flex gap-1.5">
            {visibleActions.map(action => (
              <Link
                key={action.label}
                to={action.href}
                onClick={onMobileClose}
                className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-center transition-all"
                style={{
                  background: isDark ? '#1E293B' : '#F8FAFC',
                  border: `1px solid ${borderColor}`,
                  color: action.color,
                  fontSize: 10,
                  fontWeight: 600,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = action.color + '18'
                  e.currentTarget.style.borderColor = action.color + '44'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = isDark ? '#1E293B' : '#F8FAFC'
                  e.currentTarget.style.borderColor = borderColor
                }}
              >
                <action.icon size={14} />
                <span>{action.label}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5">
          {NAV_GROUPS.filter(g => hasPermission(g.roles)).map(group => {
            const visibleItems = group.items.filter(item => hasPermission(item.roles))
            if (visibleItems.length === 0) return null

            const isGroupOpen = openGroups[group.id]
            const groupHasActive = visibleItems.some(item => isActive(item.href))

            return (
              <div key={group.id} className="mb-0.5">
                {isCollapsed ? (
                  <div className="mx-2 my-2 border-t" style={{ borderColor }} />
                ) : (
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-md mb-0.5 transition-colors"
                    style={{ color: groupHasActive ? GOLD : groupLabel }}
                    onMouseEnter={e => (e.currentTarget.style.color = textPrimary)}
                    onMouseLeave={e => (e.currentTarget.style.color = groupHasActive ? GOLD : groupLabel)}
                  >
                    <div className="flex items-center gap-2">
                      <group.icon size={12} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{group.label}</span>
                    </div>
                    {isGroupOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  </button>
                )}

                {(isCollapsed || isGroupOpen) && (
                  <div className="space-y-0.5">
                    {visibleItems.map(item => {
                      const active = isActive(item.href)
                      return (
                        <Link
                          key={item.label}
                          to={item.href}
                          onClick={isMobileOpen ? onMobileClose : undefined}
                          title={isCollapsed ? item.label : undefined}
                          className="flex items-center rounded-lg transition-all duration-150"
                          style={{
                            gap: isCollapsed ? 0 : 10,
                            padding: isCollapsed ? '10px 0' : '8px 10px',
                            justifyContent: isCollapsed ? 'center' : 'flex-start',
                            background: active ? activeBg : 'transparent',
                            color: active ? GOLD : textMuted,
                            fontWeight: active ? 600 : 400,
                            fontSize: 13.5,
                            borderLeft: active && !isCollapsed ? `2px solid ${GOLD}` : '2px solid transparent',
                          }}
                          onMouseEnter={e => {
                            if (!active) {
                              e.currentTarget.style.background = hoverBg
                              e.currentTarget.style.color = textPrimary
                            }
                          }}
                          onMouseLeave={e => {
                            if (!active) {
                              e.currentTarget.style.background = 'transparent'
                              e.currentTarget.style.color = textMuted
                            }
                          }}
                        >
                          <span className="flex-shrink-0" style={{ color: active ? GOLD : 'inherit' }}>
                            <item.icon size={17} />
                          </span>
                          {!isCollapsed && (
                            <>
                              <span className="flex-1 truncate">{item.label}</span>
                              {item.badge && (
                                <span
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={{
                                    background: item.badgeColor === 'green' ? '#16a34a22' : GOLD + '22',
                                    color: item.badgeColor === 'green' ? '#16a34a' : GOLD,
                                  }}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Bottom */}
        <div style={{ borderTop: `1px solid ${borderColor}` }} className="shrink-0 pb-3 pt-2">
          {!isCollapsed && (
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors"
              style={{ color: textMuted }}
              onMouseEnter={e => (e.currentTarget.style.color = textPrimary)}
              onMouseLeave={e => (e.currentTarget.style.color = textMuted)}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
              <span className="text-[13px]">{isDark ? 'Light mode' : 'Dark mode'}</span>
            </button>
          )}

          <div
            className="mx-2 mt-1 rounded-xl p-2.5 flex items-center"
            style={{
              background: isDark ? '#1E293B' : '#F8FAFC',
              gap: isCollapsed ? 0 : 10,
              justifyContent: isCollapsed ? 'center' : 'flex-start',
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
              style={{ background: roleMeta.color + '22', color: roleMeta.color }}
            >
              {userInitial}
            </div>

            {!isCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold truncate" style={{ color: textPrimary }}>
                    {user?.name || user?.email?.split('@')[0] || 'User'}
                  </div>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: roleMeta.color + '18', color: roleMeta.color }}
                  >
                    {roleMeta.label}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="p-1.5 rounded-md transition-colors disabled:opacity-40"
                  style={{ color: textMuted }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#ef444418'
                    e.currentTarget.style.color = '#ef4444'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = textMuted
                  }}
                  title="Sign out"
                >
                  <LogOut size={14} />
                </button>
              </>
            )}
          </div>

          {isCollapsed && (
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex justify-center py-2 mt-1 transition-colors disabled:opacity-40"
              style={{ color: textMuted }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={e => (e.currentTarget.style.color = textMuted)}
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>

        {!isCollapsed && (
          <div className="px-4 pb-2 text-center" style={{ color: groupLabel, fontSize: 9, letterSpacing: '0.08em' }}>
            RETAILSTACK ENTERPRISE © 2026
          </div>
        )}
      </aside>
    </>
  )
}
