// components/dashboard/QuickActions.tsx

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import {
    PlusIcon, TrendingUp, Package, Users, FileText, RefreshCw,
} from 'lucide-react'

const GOLD = '#D4AF37'

interface Action {
    label: string
    icon: React.ReactNode
    onClick: () => void
    variant?: 'primary' | 'outline'
    roles: string[]
}

export const QuickActions: React.FC = () => {
    const navigate = useNavigate()
    const { user } = useAuth()
    const role = user?.role ?? ''

    const actions: Action[] = [
        {
            label: 'New Sale',
            icon: <PlusIcon size={15} />,
            onClick: () => navigate('/dashboard/sales/new'),
            variant: 'primary',
            roles: ['CASHIER', 'MANAGER', 'OWNER'],
        },
        {
            label: 'View Reports',
            icon: <TrendingUp size={15} />,
            onClick: () => navigate('/dashboard/reports'),
            variant: 'outline',
            roles: ['MANAGER', 'OWNER'],
        },
        {
            label: 'Products',
            icon: <Package size={15} />,
            onClick: () => navigate('/dashboard/products'),
            variant: 'outline',
            roles: ['MANAGER', 'OWNER'],
        },
        {
            label: 'Users',
            icon: <Users size={15} />,
            onClick: () => navigate('/dashboard/users'),
            variant: 'outline',
            roles: ['OWNER'],
        },
    ]

    const visible = actions.filter(a => a.roles.includes(role))

    return (
        <section aria-label="Quick actions">
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 10px 0' }}>
                Quick Actions
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {visible.map(action => (
                    <Button
                        key={action.label}
                        onClick={action.onClick}
                        variant={action.variant === 'primary' ? undefined : 'outline'}
                        style={
                            action.variant === 'primary'
                                ? { background: GOLD, color: '#fff', borderRadius: 10, fontWeight: 700 }
                                : { borderColor: `${GOLD}66`, color: '#92400e', borderRadius: 10, fontWeight: 600 }
                        }
                    >
                        <span style={{ marginRight: 6 }}>{action.icon}</span>
                        {action.label}
                    </Button>
                ))}
            </div>
        </section>
    )
}