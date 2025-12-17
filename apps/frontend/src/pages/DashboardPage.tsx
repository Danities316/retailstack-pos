import React from 'react';
import { useAuth } from '@/context/AuthContext';
// Import the specialized dashboard components
import { OwnerDashboard } from './OwnerDashboard';
import { ManagerDashboard } from './ManagerDashboard';
import { CashierDashboard } from './CashierDashboard';

export const Dashboard = () => {
    const { user } = useAuth();

    // Check if user object or role is missing
    if (!user || !user.role) {
        return (
            <div className="text-center p-10 mt-10">
                <h2 className="text-xl font-bold text-red-500">Authentication Error</h2>
                <p className="text-gray-500">Cannot determine user role. Please log in again.</p>
            </div>
        );
    }

    // Determine which dashboard to render based on the user role
    switch (user.role) {
        case 'SUPER_ADMIN':
        case 'OWNER':
            // Owner/Admin sees the full, comprehensive dashboard
            return <OwnerDashboard />;
        case 'MANAGER':
            // Managers see the operational dashboard
            return <ManagerDashboard />;
        case 'CASHIER':
            // Cashiers see the sales-focused dashboard
            return <CashierDashboard />;
        default:
            return (
                <div className="text-center p-10 mt-10">
                    <h2 className="text-xl font-bold text-red-500">Access Restricted</h2>
                    <p className="text-gray-500">Your role ({user.role}) does not have access to a dashboard view.</p>
                </div>
            );
    }
};