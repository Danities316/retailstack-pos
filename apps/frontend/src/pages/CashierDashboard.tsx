import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { ShoppingCart, LogOut, DollarSign, Clock, Wifi, CloudOff, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '../lib/apiClient';
// Assuming usePWAStatus is a custom hook you'll create for offline/sync status
// import { usePWAStatus } from '@/context/PWAContext'; 

// Mock hook for demonstration (replace with actual PWA/Sync logic)
const usePWAStatus = () => ({
    isOnline: true,
    isSyncing: false,
    lastSync: new Date().toLocaleTimeString(),
    syncError: null
});

interface ActiveShift {
    id: string;
    startTime: string;
    startFloat: number; // Cash float amount
}

export const CashierDashboard = () => {
    const navigate = useNavigate();
    const { setToken, user } = useAuth();
    const { isOnline, isSyncing, lastSync, syncError } = usePWAStatus();
    const [activeShift, setActiveShift] = useState<ActiveShift | null>(null);
    const [loadingShift, setLoadingShift] = useState(true);
    const [floatAmount, setFloatAmount] = useState(0);
    const [showFloatModal, setShowFloatModal] = useState(false);
    const [showSignOffModal, setShowSignOffModal] = useState(false);
    const HERO_GOLD = '#D4AF37';

    // Mock Shift Statistics State (replace with actual API fetch)
    const [shiftStats, setShiftStats] = useState({
        totalSales: 45000.00,
        transactionCount: 25,
        shiftDuration: '03:45 Hrs',
    });
    const [loadingStats, setLoadingStats] = useState(false); // Skeleton/Loading State implementation

    useEffect(() => {
        const fetchShift = async () => {
            if (!user?.tenantId) return;
            setLoadingShift(true);
            try {
                // Assuming apiClient.getActiveShift() exists (GET /api/shifts/active-shift)
                const shift: ActiveShift | null = await apiClient.getActiveShift();
                setActiveShift(shift);
                if (shift) {
                    setFloatAmount(parseFloat(String(shift.startFloat)));

                }
            } catch (err) {
                console.error('Failed to fetch active shift:', err);
                // Handle error
            } finally {
                setLoadingShift(false);
            }
        };
        fetchShift();
    }, [user?.tenantId]);

    // 2. Handle Clock In
    const handleClockIn = async () => {
        if (!user || activeShift || floatAmount <= 0) {
            alert('Please enter a valid float amount to start your shift.');
            return;
        }

        setShowFloatModal(false);
        setLoadingShift(true);
        try {

            const response: { message: string, shift: ActiveShift } = await apiClient.clockInShift({ startFloat: floatAmount });
            const newShift = response.shift
            setActiveShift(newShift);
        } catch (err: any) {
            alert(`Clock-in failed: ${err.message || 'Server error'}`);
        } finally {
            setLoadingShift(false);
        }
    };


    // 3. Handle Clock Out (and Sign Off)
    const handleSignOffClick = () => {
        // Check if the user is clocked in
        if (activeShift) {
            // If clocked in, show the full reconciliation/sign-off modal
            // We can reuse the `floatAmount` state for reconciliation, but for a real app,
            // you would prompt the user to *enter* the final float here.
            // For now, let's just show the modal.
            setShowSignOffModal(true);
        } else {
            // If not clocked in, just log out directly (or confirm logout)
            const shouldSignOff = window.confirm("You are not clocked into a shift. Are you sure you want to Sign Off?");
            if (shouldSignOff) {
                setToken(null);
                navigate('/login');
            }
        }
    };

    const handleConfirmClockOutAndSignOff = async () => {
        // 1. Close the modal immediately
        setShowSignOffModal(false);

        // 2. Perform Clock Out if a shift is active
        if (activeShift) {
            setLoadingShift(true);
            try {
                // Note: In a production app, you would add a step here
                // to get the final cash count (`endFloat`) from a modal form.
                const reconciliationData = {
                    endFloat: floatAmount, // Using the current float state as a placeholder for final count
                };

                await apiClient.clockOutShift(activeShift.id, reconciliationData);
                setActiveShift(null); // Clear shift state after successful clock-out
            } catch (err: any) {
                // IMPORTANT: Block sign-off if clock-out fails.
                alert(`Clock-out failed: ${err.message || 'Server error'}. Please contact a manager.`);
                setLoadingShift(false); // Stop loading, but DO NOT proceed to sign off.
                return;
            } finally {
                setLoadingShift(false);
            }
        }

        // 3. Final sign-off (log out) - only runs if clock-out succeeded or wasn't needed
        setToken(null);
        navigate('/login');
    };

    // Clock In Float Modal
    const ClockInModal = () => {
        if (!showFloatModal) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <Card className="p-6 w-full max-w-sm rounded-xl shadow-2xl">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Start Shift: Cash Float</h2>
                    <p className="text-gray-600 mb-4">Enter the starting cash amount in your drawer.</p>
                    <Input
                        type="number"
                        placeholder="e.g., 5000"
                        value={floatAmount || ''}
                        onChange={(e) => setFloatAmount(parseFloat(e.target.value) || 0)}
                        className="mb-4"
                        min="0"
                        autoFocus
                    />
                    <Button
                        className="w-full h-12 bg-green-500 hover:bg-green-600 text-white font-semibold"
                        onClick={handleClockIn}
                        disabled={floatAmount <= 0 || loadingShift}
                    >
                        {loadingShift ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Clock className="w-5 h-5 mr-2" />}
                        Clock In
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full mt-2"
                        onClick={() => setShowFloatModal(false)}
                    >
                        Cancel
                    </Button>
                </Card>
            </div>
        )
    }

    // Helper component for Shift Stats for clarity and reuse
    const ShiftStat = ({ Icon, label, value, color }: { Icon: React.ElementType, label: string, value: string, color: string }) => (
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border-l-4" style={{ borderColor: color }}>
            <div className="flex items-center">
                <Icon className="w-5 h-5 mr-3" style={{ color }} />
                <span className="text-sm font-medium text-gray-600">{label}</span>
            </div>
            <span className="text-lg font-bold text-gray-900">{value}</span>
        </div>
    );

    return (
        <div className="p-4 md:p-8 space-y-8">
            <h1 className="text-3xl font-extrabold text-gray-900">
                Cashier Terminal
            </h1>
            <p className="text-base text-gray-500 mt-1">
                Your dedicated interface for daily transactions and shift management.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* ---------------------------------------------------- */}
                {/* Action Zone: Start Sale, Clock In/Out */}
                {/* ---------------------------------------------------- */}
                <div className="md:col-span-2 space-y-6">
                    <Card className="p-6 rounded-2xl shadow-xl flex flex-col items-center">
                        <ShoppingCart className="w-12 h-12 text-gray-400 mb-3" />
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Ready to Serve?</h2>

                        {/* Loading State */}
                        {loadingShift && (
                            <div className="py-8"><Loader2 className="w-8 h-8 animate-spin text-gray-500" /></div>
                        )}

                        {/* Shift Active: Show Start Sale Button */}
                        {!loadingShift && activeShift && (
                            <>
                                <Button
                                    className="w-full h-16 text-lg font-bold transition-transform transform hover:scale-[1.01]"
                                    style={{ backgroundColor: HERO_GOLD, color: 'white' }}
                                    onClick={() => navigate('/new-sale')}
                                >
                                    <ShoppingCart className="w-6 h-6 mr-3" /> Start New Sale
                                </Button>
                                <p className="text-sm text-green-600 mt-3">
                                    <Clock className="w-4 h-4 inline mr-1" /> Shift Active since: {new Date(activeShift.startTime).toLocaleTimeString()} (Float: ₦{activeShift.startFloat})
                                </p>
                            </>
                        )}


                        {/* No Active Shift: Show Clock In Button */}
                        {!loadingShift && !activeShift && (
                            <>
                                <Button
                                    className="w-full h-16 text-lg font-bold transition-transform transform hover:scale-[1.01] border-2"
                                    style={{ borderColor: HERO_GOLD, color: HERO_GOLD }}
                                    variant="outline"
                                    onClick={() => setShowFloatModal(true)} // Open float modal
                                >
                                    <Clock className="w-6 h-6 mr-3" /> Clock In to Start Shift
                                </Button>
                                <p className="text-sm text-red-600 mt-3">
                                    <AlertTriangle className="w-4 h-4 inline mr-1" /> You must clock in before making sales.
                                </p>
                            </>
                        )}

                        <div className="w-full h-px bg-gray-200 my-6"></div>

                        {/* Clock Out/Logout Button */}
                        <button
                            onClick={handleSignOffClick}
                            className="w-full py-3 flex items-center justify-center text-base font-semibold text-gray-600 hover:text-white bg-gray-100 hover:bg-red-600 rounded-xl transition-colors shadow-sm"
                            disabled={loadingShift}
                        >
                            <LogOut className="w-5 h-5 mr-2" />
                            {activeShift ? "Clock Out & Sign Off" : "Sign Off"}
                        </button>
                    </Card>
                </div>

                {/* ======================================= */}
                {/* 3. Sign-Off Confirmation Modal */}
                {/* ======================================= */}
                {showSignOffModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                        <Card className="p-8 w-full max-w-sm bg-white dark:bg-gray-800 shadow-2xl rounded-xl">
                            <div className="text-center">
                                <LogOut className="w-8 h-8 mx-auto text-red-600 mb-4" />
                                <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">
                                    Confirm Shift End & Sign Off
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    You are about to **Clock Out** and **Sign Off**.
                                    <br />
                                    Please ensure all sales are complete.
                                </p>

                                {/* Reconciliation Summary (using placeholder floatAmount) */}
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg mb-6">
                                    <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                                        Final Cash Count: ₦{floatAmount.toFixed(2)}
                                    </p>
                                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                        (This value will be used as the End Float for reconciliation.)
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Button
                                    onClick={handleConfirmClockOutAndSignOff}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold"
                                >
                                    <LogOut className="w-5 h-5 mr-2" /> Clock Out & Sign Off
                                </Button>
                                <Button
                                    onClick={() => setShowSignOffModal(false)}
                                    variant="outline"
                                    className="w-full text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </Card>
                    </div>
                )}


                {/* ---------------------------------------------------- */}
                {/* Shift & Reliability Zone */}
                {/* ---------------------------------------------------- */}
                <div className="space-y-6">
                    <Card className="p-6 rounded-2xl shadow-xl space-y-4">
                        <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-2">Shift Performance</h3>
                        {activeShift ? (
                            <div className="space-y-3">
                                <ShiftStat
                                    Icon={DollarSign}
                                    label="Total Sales"
                                    value={`₦${shiftStats.totalSales.toFixed(2)}`}
                                    color={HERO_GOLD}
                                />
                                <ShiftStat
                                    Icon={ShoppingCart}
                                    label="Transactions"
                                    value={`${shiftStats.transactionCount}`}
                                    color="#10B981"
                                />
                                <ShiftStat
                                    Icon={Clock}
                                    label="Shift Duration"
                                    value={shiftStats.shiftDuration}
                                    color="#3B82F6"
                                />
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 text-center py-4">
                                Clock in to view shift metrics.
                            </p>
                        )}
                    </Card>

                    <Card className="p-6 rounded-2xl shadow-xl space-y-4">
                        <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-2">System Reliability</h3>
                        <ShiftStat
                            Icon={isOnline ? Wifi : CloudOff}
                            label="Connection Status"
                            value={isOnline ? 'Online' : 'Offline'}
                            color={isOnline ? '#10B981' : '#EF4444'}
                        />
                        <ShiftStat
                            Icon={RefreshCw}
                            label="Last Sync"
                            value={lastSync}
                            color="#3B82F6"
                        />
                        {syncError && (
                            <div className="flex items-center pt-2 border-t border-red-200 text-red-600">
                                <AlertTriangle className="w-4 h-4 mr-1" /> Data Error: {syncError}
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* Render Clock In Modal */}
            {ClockInModal()}

        </div>
    );
};