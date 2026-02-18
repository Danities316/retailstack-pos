import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Trash2, X, CreditCard, ShoppingCart, DollarSign, Package, Loader2, Zap, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '../lib/apiClient';

const HERO_GOLD = '#D4AF37';
const MOCK_CATEGORIES = ['Beverages', 'Apparel', 'Electronics', 'Snacks', 'Seasonal'];

interface Product {
    id: string;
    productName: string;
    sellingPrice: number;
    stock: number;
    barcode?: string;
    sku: string;
    imageUrl?: string;
}

interface CartItem extends Product {
    quantity: number;
}

export const NewSalePage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, token } = useAuth();

    const [searchTerm, setSearchTerm] = useState('');
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [isCartOpenOnMobile, setIsCartOpenOnMobile] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastSaleId, setLastSaleId] = useState<string | null>(null);

    const isAuthorized = user && ['OWNER', 'MANAGER', 'CASHIER'].includes(user.role);

    // --- (Backend Integration for Product Search) ---
    const fetchProducts = async (query: string = '') => {
        if (!token || !isAuthorized) {
            console.warn("Attempted to fetch products without authorization.");
            return;
        }

        setIsSearching(true);
        setError(null);

        try {

            const data: Product[] = await apiClient.searchProducts(query);

            // The backend handles the filtering (name, sku, barcode) and stock check.
            setProducts(data);
        } catch (err: any) {
            console.error("Product search failed:", err);
            // Handle errors thrown by apiClient.request (e.g., HTTP 401, 500)
            setError(err.message || "Could not connect to product search.");
            setProducts([]);
        } finally {
            setIsSearching(false);
        }
    };

    // useEffect(() => { if (isAuthorized) fetchProducts(); }, [isAuthorized]);
    useEffect(() => {
        if (isAuthorized) {
            fetchProducts(searchTerm);
        }
    }, [isAuthorized, token, searchTerm]);

    const totalAmount = useMemo(() => cart.reduce((sum, i) => sum + i.sellingPrice * i.quantity, 0), [cart]);

    const handleAddToCart = (p: Product) => {
        setCart(prev => {
            const exists = prev.find(i => i.id === p.id);
            if (exists) {
                return prev.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...p, quantity: 1 }];
        });
    };

    const updateQuantity = (id: string, q: number) => {
        if (q <= 0) return setCart(prev => prev.filter(i => i.id !== id));
        setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: q } : i));
    };

    const handleProcessPayment = async (paymentMethod: string) => {
        if (!token || !user || isProcessing) return;

        setIsProcessing(true);
        setError(null);
        console.log("user:", user);

        const saleData = {
            paymentMethod,
            items: cart.map(item => ({
                productId: item.id,
                quantity: item.quantity,
                price: item.sellingPrice
            })),
        };

        try {
            // Assume createSale returns { id: string } or the full sale object
            const sale = await apiClient.createSale(saleData);
            console.log("sale:", sale);

            setCart([]);

            // Set the ID to open the success modal
            setLastSaleId(sale.id);

        } catch (err: any) {
            console.error("Transaction failed:", err);
            setError(err.message || "Failed to process sale. Check inventory and connection.");
        } finally {
            setIsProcessing(false);
            setIsPaymentModalOpen(false);
        }
    };

    if (!isAuthorized) {
        return (
            <div className="text-center p-10">
                <AlertTriangle className="w-10 h-10 mx-auto text-red-500 mb-4" />
                <h2 className="text-xl font-bold">Permission Denied</h2>
            </div>
        );
    }

    // =========================================================================
    // SUCCESS MODAL LOGIC
    // =========================================================================
    const handleCloseSuccessModal = () => {
        setLastSaleId(null);
        // Clear the success query parameter if it somehow persisted (good practice)
        if (location.search.includes('success=true')) {
            navigate('/dashboard/sales/new', { replace: true });
        }
    };

    const handlePrintReceipt = () => {
        // In a real application, this function would prepare the receipt data (using lastSaleId)
        // and send it to a dedicated print utility or thermal printer API.

        // Mock print logic:
        console.log(`Printing receipt for Sale ID: ${lastSaleId}`);
        alert(`Receipt printing simulated for Sale ID: ${lastSaleId}.`);
    };

    const SuccessModal = () => {
        if (!lastSaleId) return null;

        return (
            <div
                className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
                onClick={handleCloseSuccessModal} // Dismiss by tap on backdrop
            >
                <Card
                    className="w-full max-w-sm p-6 rounded-xl shadow-2xl relative bg-white dark:bg-gray-800"
                    onClick={e => e.stopPropagation()} // Prevent click from closing modal
                >
                    <button
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
                        onClick={handleCloseSuccessModal}
                        aria-label="Close"
                    >
                        <X size={24} />
                    </button>

                    <div className="text-center pt-4">
                        <Zap className="w-12 h-12 mx-auto text-green-600 mb-4" />
                        <h2 className="text-2xl font-extrabold text-gray-800 dark:text-white">SALE COMPLETE!</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Transaction successful. Sale ID: **#{lastSaleId.substring(0, 8)}**
                        </p>
                        <p className="text-lg text-gray-700 dark:text-gray-300 font-semibold mt-4">What's next?</p>
                    </div>

                    <div className="flex flex-col space-y-3 mt-6">
                        <Button
                            onClick={handlePrintReceipt}
                            className="w-full py-3 text-lg font-bold text-white rounded-xl shadow-md transition-colors"
                            style={{ backgroundColor: HERO_GOLD }}
                        >
                            <DollarSign className="w-5 h-5 mr-2" />
                            Print Receipt
                        </Button>

                        <Button
                            onClick={handleCloseSuccessModal}
                            variant="outline"
                            className="w-full py-3 text-lg rounded-xl dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            <Plus className="w-5 h-5 mr-2" />
                            New Sale
                        </Button>
                    </div>
                </Card>
            </div>
        );
    };

    /** ------------------------- COMPONENTS ----------------------------- */

    const ProductDiscovery = () => (
        <div className="w-full md:w-2/3 lg:w-3/4 p-3 overflow-y-auto border-b md:border-b-0 md:border-r bg-gray-50 h-[50vh] md:h-full">
            <h2 className="text-lg font-bold mb-3">Products</h2>

            {/* SEARCH */}
            <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); fetchProducts(e.target.value); }}
                    className="pl-10 py-2"
                />
            </div>

            {/* CATEGORIES */}
            <div className="flex space-x-2 overflow-x-auto pb-2 mb-3">
                {MOCK_CATEGORIES.map(c => (
                    <Button key={c} variant="outline" className="text-xs px-3 py-1 whitespace-nowrap border-[#D4AF37] text-[#D4AF37]">
                        {c}
                    </Button>
                ))}
            </div>

            {/* PRODUCT GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {isSearching ? (
                    Array.from({ length: 6 }).map((_, i) => <Card key={i} className="h-32 animate-pulse bg-gray-200" />)
                ) : (
                    products.map(p => (
                        <Card key={p.id} className="p-2 shadow hover:shadow-md cursor-pointer" onClick={() => handleAddToCart(p)}>
                            <div className="text-sm font-semibold truncate">{p.productName}</div>
                            <div className="text-xs text-gray-500 -mt-4">Stock: {p.stock}</div>
                            <div className="font-bold text-[#D4AF37] text-lg">₦{p.sellingPrice}</div>
                            <Button className="w-full mt-2 h-7 text-xs bg-[#D4AF37] text-white" onClick={(e) => { e.stopPropagation(); handleAddToCart(p); }}>
                                <Plus size={14} /> Add
                            </Button>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );

    const TransactionSummary = () => (
        <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col h-[50vh] md:h-full bg-white shadow-inner">
            <div className="p-3 overflow-y-auto flex-1">
                <h2 className="text-lg font-bold mb-2">Order Summary</h2>

                {cart.length === 0 ? (
                    <div className="text-center text-gray-500 p-10">
                        <ShoppingCart className="w-8 h-8 mx-auto mb-2" />
                        Empty Cart
                    </div>
                ) : (
                    cart.map(item => (
                        <Card key={item.id} className="p-2 mb-2 flex items-center justify-between">
                            <div className="flex-1 min-w-0 mr-2">
                                <p className="font-semibold truncate">{item.productName}</p>
                                <p className="text-xs text-gray-500">₦{item.sellingPrice} each</p>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</Button>
                                <span className="font-bold w-5 text-center text-sm">{item.quantity}</span>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</Button>
                            </div>

                            <Trash2 className="text-red-400 ml-2" size={16} onClick={() => updateQuantity(item.id, 0)} />
                        </Card>
                    ))
                )}
            </div>

            {/* TOTAL + PAY */}
            <div className="p-3 border-t">
                <div className="flex justify-between text-sm mb-2">
                    <span>Subtotal</span>
                    <span>₦{totalAmount.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-sm mb-2">
                    <span>Total Due</span>
                    <span>₦{totalAmount.toFixed(2)}</span>
                </div>

                <Button className="w-full py-3 bg-[#D4AF37] text-white text-lg" disabled={!cart.length} onClick={() => setIsPaymentModalOpen(true)}>
                    Process Payment
                </Button>

                <Button variant="outline" className="w-full mt-2 text-red-500" onClick={() => setCart([])}>
                    Clear Cart
                </Button>
            </div>
        </div>
    );

    const PaymentModal = () => (
        isPaymentModalOpen ? (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                <Card className="w-full max-w-sm p-6 rounded-2xl">
                    <h2 className="text-xl font-bold mb-2 text-center">Total: ₦{totalAmount.toFixed(2)}</h2>
                    <p className="text-center text-gray-500 mb-4">Select payment method</p>

                    <div className="grid grid-cols-2 gap-3">
                        {["CASH", "CARD", "TRANSFER", "OTHER"].map(m => (
                            <Button key={m} className="h-16 text-sm font-semibold border-[#D4AF37] text-[#D4AF37]" variant="outline" onClick={() => handleProcessPayment(m)}>
                                {m}
                            </Button>
                        ))}
                    </div>

                    <Button className="w-full mt-4" variant="outline" onClick={() => setIsPaymentModalOpen(false)}>
                        Cancel
                    </Button>
                </Card>
            </div>
        ) : null
    );

    if (!isAuthorized) {
        // ... (return unauthorized message) ...
        return (
            <div className="text-center p-20 mt-10">
                <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
                <h2 className="text-2xl font-bold text-gray-800">Permission Denied</h2>
                <p className="text-gray-500">You must be a Cashier, Manager, or Owner to access the POS terminal.</p>
                <Button className="mt-4" onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col md:flex-row overflow-hidden">
            {ProductDiscovery()}
            {TransactionSummary()}
            {PaymentModal()}

            {isProcessing && (
                <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-40">
                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                </div>
            )}

            {error && (
                <div className="fixed bottom-3 right-3 bg-red-600 text-white py-2 px-3 rounded shadow-lg">{error}</div>
            )}

            {/* SUCCESS OVERLAY - Full screen, high impact */}
            {SuccessModal()} {/* NEW: Render the modal */}
            {PaymentModal()}

            {error && <div className="fixed bottom-0 right-0 m-4 p-3 bg-red-600 text-white rounded-lg shadow-xl z-50">{error}</div>}
            {isProcessing && <div className="fixed inset-0 bg-black bg-opacity-20 z-50 flex items-center justify-center"><Loader2 className="w-10 h-10 text-white animate-spin" /></div>}
        </div>
    );
}
