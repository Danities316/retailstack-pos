/**
 * OnboardingFirstSalePage — FULL IMPLEMENTATION
 * Owner lands here when hasProduct === true but hasSale === false.
 *
 * Renders a simplified POS:
 *  - loads owner's actual products from the API
 *  - lets them add items to a cart
 *  - processes a real sale via apiClient.createSale()
 *  - on success → updates onboarding.hasSale → navigates to /dashboard
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '@/lib/apiClient'
import { OnboardingShell } from './OnboardingShell'
import {
    ShoppingCart, Plus, Minus, Trash2, Banknote, Smartphone,
    CreditCard, CheckCircle2, Loader2, AlertCircle, ArrowRight,
    Package, MoreHorizontal, RefreshCw, Sparkles,
} from 'lucide-react'

const GOLD = '#D4AF37'
const N = (n: number) => '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface Product {
    id: string; productName: string; sellingPrice: number; stock: number
}
interface CartLine { product: Product; qty: number }

const PAY_METHODS = [
    { id: 'CASH', label: 'Cash', Icon: Banknote, color: '#16a34a' },
    { id: 'TRANSFER', label: 'Transfer', Icon: Smartphone, color: '#2563eb' },
    { id: 'CARD', label: 'POS Card', Icon: CreditCard, color: '#7c3aed' },
    { id: 'OTHER', label: 'Other', Icon: MoreHorizontal, color: '#64748b' },
]

function ErrorBanner({ message }: { message: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#ef444415', border: '1px solid #ef444430', borderRadius: 8, padding: '10px 14px' }}>
            <AlertCircle size={15} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ color: '#fca5a5', fontSize: 13 }}>{message}</span>
        </div>
    )
}

export default function OnboardingFirstSalePage() {
    const navigate = useNavigate()
    const { token, user, updateOnboarding } = useAuth()

    const [products, setProducts] = useState<Product[]>([])
    const [productsLoading, setProductsLoading] = useState(true)
    const [cart, setCart] = useState<CartLine[]>([])
    const [payMethod, setPayMethod] = useState<string>('CASH')
    const [processing, setProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [done, setDone] = useState(false)
    const [saleId, setSaleId] = useState<string | null>(null)

    const loadProducts = useCallback(async () => {
        if (!token) return
        setProductsLoading(true)
        try {
            // fetchProducts with empty query returns all for tenant
            const data = await apiClient.request('/products/search?query=&limit=50')
            const list: Product[] = (data?.products || data || []).filter((p: Product) => p.stock > 0)
            setProducts(list)
        } catch {
            // Fallback: try plain /products
            try {
                const fallback = await apiClient.request('/products')
                setProducts((fallback || []).filter((p: Product) => p.stock > 0))
            } catch (err: any) {
                setError('Could not load your products. Please refresh.')
            }
        } finally {
            setProductsLoading(false)
        }
    }, [token])

    useEffect(() => { loadProducts() }, [loadProducts])

    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(l => l.product.id === product.id)
            if (existing) {
                if (existing.qty >= product.stock) return prev
                return prev.map(l => l.product.id === product.id ? { ...l, qty: l.qty + 1 } : l)
            }
            return [...prev, { product, qty: 1 }]
        })
    }

    const setQty = (productId: string, qty: number) => {
        if (qty <= 0) {
            setCart(prev => prev.filter(l => l.product.id !== productId))
        } else {
            setCart(prev => prev.map(l => l.product.id === productId ? { ...l, qty } : l))
        }
    }

    const total = cart.reduce((sum, l) => sum + l.product.sellingPrice * l.qty, 0)

    const handleCompleteSale = async () => {
        if (cart.length === 0 || !token || processing) return
        setProcessing(true); setError(null)
        try {
            const sale = await apiClient.createSale({
                paymentMethod: payMethod,
                items: cart.map(l => ({ productId: l.product.id, quantity: l.qty, price: l.product.sellingPrice })),
            })
            setSaleId(sale?.id || null)
            setDone(true)
            updateOnboarding({ hasSale: true })
        } catch (err: any) {
            setError(err.message || 'Sale failed. Please try again.')
        } finally {
            setProcessing(false)
        }
    }

    const handleSkip = () => {
        updateOnboarding({ hasSale: true })
        navigate('/dashboard')
    }

    // ── SUCCESS SCREEN ──────────────────────────────────────────────────────────
    if (done) {
        return (
            <OnboardingShell currentStep={2}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 20, textAlign: 'center', paddingTop: 32 }}>
                    <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#16a34a22', border: '2px solid #16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle2 size={38} color="#16a34a" />
                    </div>
                    <div>
                        <h2 style={{ color: '#f8fafc', fontSize: 24, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.5px' }}>
                            🎉 First sale recorded!
                        </h2>
                        <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>
                            Your business is live on RetailStack.
                        </p>
                        {saleId && (
                            <p style={{ color: '#475569', fontSize: 12, marginTop: 6 }}>
                                Sale ID: <code style={{ color: '#94a3b8' }}>{saleId.slice(0, 12).toUpperCase()}</code>
                            </p>
                        )}
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '20px 28px', maxWidth: 380, width: '100%' }}>
                        <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 4px' }}>Total collected</p>
                        <p style={{ color: GOLD, fontSize: 32, fontWeight: 900, margin: 0, letterSpacing: '-1px' }}>{N(total)}</p>
                        <p style={{ color: '#475569', fontSize: 12, margin: '4px 0 0' }}>{cart.length} item(s) · {payMethod}</p>
                    </div>

                    <button
                        onClick={() => navigate('/dashboard')}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, background: GOLD, color: '#0f172a', border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}
                    >
                        <Sparkles size={17} /> Go to your Dashboard <ArrowRight size={16} />
                    </button>
                </div>
            </OnboardingShell>
        )
    }

    // ── MAIN POS ────────────────────────────────────────────────────────────────
    return (
        <OnboardingShell currentStep={2}>
            {/* Header */}
            <div style={{ marginBottom: 24, paddingTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ShoppingCart size={18} color="#16a34a" />
                    </div>
                    <h1 style={{ color: '#f8fafc', fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
                        Record your first sale
                    </h1>
                </div>
                <p style={{ color: '#64748b', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
                    Pick a product, set the quantity, choose a payment method, and complete the sale.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

                {/* LEFT — Product picker */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                            Your Products
                        </span>
                        <button onClick={loadProducts} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                            <RefreshCw size={11} /> Refresh
                        </button>
                    </div>

                    {productsLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0', color: '#475569' }}>
                            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
                        </div>
                    ) : products.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 16px', color: '#475569' }}>
                            <Package size={28} style={{ marginBottom: 8, opacity: 0.5 }} />
                            <p style={{ margin: 0, fontSize: 13 }}>No products with stock found.</p>
                            <button onClick={() => navigate('/onboarding/product')} style={{ marginTop: 10, background: 'none', border: `1px solid ${GOLD}`, color: GOLD, borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
                                Add a product first
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                            {products.map(p => {
                                const inCart = cart.find(l => l.product.id === p.id)
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => addToCart(p)}
                                        style={{
                                            all: 'unset', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                                            background: inCart ? `${GOLD}12` : 'rgba(255,255,255,0.03)',
                                            border: `1px solid ${inCart ? GOLD + '44' : 'rgba(255,255,255,0.06)'}`,
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        <div style={{ minWidth: 0 }}>
                                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{p.productName}</p>
                                            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>Stock: {p.stock}</p>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                            <span style={{ color: GOLD, fontWeight: 700, fontSize: 13 }}>{N(p.sellingPrice)}</span>
                                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: inCart ? GOLD : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Plus size={12} color={inCart ? '#0f172a' : '#94a3b8'} />
                                            </div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* RIGHT — Cart + payment */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* Cart */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                            <ShoppingCart size={14} color="#94a3b8" />
                            <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Cart</span>
                            {cart.length > 0 && (
                                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setCart([])}>
                                    Clear all
                                </span>
                            )}
                        </div>

                        {cart.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '20px 0', color: '#334155' }}>
                                <ShoppingCart size={28} style={{ opacity: 0.3, marginBottom: 6 }} />
                                <p style={{ margin: 0, fontSize: 12 }}>Tap a product to add it</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {cart.map(({ product, qty }) => (
                                    <div key={product.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <p style={{ flex: 1, margin: 0, fontSize: 12, color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{product.productName}</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                            <button onClick={() => setQty(product.id, qty - 1)} style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                                <Minus size={10} />
                                            </button>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', minWidth: 18, textAlign: 'center' }}>{qty}</span>
                                            <button onClick={() => setQty(product.id, qty + 1)} disabled={qty >= product.stock} style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', cursor: qty >= product.stock ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                                <Plus size={10} />
                                            </button>
                                        </div>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: GOLD, minWidth: 70, textAlign: 'right' }}>{N(product.sellingPrice * qty)}</span>
                                        <button onClick={() => setQty(product.id, 0)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 0, display: 'flex' }}>
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}

                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>Total</span>
                                    <span style={{ color: GOLD, fontSize: 18, fontWeight: 900 }}>{N(total)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Payment method */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16 }}>
                        <p style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 12px' }}>Payment Method</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {PAY_METHODS.map(({ id, label, Icon, color }) => (
                                <button
                                    key={id}
                                    onClick={() => setPayMethod(id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px',
                                        border: `1.5px solid ${payMethod === id ? color : 'rgba(255,255,255,0.08)'}`,
                                        borderRadius: 8, background: payMethod === id ? color + '15' : 'transparent',
                                        cursor: 'pointer', color: payMethod === id ? color : '#64748b',
                                        fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                                    }}
                                >
                                    <Icon size={13} /> {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && <ErrorBanner message={error} />}

                    {/* Actions */}
                    <button
                        onClick={handleCompleteSale}
                        disabled={cart.length === 0 || processing}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            background: cart.length === 0 || processing ? '#334155' : '#16a34a',
                            color: cart.length === 0 || processing ? '#64748b' : '#fff',
                            border: 'none', borderRadius: 10, padding: '13px 0', width: '100%',
                            fontSize: 14, fontWeight: 700, cursor: cart.length === 0 || processing ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        {processing
                            ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Processing…</>
                            : <><CheckCircle2 size={15} /> Complete Sale {cart.length > 0 && `· ${N(total)}`}</>
                        }
                    </button>

                    <button onClick={handleSkip} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 12, fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 3, textAlign: 'center', padding: '4px 0' }}>
                        Skip and go to dashboard
                    </button>
                </div>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </OnboardingShell>
    )
}