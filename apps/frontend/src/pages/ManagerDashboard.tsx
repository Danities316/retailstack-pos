import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Users, Clock, AlertTriangle, DollarSign, Loader2, Package } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '../lib/apiClient';

interface LowStockItem {
    id: string;
    productName: string;
    stock: number;
}

interface LeaderboardEntry {
    name: string;
    sales: number;
}

interface ManagerStats {
    staffClockedIn: {
        current: number;
        total: number;
    };
    lowStock: {
        count: number;
        items: LowStockItem[];
    };
    currentShiftSales: number;
    staffLeaderboard: LeaderboardEntry[];
}


const initialStats: ManagerStats = {
    staffClockedIn: { current: 0, total: 0 },
    lowStock: { count: 0, items: [] },
    currentShiftSales: 0,
    staffLeaderboard: [],
};


export const ManagerDashboard = () => {
    const { user, token } = useAuth();
    const [stats, setStats] = useState<ManagerStats>(initialStats);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const HERO_GOLD = '#D4AF37';

    // Helper for currency formatting
    const formatCurrency = (amount: number) => {
        // Ucurrency is 'en-NG' for Naira
        return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
    };

    // 3. Data Fetching Effect
    useEffect(() => {
        const fetchStats = async () => {
            if (!user?.tenantId || !token) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);
            try {
                // Call the new API method
                const data: ManagerStats = await apiClient.getManagerDashboardStats(user.tenantId, token);
                setStats(data);
            } catch (err: any) {
                console.error("Error fetching manager stats:", err);
                setError(err.message || 'Failed to fetch operational data.');
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [user?.tenantId, token]);


    // --- Loading and Error States ---
    if (loading) {
        return (
            <div className="flex justify-center items-center h-full min-h-64">
                <Loader2 className="w-8 h-8 mr-2 animate-spin text-gray-500" />
                <p className="text-gray-500">Loading Operational Data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700">
                <p className="font-semibold">Error fetching data:</p>
                <p>{error}</p>
            </div>
        );
    }

    // 4. Update JSX with dynamic data
    return (
        <div className="space-y-8 p-4 md:p-0">
            <h1 className="text-3xl font-extrabold text-gray-900">
                Operational View
            </h1>
            <p className="text-base text-gray-500 mt-1">
                Focus on staff performance, inventory, and shift management.
            </p>

            {/* Manager-Specific Quick Stats - Using a 4-column grid for better layout */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* 1. Staff Clocked In */}
                <Card className="p-6 rounded-xl shadow-lg border-l-4 border-l-[#D4AF37]">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-500">Staff Clocked In</p>
                        <Users className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="text-3xl font-bold mt-1 text-gray-900">
                        {stats.staffClockedIn.current} / {stats.staffClockedIn.total}
                    </div>
                </Card>

                {/* 2. Low Stock Alerts */}
                <Card className="p-6 rounded-xl shadow-lg border-l-4 border-l-red-500">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-500">Low Stock Alerts</p>
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="text-3xl font-bold mt-1 text-red-600">
                        {stats.lowStock.count} items
                    </div>
                </Card>

                {/* 3. Current Shift Sales */}
                <Card className="p-6 rounded-xl shadow-lg border-l-4 border-l-blue-500 col-span-2">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-500">Current Shift Sales (Active Cashiers)</p>
                        <DollarSign className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="text-4xl font-extrabold mt-1 text-blue-600">
                        {formatCurrency(stats.currentShiftSales)}
                    </div>
                </Card>
            </div>

            {/* Main Content Area: Staff Performance Leaderboard */}
            <Card className="p-6 rounded-2xl shadow-xl">
                <h2 className="text-xl font-bold text-gray-800 mb-6">Staff Performance Leaderboard (Active Shifts)</h2>

                {stats.staffLeaderboard.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">No active sales recorded yet in any shift.</div>
                ) : (
                    <div className="space-y-4 max-h-[300px] overflow-y-auto">
                        {stats.staffLeaderboard.map((entry, index) => (
                            <div
                                key={entry.name}
                                className={`flex justify-between items-center p-4 rounded-lg transition-all 
                                    ${index === 0 ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-200'}
                                    border shadow-sm
                                `}
                            >
                                <div className="flex items-center space-x-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${index === 0 ? 'bg-yellow-500' : 'bg-gray-400'}`}>
                                        {index + 1}
                                    </div>
                                    <span className="font-semibold text-lg text-gray-800">{entry.name}</span>
                                </div>
                                <div className="text-xl font-extrabold" style={{ color: index === 0 ? HERO_GOLD : '#1F2937' }}>
                                    {formatCurrency(entry.sales)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Low Stock Detailed List */}
            {stats.lowStock.count > 0 && (
                <Card className="p-6 rounded-2xl shadow-xl">
                    <h2 className="text-xl font-bold text-red-600 mb-4 flex items-center">
                        <Package className="w-6 h-6 mr-2" /> {stats.lowStock.count} Items Needing Restock (Below 5 Units)
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {stats.lowStock.items.map(item => (
                            <div key={item.id} className="p-3 bg-red-50 border-l-4 border-red-400 rounded-md">
                                <p className="font-semibold text-gray-800 truncate">{item.productName}</p>
                                <p className="text-sm text-red-600">Stock: {item.stock}</p>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
};