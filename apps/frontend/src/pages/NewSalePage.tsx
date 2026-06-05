/**
 * RetailStack POS Terminal — Enterprise Edition
 * Speed-optimised for Nigerian SMB cashiers.
 *
 * Keyboard shortcuts
 *   F2 / /        → focus search
 *   Escape        → clear search / close modal
 *   Enter         → add first search result to cart
 *   Ctrl+Enter    → open payment (when cart has items)
 *   1–4           → select payment method inside payment modal
 *   C             → quick Cash confirm inside payment modal
 *   Backspace ×2  → clear cart (double-tap guard)
 */

import React, {
  useState, useEffect, useMemo, useRef, useCallback, memo,
} from 'react';
import {
  Search, Plus, X, ShoppingCart, Package, Loader2,
  AlertTriangle, Printer, Banknote, CreditCard,
  Smartphone, MoreHorizontal, CheckCircle2, ScanLine,
  Minus, RefreshCw, Clock, Wifi, WifiOff,
  Tag, Keyboard, Zap, BookOpen,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '../lib/apiClient';
import { openDatabase, putInStore, getAllFromStore } from '../offline/db';
import { globalSyncQueue } from '../offline/SyncQueue';
import { getIsEffectivelyOnline } from '../hooks/useSimulateOffline';
import { useOnlineStatus } from '../hooks/useOnlineStatus';


// ─── Tokens ──────────────────────────────────────────────────────────────────
const GOLD = '#D4AF37';
const VAT = 0.075; // FIRS 7.5 %

// ─── Nigerian payment methods (Cash first — most common) ──────────────────────
const PAY = [
  { id: 'CASH', label: 'Cash', Icon: Banknote, col: '#16a34a', sub: 'Naira / coins', key: '1' },
  { id: 'TRANSFER', label: 'Transfer', Icon: Smartphone, col: '#2563eb', sub: 'Bank / USSD', key: '2' },
  { id: 'CARD', label: 'POS Card', Icon: CreditCard, col: '#7c3aed', sub: 'Debit / credit', key: '3' },
  { id: 'CREDIT', label: 'Owe Me', Icon: BookOpen, col: '#dc2626', sub: 'Charge to account', key: '4' },
  { id: 'OTHER', label: 'Other', Icon: MoreHorizontal, col: '#64748b', sub: 'Voucher / cheque', key: '5' },
] as const;

const DENOMS = [200, 500, 1_000, 2_000, 5_000, 10_000];

// ─── Types ────────────────────────────────────────────────────────────────────
interface Category { id: string; categoryName: string }
interface Product {
  id: string; productName: string; sellingPrice: number;
  stock: number; barcode?: string; sku: string;
  imageUrl?: string; categoryId?: string;
}
interface CartItem extends Product { qty: number; disc: number }
interface DoneSale {
  id: string; items: CartItem[];
  sub: number; vat: number; total: number;
  method: string; paid: number; change: number;
  cashier: string; store: string; ts: Date;
  pendingSync?: boolean; // true when sale was saved offline, not yet synced to server
  customerName: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const N = (n: number) =>
  '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const Nk = (n: number) =>
  n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `₦${(n / 1_000).toFixed(1)}k`
      : N(n);

const stockBadge = (s: number) =>
  s === 0 ? { label: 'Out of stock', color: '#ef4444' }
    : s <= 3 ? { label: `⚠ ${s} left`, color: '#ea580c' }
      : s <= 10 ? { label: `Low: ${s}`, color: '#d97706' }
        : { label: `${s} in stock`, color: '#16a34a' };

// ─── 80-mm thermal receipt ────────────────────────────────────────────────────
const getReceiptHtml = (s: DoneSale) => {
  const rows = s.items.map(i => {
    const lt = i.sellingPrice * i.qty * (1 - i.disc / 100);
    return `<tr>
      <td style="font-size:11px;padding:2px 0">${i.productName}${i.disc ? ` (-${i.disc}%)` : ''}</td>
      <td style="font-size:11px;text-align:center">${i.qty}</td>
      <td style="font-size:11px;text-align:right">${N(lt)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Receipt #${s.id.slice(0, 8).toUpperCase()}</title>
<style>
  @page{size:80mm auto;margin:3mm}*{box-sizing:border-box}
  body{font-family:'Courier New',monospace;width:72mm;margin:0 auto;color:#000;font-size:12px}
  .c{text-align:center}.b{font-weight:700}
  .hr{border-top:1px dashed #000;margin:5px 0}
  .rw{display:flex;justify-content:space-between;padding:2px 0}
  .tr{display:flex;justify-content:space-between;padding:3px 0;font-weight:700;font-size:14px}
  table{width:100%;border-collapse:collapse}
  th{font-size:9px;text-transform:uppercase;border-bottom:1px solid #000;padding:2px 0}
  .ft{text-align:center;font-size:9px;color:#555;margin-top:8px}
  .vb{text-align:center;font-size:10px;border:1px solid #000;padding:3px;margin:5px 0}
  .pending{text-align:center;font-size:11px;font-weight:700;border:2px dashed #d97706;color:#d97706;padding:5px;margin:6px 0;letter-spacing:.05em}
</style></head><body>
${s.pendingSync ? '<div class="pending">⚠ PENDING SYNC — SALE QUEUED OFFLINE</div>' : ''}
<div class="c b" style="font-size:15px;margin-bottom:2px">${s.store}</div>
<div class="c" style="font-size:9px;color:#555">★ OFFICIAL SALES RECEIPT ★</div>
<div class="hr"></div>
<div class="rw"><span>Receipt:</span><span>#${s.id.slice(0, 8).toUpperCase()}</span></div>
<div class="rw"><span>Date:</span><span>${s.ts.toLocaleDateString('en-NG')}</span></div>
<div class="rw"><span>Time:</span><span>${s.ts.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</span></div>
<div class=\"rw\"><span>Cashier:</span><span>${s.cashier}</span></div>\n${s.customerName ? `<div class=\"rw\"><span>Customer:</span><span>${s.customerName}</span></div>` : ''}
<div class="hr"></div>
<table><thead><tr>
  <th style="text-align:left">Item</th>
  <th style="text-align:center">Qty</th>
  <th style="text-align:right">Total</th>
</tr></thead><tbody>${rows}</tbody></table>
<div class="hr"></div>
<div class="rw"><span>Subtotal</span><span>${N(s.sub)}</span></div>
${s.vat > 0 ? `<div class=\"rw\"><span>VAT</span><span>${N(s.vat)}</span></div>` : ''}
<div class="hr"></div>
<div class="tr"><span>TOTAL DUE</span><span>${N(s.total)}</span></div>
<div class="hr"></div>
<div class=\"rw\"><span>Payment</span><span>${s.method === 'CREDIT' ? 'Charged to Account' : s.method}</span></div>
${s.method === 'CREDIT' ? `<div class=\"rw b\" style=\"color:#dc2626\"><span>AMOUNT OWED</span><span>${N(s.total)}</span></div>` : ''}
<div class="rw"><span>Tendered</span><span>${N(s.paid)}</span></div>
${s.change > 0 ? `<div class="rw b"><span>CHANGE</span><span>${N(s.change)}</span></div>` : ''}
<div class="hr"></div>
${s.vat > 0 ? '<div class=\"vb\">VAT INCLUSIVE — FIRS REGISTERED</div>' : '<div class=\"ft\">Prices are VAT exclusive</div>'}
<div class="ft">
  <div>Thank you for your patronage!</div>
  <div style="margin-top:2px">Powered by RetailStack POS Enterprise</div>
  <div style="margin-top:4px;font-size:8px">${s.id.toUpperCase()}</div>
</div></body></html>`;
};

// ─── Kbd badge ────────────────────────────────────────────────────────────────
const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: '#f1f5f9', border: '1px solid #cbd5e1',
    borderRadius: 4, padding: '1px 5px',
    fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
    color: '#475569', lineHeight: 1.6,
  }}>
    {children}
  </kbd>
);

function stringToColorPOS(str: string): string {
  const palette = [
    '#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981',
    '#ef4444', '#ec4899', '#14b8a6', '#f97316',
    '#6366f1', '#84cc16',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length] ?? '#0ea5e9';
}

// ─── Memoised product card ────────────────────────────────────────────────────
const ProductCard = memo(({ p, qtyInCart, onAdd }: {
  p: Product; qtyInCart: number; onAdd: (p: Product) => void;
}) => {
  const [imageFailed, setImageFailed] = useState(false)
  const oos = p.stock === 0;
  const badge = stockBadge(p.stock);
  const showImage = p.productImage && !imageFailed;
  return (
    <button
      disabled={oos}
      onClick={() => onAdd(p)}
      style={{
        all: 'unset', display: 'flex', flexDirection: 'column',
        background: '#fff',
        border: `1.5px solid ${qtyInCart > 0 ? GOLD + '88' : '#e8edf2'}`,
        borderRadius: 12, padding: '10px 10px 8px',
        cursor: oos ? 'not-allowed' : 'pointer',
        opacity: oos ? 0.45 : 1, position: 'relative',
        boxShadow: qtyInCart > 0 ? `0 0 0 2px ${GOLD}22` : '0 1px 3px rgba(0,0,0,.05)',
        transition: 'transform .1s,box-shadow .1s',
        textAlign: 'left', userSelect: 'none', width: '100%',
      }}
      onMouseEnter={e => {
        if (!oos) {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 14px rgba(0,0,0,.10)';
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLButtonElement).style.boxShadow =
          qtyInCart > 0 ? `0 0 0 2px ${GOLD}22` : '0 1px 3px rgba(0,0,0,.05)';
      }}
    >
      {qtyInCart > 0 && (
        <span style={{
          position: 'absolute', top: 6, right: 6,
          background: GOLD, color: '#fff', fontSize: 10, fontWeight: 800,
          width: 20, height: 20, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{qtyInCart}</span>
      )}
      {/* Colour avatar — consistent per product, looks intentional without an image */}
      {showImage ? (
        <img
          src={p.productImage}
          alt={p.productName}
          style={{
            width: '100%', height: 56, objectFit: 'cover',
            borderRadius: 7, marginBottom: 7,
          }}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div style={{
          width: '100%', height: 56, borderRadius: 7, marginBottom: 7,
          background: stringToColorPOS(p.productName),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 28, fontWeight: 800, color: '#fff',
            textTransform: 'uppercase', opacity: 0.9, userSelect: 'none',
          }}>
            {p.productName.trim().slice(0, 1)}
          </span>
        </div>
      )}
      <span style={{
        fontSize: 12.5, fontWeight: 600, color: '#0f172a', lineHeight: 1.3, marginBottom: 5,
        display: '-webkit-box', WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical', overflow: 'hidden',
        paddingRight: qtyInCart ? 18 : 0,
      }}>{p.productName}</span>
      <span style={{
        fontSize: 9, fontWeight: 700, marginBottom: 6, color: badge.color,
        background: badge.color + '15', borderRadius: 999, padding: '1px 6px', alignSelf: 'flex-start',
      }}>{badge.label}</span>
      <span style={{ fontSize: 17, fontWeight: 800, color: GOLD, marginBottom: 8 }}>
        {N(p.sellingPrice)}
      </span>
      <span style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        padding: '5px 0', borderRadius: 7, fontSize: 11.5, fontWeight: 700,
        background: oos ? '#f1f5f9' : qtyInCart ? GOLD : GOLD + '18',
        color: oos ? '#cbd5e1' : qtyInCart ? '#fff' : GOLD,
      }}>
        <Plus size={11} />
        {oos ? 'Out of stock' : qtyInCart ? 'Add more' : 'Add'}
      </span>
    </button>
  );
});

// ─── Change calculator ────────────────────────────────────────────────────────
const ChangeCal = memo(({ total, onChange }: { total: number; onChange: (v: number) => void }) => {
  const [paid, setPaid] = useState('');
  const paidN = parseFloat(paid) || 0;
  const change = paidN >= total ? paidN - total : 0;
  const short = paidN > 0 && paidN < total ? total - paidN : 0;
  const pick = (d: number) => { setPaid(String(d)); onChange(d); };
  return (
    <div style={{ marginTop: 12, padding: 14, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
        Cash tendered
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
        {DENOMS.map(d => (
          <button key={d} onClick={() => pick(d)} style={{
            padding: '4px 9px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            background: paidN === d ? GOLD + '22' : '#fff',
            border: `1px solid ${paidN === d ? GOLD : '#e2e8f0'}`,
            color: paidN === d ? '#92400e' : '#475569',
          }}>
            ₦{d.toLocaleString()}
          </button>
        ))}
      </div>
      <input
        type="number" placeholder="Or type amount…"
        value={paid} autoFocus
        onChange={e => { setPaid(e.target.value); onChange(parseFloat(e.target.value) || 0); }}
        style={{
          width: '100%', padding: '9px 12px',
          border: `1.5px solid ${paid ? GOLD : '#e2e8f0'}`,
          borderRadius: 9, fontSize: 16, fontWeight: 700, outline: 'none', color: '#0f172a',
        }}
      />
      {paid && (
        <div style={{ marginTop: 9, fontSize: 15, fontWeight: 800 }}>
          {short > 0
            ? <span style={{ color: '#ef4444' }}>Short: {N(short)}</span>
            : <span style={{ color: '#16a34a' }}>Change: {N(change)}</span>
          }
        </div>
      )}
    </div>
  );
});

// ─── Main ─────────────────────────────────────────────────────────────────────
export const NewSalePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, logout } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catId, setCatId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [cartDisc, setCartDisc] = useState(0);
  const [note, setNote] = useState('');

  const [payOpen, setPayOpen] = useState(false);
  const [doneSale, setDoneSale] = useState<DoneSale | null>(null);
  const [receiptHtml, setReceiptHtml] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [amtPaid, setAmtPaid] = useState(0);
  const [showHints, setShowHints] = useState(false);
  const isOnline = useOnlineStatus();

  const [processingShift, setProcessingShift] = useState(false);
  const [pendingSale, setPendingSale] = useState<any>(null);

  const [sessSales, setSessSales] = useState(0);
  const [sessRev, setSessRev] = useState(0);
  const [shiftStart, setShiftStart] = useState<Date>(() => new Date());
  const [now, setNow] = useState(Date.now());
  const [storeName, setStoreName] = useState<string>('My Store');

  const searchRef = useRef<HTMLInputElement>(null);
  const backspaceCt = useRef(0);
  const backspaceTimer = useRef<ReturnType<typeof setTimeout>>();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [pendingMethod, setPendingMethod] = useState<string | null>(null);

  const auth = !!(user && ['OWNER', 'MANAGER', 'CASHIER'].includes(user.role));

  const getSalesStorageKey = () => {
    const today = new Date().toISOString().slice(0, 10);
    return `rs-sales-today:${user?.tenantId ?? 'guest'}:${user?.id ?? 'anon'}:${today}`;
  };

  const loadDailySales = () => {
    if (!auth) return;
    try {
      const stored = localStorage.getItem(getSalesStorageKey());
      if (!stored) return false;
      const parsed = JSON.parse(stored);
      setSessSales(Number(parsed.sales) || 0);
      setSessRev(Number(parsed.rev) || 0);
      if (parsed.shiftStart) {
        setShiftStart(new Date(parsed.shiftStart));
      }
      return true;
    } catch {
      setSessSales(0);
      setSessRev(0);
      return false;
    }
  };

  const persistDailySales = (sales: number, rev: number, shiftStartValue: Date) => {
    if (!auth) return;
    try {
      localStorage.setItem(getSalesStorageKey(), JSON.stringify({
        sales,
        rev,
        shiftStart: shiftStartValue.toISOString(),
      }));
    } catch {
      // ignore storage failures
    }
  };

  useEffect(() => {
    const loaded = loadDailySales();
    if (!loaded && auth) {
      persistDailySales(0, 0, shiftStart);
    }
  }, [auth, user?.id, user?.tenantId]);

  // Load categories once
  // Load categories and store name once
  useEffect(() => {
    if (!token || !auth) return;

    apiClient.getCategories()
      .then((d: Category[]) => setCategories(Array.isArray(d) ? d : []))
      .catch(() => setCategories([]));

    apiClient.request('/settings')
      .then((data: any) => {
        const name = data?.storeName || data?.data?.storeName || data?.storeSettings?.storeName;
        if (name) setStoreName(name);
      })
      .catch(() => {
        console.warn('[POS] Could not load store settings, using fallback store name');
      });
  }, [token, auth]);
  // useEffect(() => {
  //   if (!token || !auth) return;
  //   apiClient.getCategories()
  //     .then((d: Category[]) => setCategories(Array.isArray(d) ? d : []))
  //     .catch(() => setCategories([]));
  // }, [token, auth]);

  // Product search with debounce
  const fetchProducts = useCallback(async (query = '') => {
    if (!token || !auth) return;
    setLoading(true); setError(null);

    // ── ONLINE PATH ──────────────────────────────────────────────────────────
    if (getIsEffectivelyOnline()) {
      try {
        setProducts(await apiClient.searchProducts(query));
        setLoading(false);
        return; // success — exit early
      } catch (e: any) {
        // API failed while online (server error, timeout etc.)
        // Fall through to IndexedDB rather than leaving the cashier with no products
        console.warn('[POS] API product search failed, falling back to offline mode:', e.message);
      }
    }

    // ── OFFLINE PATH (or online-but-API-failed fallback) ─────────────────────
    // Read all products from IndexedDB and filter client-side.
    // IndexedDB is populated by the pull-sync phase when the device is online.
    try {
      const db = await openDatabase();
      const allRecords = await getAllFromStore(db, 'products');

      // Each record is an OfflineEntity: { id, data: { productName, ... }, meta }
      // Handle both shapes: synced entities (data wrapper) and raw product objects
      const localProducts: Product[] = allRecords
        .map((record: any) => record.data ?? record)
        .filter((p: any) => p && p.productName);

      // Client-side filtering to match what the API query would return
      const trimmed = query.trim().toLowerCase();
      const filtered = trimmed
        ? localProducts.filter((p) =>
          p.productName.toLowerCase().includes(trimmed) ||
          p.sku?.toLowerCase().includes(trimmed) ||
          p.barcode?.toLowerCase().includes(trimmed)
        )
        : localProducts;

      setProducts(filtered);
      setError(null);
    } catch (dbErr: any) {
      setError('Could not load products. Check your connection.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [token, auth]);
  // const fetchProducts = useCallback(async (query = '') => {
  //   if (!token || !auth) return;
  //   setLoading(true); setError(null);
  //   try { setProducts(await apiClient.searchProducts(query)); }
  //   catch (e: any) { setError(e.message || 'Search failed'); setProducts([]); }
  //   finally { setLoading(false); }
  // }, [token, auth]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { if (auth) fetchProducts(q); }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [q, auth, fetchProducts]);

  // Auto-focus on mount
  useEffect(() => { setTimeout(() => searchRef.current?.focus(), 80); }, []);

  // When device transitions from online → offline, immediately re-fetch
  // products from IndexedDB so the cashier isn't left with an empty screen.
  // Without this, fetchProducts only runs on query/auth change — the offline
  // fallback path never triggers on connectivity loss.
  useEffect(() => {
    if (!isOnline && auth) {
      fetchProducts(q);
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived
  const cartArr = useMemo(() => Array.from(cart.values()), [cart]);
  const displayedProducts = useMemo(() =>
    catId ? products.filter(p => p.categoryId === catId) : products,
    [products, catId]);
  const subtotal = useMemo(() => cartArr.reduce((s, i) => s + i.sellingPrice * i.qty * (1 - i.disc / 100), 0), [cartArr]);
  const afterDisc = subtotal * (1 - cartDisc / 100);
  const vatAmt = afterDisc * VAT;
  const totalAmt = afterDisc + vatAmt;
  const cartQty = useMemo(() => cartArr.reduce((s, i) => s + i.qty, 0), [cartArr]);

  // Cart mutators
  const addToCart = useCallback((p: Product) => {
    if (p.stock === 0) return;
    setCart(prev => {
      const next = new Map(prev);
      const ex = next.get(p.id);
      if (ex) { if (ex.qty >= p.stock) return prev; next.set(p.id, { ...ex, qty: ex.qty + 1 }); }
      else next.set(p.id, { ...p, qty: 1, disc: 0 });
      return next;
    });
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    setCart(prev => {
      const next = new Map(prev);
      if (qty <= 0) { next.delete(id); return next; }
      const item = next.get(id);
      if (!item || qty > item.stock) return prev;
      next.set(id, { ...item, qty }); return next;
    });
  }, []);

  const setItemDisc = useCallback((id: string, disc: number) => {
    setCart(prev => {
      const next = new Map(prev);
      const item = next.get(id);
      if (!item) return prev;
      next.set(id, { ...item, disc: Math.min(100, Math.max(0, disc)) }); return next;
    });
  }, []);

  const clearCart = useCallback(() => setCart(new Map()), []);


  const handlePayRef = useRef<(method: string) => void>(() => { });
  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';

      if (e.key === 'F2' || (e.key === '/' && !typing)) {
        e.preventDefault(); setPayOpen(false); searchRef.current?.focus(); return;
      }
      if (e.key === 'Escape') {
        if (payOpen) { setPayOpen(false); return; }
        if (doneSale) { handleCloseSuccess(); return; }
        if (q) { setQ(''); searchRef.current?.focus(); return; }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault(); if (cart.size > 0 && !payOpen) setPayOpen(true); return;
      }
      if (e.key === 'Enter' && document.activeElement === searchRef.current) {
        const first = displayedProducts[0];
        if (first && first.stock > 0) addToCart(first); return;
      }
      if (payOpen && !typing) {
        const m = PAY.find(p => p.key === e.key);
        // if (m) { e.preventDefault(); handlePay(m.id); return; }
        // if (e.key.toLowerCase() === 'c') { e.preventDefault(); handlePay('CASH'); return; }
        if (m) { e.preventDefault(); handlePayRef.current(m.id); return; }
        if (e.key.toLowerCase() === 'c') { e.preventDefault(); handlePayRef.current('CASH'); return; }
      }
      if (e.key === 'Backspace' && !typing) {
        backspaceCt.current += 1;
        clearTimeout(backspaceTimer.current);
        if (backspaceCt.current >= 2) { clearCart(); backspaceCt.current = 0; }
        else backspaceTimer.current = setTimeout(() => { backspaceCt.current = 0; }, 600);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // Deps: only values that change what the handler DOES.
    // handlePay is accessed via ref — always fresh, no stale closure.
  }, [payOpen, doneSale, q, cart.size, displayedProducts, addToCart, clearCart]);

  // ─── Offline sale save (atomic) ───────────────────────────────────────────
  // Called by handlePay when navigator.onLine === false.
  //
  // Atomicity guarantee:
  //   One IDBTransaction spans BOTH 'sales' and 'products' stores.
  //   All reads (stock check) + all writes (sale record, stock decrement)
  //   happen inside that single transaction.
  //   globalSyncQueue.enqueue() is called ONLY inside transaction.oncomplete —
  //   so if the transaction aborts for any reason, the queue is never touched.
  //   Either everything commits together, or nothing does.
  const saveOfflineSale = useCallback((
    method: string,
    items: CartItem[],
    totals: { sub: number; vat: number; total: number; paid: number; change: number },
  ): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      let db: IDBDatabase;
      try {
        db = await openDatabase();
      } catch (err) {
        reject(new Error('Could not open local database. Sale not saved.'));
        return;
      }

      const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const now = new Date().toISOString();

      const salePayload = {
        paymentMethod: method,
        totalAmount: totals.total,
        subtotal: totals.sub,
        taxAmount: totals.vat,
        taxRate: VAT,
        items: items.map(i => ({
          productId: i.id,
          quantity: i.qty,
          price: i.sellingPrice * (1 - i.disc / 100),
        })),
        userId: user!.id,
        tenantId: user!.tenantId,
        createdAt: now,
        customerName: note.trim() || null,
        saleNote: null,
      };

      const saleEntity = {
        id: localId,
        tenantId: user!.tenantId,
        data: salePayload,
        meta: {
          version: 0,
          syncStatus: 'DIRTY' as const,
          lastModifiedAt: now,
          localOnly: true, // pull phase must not overwrite this before server ack
        },
      };

      // Single transaction covering both stores — this is the atomicity boundary
      const tx = db!.transaction(['sales', 'products'], 'readwrite');
      const salesStore = tx.objectStore('sales');
      const productsStore = tx.objectStore('products');

      // If IDB rolls back for any reason, reject so handlePay shows the error toast
      tx.onerror = () => reject(
        new Error(`Offline sale failed: ${tx.error?.message ?? 'database error'}`)
      );
      tx.onabort = () => reject(
        new Error('Offline sale aborted — no changes were saved.')
      );

      // Queue ONLY after a clean commit — IDB guarantees all puts above are
      // durable before oncomplete fires. globalSyncQueue lives in a separate
      // IDB database so it cannot join this transaction, but placing the enqueue
      // here means it only runs when the transaction has already succeeded.
      tx.oncomplete = () => {
        // enqueue is now async — must be handled inside oncomplete.
        // If the queue persist fails, reject so handlePay shows the error
        // toast rather than printing a receipt for a sale that isn't queued.
        globalSyncQueue.enqueue(localId, 'sale', 'CREATE', salePayload, 0, 1)
          .then(() => resolve(localId))
          .catch((err) => reject(err));
      };

      // Step 1: write the sale record
      salesStore.put(saleEntity);

      // Step 2: for each cart item, read current stock, validate, decrement
      // All gets are issued immediately; IDB processes them in order within
      // the transaction. If any product is missing or understocked, abort()
      // rolls back the sale write above too — nothing is persisted.
      for (const item of items) {
        const getReq = productsStore.get(item.id);

        getReq.onsuccess = () => {
          const product = getReq.result;

          if (!product) {
            tx.abort();
            return;
          }

          // Stock lives at product.data.stock (OfflineEntity shape from pull sync)
          // or product.stock (raw shape). Handle both defensively.
          const currentStock: number = product.data?.stock ?? product.stock ?? 0;

          if (currentStock < item.qty) {
            tx.abort();
            return;
          }

          const newStock = currentStock - item.qty;
          if (product.data !== undefined) {
            product.data.stock = newStock;
          } else {
            product.stock = newStock;
          }
          // Keep meta clean — stock change is local-only; server is source of truth on sync
          product.meta = {
            ...product.meta,
            lastModifiedAt: now,
          };

          productsStore.put(product);
        };

        getReq.onerror = () => {
          tx.abort();
        };
      }
    });
  }, [user]);

  // Process payment — branches on connectivity
  const handlePay = async (method: string) => {
    if (!token || !user || processing || cart.size === 0) return;
    // Credit sales require a customer name — cannot record a debt with no name
    if (method === 'CREDIT' && !note.trim()) {
      setError('Please enter the customer\'s name before charging to account.');
      return;
    }
    setProcessing(true); setError(null);

    const totals = {
      sub: subtotal,
      vat: vatAmt,
      total: totalAmt,
      paid: method === 'CASH' ? (amtPaid || totalAmt) : totalAmt,
      change: method === 'CASH' ? Math.max(0, (amtPaid || totalAmt) - totalAmt) : 0,
    };

    try {
      if (!getIsEffectivelyOnline()) {
        // ── OFFLINE PATH ────────────────────────────────────────────────────
        const localId = await saveOfflineSale(method, cartArr, totals);
        const done: DoneSale = {
          id: localId,
          items: cartArr,
          ...totals,
          method,
          cashier: user.name || user.email,
          store: storeName || 'My Store Name',
          ts: new Date(),
          pendingSync: true,
          customerName: note.trim() || null,
        };
        setDoneSale(done);
        // Immediately mirror the IDB stock decrement into React state so the
        // product grid updates without a page navigation or refresh.
        setProducts(prev =>
          prev.map(p => {
            const soldItem = cartArr.find(ci => ci.id === p.id);
            if (!soldItem) return p;
            return { ...p, stock: Math.max(0, p.stock - soldItem.qty) };
          })
        );
        const offlineSales = sessSales + 1;
        const offlineRev = sessRev + totalAmt;
        setSessSales(offlineSales);
        setSessRev(offlineRev);
        persistDailySales(offlineSales, offlineRev, shiftStart);
        clearCart(); setNote(''); setCartDisc(0); setAmtPaid(0);
        setProcessing(false); // Reset processing state after success
        setPayOpen(false); // Close payment modal
      } else {
        // ── ONLINE PATH (unchanged) ─────────────────────────────────────────
        const sale = await apiClient.createSale({
          paymentMethod: method,
          items: cartArr.map(i => ({ productId: i.id, quantity: i.qty, price: i.sellingPrice })),
          customerName: note.trim() || null,
          saleNote: null,
        });
        const done: DoneSale = {
          id: sale.id, items: cartArr,
          ...totals,
          method,
          cashier: user.name || user.email,
          store: storeName,
          ts: new Date(),
          pendingSync: false,
          customerName: note.trim() || null,
        };
        // setDoneSale(done);
        // console.log('[POS] Sale successful:', done);
        // const onlineSales = sessSales + 1;
        // const onlineRev = sessRev + totalAmt;
        // setSessSales(onlineSales);
        // setSessRev(onlineRev);
        // persistDailySales(onlineSales, onlineRev, shiftStart);
        // // Refetch products to update stock display in real-time
        // await fetchProducts(q);
        // clearCart(); setNote(''); setCartDisc(0); setAmtPaid(0);
        // setProcessing(false); // Reset processing state after success
        // setPayOpen(false); // Close payment modal
        setDoneSale(done);
        console.log('[POS] Sale successful:', done);
        const onlineSales = sessSales + 1;
        const onlineRev = sessRev + totalAmt;
        setSessSales(onlineSales);
        setSessRev(onlineRev);
        persistDailySales(onlineSales, onlineRev, shiftStart);
        // Refetch products to update stock display in real-time
        await fetchProducts(q);
        clearCart(); setNote(''); setCartDisc(0); setAmtPaid(0);
        setProcessing(false); // Reset processing state after success
        setPayOpen(false); // Close payment modal
      }
    } catch (e: any) {
      // Check for specific shift-required error (HTTP 402)
      if (e.code === 'SHIFT_REQUIRED' || e.status === 402) {
        // Store the pending sale and show clock-in modal
        setPendingSale({
          method,
          items: cartArr,
          totals
        });
        setProcessing(false); // Stop processing immediately
        setPayOpen(false); // Close payment modal to show clock-in modal instead
        setError(null); // Clear error to show modal instead
        return; // Exit - don't process error message
      }

      setError(e.message || 'Payment failed. Please retry.');
      setProcessing(false);
      setPayOpen(false);
    }
  };

  handlePayRef.current = handlePay;

  // Handle clock-in and retry sale
  const handleClockInAndRetry = async () => {
    if (!token || !user || processingShift || !pendingSale) return;

    setProcessingShift(true);
    setError(null);

    try {
      // Clock in with default starting float of 0
      await apiClient.clockInShift({ startFloat: 0 });

      // Clock-in successful, now retry the sale
      if (pendingSale.method) {
        await handlePayRef.current(pendingSale.method);
      }

      // Clear pending sale after successful retry
      setPendingSale(null);
    } catch (err: any) {
      setError(err.message || 'Failed to clock in. Please try again.');
    } finally {
      setProcessingShift(false);
    }
  };

  const handleCloseSuccess = () => {
    setDoneSale(null);
    if (location.search.includes('success=true')) navigate('/pos', { replace: true });
    setTimeout(() => searchRef.current?.focus(), 80);
  };

  const printReceipt = () => {
    const frame = document.getElementById('receipt-frame') as HTMLIFrameElement | null;
    if (!frame?.contentWindow) return;
    frame.contentWindow.focus();
    frame.contentWindow.print();
  };

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const shiftMin = Math.floor((now - shiftStart.getTime()) / 60_000);
  const shiftLbl = shiftMin < 60 ? `${shiftMin}m` : `${Math.floor(shiftMin / 60)}h ${shiftMin % 60}m`;
  const F: React.CSSProperties = { display: 'flex' };

  if (!auth) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <AlertTriangle size={48} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
      <h2 style={{ fontSize: 22, fontWeight: 800 }}>Permission Denied</h2>
      <p style={{ color: '#64748b', marginTop: 6 }}>Cashier, Manager or Owner access required.</p>
      <button onClick={() => navigate('/dashboard')} style={{ marginTop: 20, padding: '10px 24px', background: GOLD, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
        Go to Dashboard
      </button>
    </div>
  );

  if (!products.length && !isOnline) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>No products available offline</h2>
      <p style={{ color: '#64748b', marginBottom: 6 }}>Please connect to the internet to sync products.</p>
      <button onClick={() => navigate('/dashboard')} style={{ marginTop: 20, padding: '10px 24px', background: GOLD, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
        Go to Dashboard
      </button>
    </div>
  );

  return (
    <div style={{
      width: '100dvw', height: '100dvh',
      display: 'flex', flexDirection: 'column',
      background: '#f1f5f9',
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    }}>

      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <div style={{
        height: 44, flexShrink: 0, background: '#0f172a', color: '#f1f5f9',
        ...F, alignItems: 'center', padding: '0 16px', gap: 18, userSelect: 'none',
      }}>
        {/* Cashier */}
        <div style={{ ...F, alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: GOLD, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
            {(user?.name || user?.email || 'C').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.2 }}>
              {user?.name || user?.email?.split('@')[0]}
            </div>
            <div style={{ fontSize: 9.5, color: '#64748b', ...F, alignItems: 'center', gap: 3 }}>
              <Clock size={9} /> {shiftLbl} shift
            </div>
          </div>
        </div>

        <div style={{ width: 1, height: 24, background: '#1e293b' }} />

        {/* Session stats */}
        <div style={{ ...F, gap: 18 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', lineHeight: 1 }}>{sessSales}</div>
            <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.07em' }}>Sales today</div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: GOLD, lineHeight: 1 }}>{Nk(sessRev)}</div>
            <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.07em' }}>Revenue</div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Online badge */}
        <div style={{ ...F, alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600, color: isOnline ? '#4ade80' : '#f87171' }}>
          {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
          {isOnline ? 'Online' : 'Offline — queued'}
        </div>

        {/* Shortcuts toggle */}
        <button onClick={() => setShowHints(h => !h)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: showHints ? GOLD : '#64748b', ...F, alignItems: 'center', gap: 4, fontSize: 10.5 }} title="Keyboard shortcuts">
          <Keyboard size={13} />
        </button>

        {/* Exit */}
        <button
          type="button"
          onClick={async (e) => {
            // Prevent forms or parent handlers from interpreting this click as a submit
            e.preventDefault();
            e.stopPropagation();

            // Defensive check: ensure role comparison is string-based
            const role = (user?.role || '').toString();
            if (role === 'CASHIER') {
              await logout();
              return;
            }

            // Owners / managers go back to dashboard
            navigate('/dashboard', { replace: true });
          }}
          style={{ background: '#1e293b', border: 'none', color: '#94a3b8', fontSize: 10.5, fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}
        >
          ✕ Exit
        </button>
      </div>

      {/* Hints strip */}
      {showHints && (
        <div style={{ background: '#1e293b', color: '#94a3b8', ...F, gap: 16, padding: '6px 16px', fontSize: 10.5, flexWrap: 'wrap', flexShrink: 0, alignItems: 'center' }}>
          {[['F2 / /', 'Search'], ['Enter', 'Add first'], ['Ctrl+↵', 'Pay'], ['Esc', 'Clear/Close'], ['1–4', 'Pay method'], ['C', 'Cash confirm'], ['⌫⌫', 'Clear cart']].map(([k, d]) => (
            <span key={k} style={{ ...F, alignItems: 'center', gap: 5 }}>
              <Kbd>{k}</Kbd><span>{d}</span>
            </span>
          ))}
        </div>
      )}

      {/* Offline capability banner */}
      {!isOnline && (
        <div style={{
          background: '#fef3c7', borderBottom: '1.5px solid #fcd34d', color: '#92400e',
          ...F, alignItems: 'center', gap: 10, padding: '8px 16px', flexShrink: 0, fontSize: 12, fontWeight: 600,
        }}>
          <WifiOff size={14} />
          <span>📳 <strong>Offline Mode:</strong> You can create sales and they will be uploaded when connection returns</span>
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, ...F, overflow: 'hidden', minHeight: 0 }}>

        {/* LEFT: Products */}
        <div style={{ flex: 1, ...F, flexDirection: 'column', background: '#f8fafc', borderRight: '1px solid #e2e8f0', overflow: 'hidden', minWidth: 0 }}>

          {/* Search */}
          <div style={{ padding: '10px 14px 8px', background: '#fff', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
              <input
                ref={searchRef}
                type="text" value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search name, SKU or scan barcode…  (F2)"
                style={{
                  width: '100%', padding: '9px 38px 9px 35px',
                  border: `1.5px solid ${q ? GOLD + '99' : '#e2e8f0'}`,
                  borderRadius: 10, fontSize: 13.5, background: '#fff',
                  outline: 'none', color: '#0f172a', transition: 'border-color .15s',
                }}
                onFocus={e => (e.target.style.borderColor = GOLD)}
                onBlur={e => (e.target.style.borderColor = q ? GOLD + '99' : '#e2e8f0')}
              />
              <ScanLine size={14} style={{ position: 'absolute', right: q ? 32 : 11, top: '50%', transform: 'translateY(-50%)', color: '#cbd5e1', pointerEvents: 'none' }} />
              {q && (
                <button onClick={() => { setQ(''); searchRef.current?.focus(); }} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', ...F, padding: 2 }}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Category pills — REAL API data */}
          <div style={{ ...F, gap: 6, padding: '7px 14px', background: '#fff', borderBottom: '1px solid #f1f5f9', overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' }}>
            {[{ id: null, categoryName: 'All' }, ...categories].map(cat => (
              <button
                key={cat.id ?? 'all'}
                onClick={() => setCatId(prev => prev === cat.id ? null : cat.id)}
                style={{
                  padding: '4px 13px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                  border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  background: catId === cat.id || (cat.id === null && catId === null) ? GOLD : '#f1f5f9',
                  color: catId === cat.id || (cat.id === null && catId === null) ? '#fff' : '#64748b',
                  transition: 'background .12s',
                }}
              >
                {cat.categoryName}
              </button>
            ))}
            <button onClick={() => fetchProducts(q)} title="Refresh" style={{ padding: '4px 9px', borderRadius: 999, border: '1px solid #e2e8f0', background: 'none', cursor: 'pointer', color: '#94a3b8', flexShrink: 0, ...F, alignItems: 'center' }}>
              <RefreshCw size={11} />
            </button>
          </div>

          {/* Result count */}
          <div style={{ padding: '4px 14px 2px', fontSize: 10.5, color: '#94a3b8', ...F, justifyContent: 'space-between', flexShrink: 0 }}>
            <span>{loading ? 'Searching…' : `${displayedProducts.length} product${displayedProducts.length !== 1 ? 's' : ''}`}</span>
            <span style={{ fontSize: 10, color: '#cbd5e1' }}>
              <Kbd>Enter</Kbd> adds first result
            </span>
          </div>

          {/* Grid */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '8px 14px 14px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))',
            gap: 10, alignContent: 'start',
          }}>
            {loading
              ? Array.from({ length: 10 }).map((_, i) => (
                <div key={i} style={{ height: 134, borderRadius: 12, background: 'linear-gradient(90deg,#f1f5f9 25%,#e8ecf0 50%,#f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.3s infinite' }} />
              ))
              : displayedProducts.length === 0
                ? (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
                    <Package size={36} style={{ margin: '0 auto 10px', opacity: .4 }} />
                    <div style={{ fontSize: 14, fontWeight: 600 }}>No products found</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Try a different search or category</div>
                  </div>
                )
                : displayedProducts.map(p => (
                  <ProductCard key={p.id} p={p} qtyInCart={cart.get(p.id)?.qty ?? 0} onAdd={addToCart} />
                ))
            }
          </div>
          <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        </div>

        {/* RIGHT: Cart */}
        <div style={{ width: 320, flexShrink: 0, ...F, flexDirection: 'column', background: '#fff', boxShadow: '-4px 0 16px rgba(0,0,0,.04)' }}>

          {/* Header */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', ...F, alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ ...F, alignItems: 'center', gap: 8 }}>
              <ShoppingCart size={16} style={{ color: GOLD }} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>Order</span>
              {cart.size > 0 && (
                <span style={{ background: GOLD, color: '#fff', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 999 }}>
                  {cartQty}
                </span>
              )}
            </div>
            {cart.size > 0 && (
              <button onClick={clearCart} title="Clear cart (⌫⌫)" style={{ background: '#fef2f2', border: 'none', color: '#ef4444', fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 6, cursor: 'pointer' }}>
                Clear ⌫⌫
              </button>
            )}
          </div>

          {/* Items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px' }}>
            {cart.size === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#cbd5e1' }}>
                <ShoppingCart size={34} style={{ margin: '0 auto 10px', opacity: .4 }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>Cart is empty</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Tap a product or press Enter</div>
              </div>
            ) : cartArr.map(item => {
              const lt = item.sellingPrice * item.qty * (1 - item.disc / 100);
              return (
                <div key={item.id} style={{ marginBottom: 7, padding: '8px 10px', borderRadius: 10, border: '1px solid #f1f5f9', background: '#fafafa' }}>
                  <div style={{ ...F, justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a', lineHeight: 1.3, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.productName}
                    </span>
                    <button onClick={() => setQty(item.id, 0)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', padding: 1, flexShrink: 0 }}>
                      <X size={13} />
                    </button>
                  </div>
                  <div style={{ ...F, alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* Stepper */}
                    <div style={{ ...F, alignItems: 'center', background: '#f1f5f9', borderRadius: 8, overflow: 'hidden' }}>
                      <button onClick={() => setQty(item.id, item.qty - 1)} style={{ width: 28, height: 28, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', ...F, alignItems: 'center', justifyContent: 'center' }}>
                        <Minus size={12} />
                      </button>
                      <span style={{ width: 28, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{item.qty}</span>
                      <button onClick={() => setQty(item.id, item.qty + 1)} style={{ width: 28, height: 28, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', ...F, alignItems: 'center', justifyContent: 'center' }}>
                        <Plus size={12} />
                      </button>
                    </div>
                    {/* Discount */}
                    <div style={{ ...F, alignItems: 'center', gap: 3 }}>
                      <Tag size={10} style={{ color: '#cbd5e1' }} />
                      <input type="number" min={0} max={100} value={item.disc || ''} placeholder="0"
                        onChange={e => setItemDisc(item.id, parseFloat(e.target.value) || 0)}
                        style={{ width: 38, padding: '3px 5px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11, textAlign: 'center', outline: 'none', color: '#64748b' }}
                        title="Item discount %" />
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>%</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{N(lt)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #f1f5f9', padding: '10px 12px 12px', flexShrink: 0 }}>
            <input
              type="text"
              value={note}
              onChange={e => { setNote(e.target.value); if (pendingMethod) setPendingMethod(null); }}
              placeholder={pendingMethod === 'CREDIT' ? '⚠ Enter customer name to charge to account…' : 'Note / customer name…'}
              autoFocus={pendingMethod === 'CREDIT'}
              style={{
                width: '100%', padding: '6px 10px', marginBottom: 8,
                border: pendingMethod === 'CREDIT' ? '2px solid #dc2626' : '1px solid #e2e8f0',
                borderRadius: 8, fontSize: 12, color: '#475569', outline: 'none',
                background: pendingMethod === 'CREDIT' ? '#fff5f5' : '#f8fafc',
                transition: 'border .15s, background .15s',
              }}
            />


            {/* Cart discount */}
            <div style={{ ...F, alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11.5, color: '#64748b', ...F, alignItems: 'center', gap: 5 }}>
                <Tag size={11} /> Cart discount
              </span>
              <div style={{ ...F, alignItems: 'center', gap: 4 }}>
                <input type="number" min={0} max={100} value={cartDisc || ''} placeholder="0"
                  onChange={e => setCartDisc(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                  style={{ width: 44, padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, textAlign: 'center', outline: 'none' }} />
                <span style={{ fontSize: 11, color: '#94a3b8' }}>%</span>
              </div>
            </div>

            {/* Summary lines */}
            {[
              { label: 'Subtotal', value: N(subtotal) },
              ...(cartDisc > 0 ? [{ label: `Discount (${cartDisc}%)`, value: `-${N(subtotal * cartDisc / 100)}` }] : []),
              { label: 'VAT 7.5%', value: N(vatAmt) },
            ].map(r => (
              <div key={r.label} style={{ ...F, justifyContent: 'space-between', fontSize: 11.5, color: '#64748b', marginBottom: 3 }}>
                <span>{r.label}</span><span style={{ fontWeight: 500 }}>{r.value}</span>
              </div>
            ))}

            {/* Total */}
            <div style={{ ...F, justifyContent: 'space-between', alignItems: 'center', fontSize: 20, fontWeight: 900, color: '#0f172a', borderTop: '2px solid #f1f5f9', paddingTop: 10, marginTop: 6 }}>
              <span>Total</span>
              <span style={{ color: GOLD, letterSpacing: '-0.02em' }}>{N(totalAmt)}</span>
            </div>

            {/* Charge button */}
            <button
              disabled={cart.size === 0}
              onClick={() => setPayOpen(true)}
              style={{
                width: '100%', marginTop: 10, padding: '14px 0', borderRadius: 12, border: 'none',
                background: cart.size > 0 ? GOLD : '#e2e8f0',
                color: cart.size > 0 ? '#fff' : '#94a3b8',
                fontSize: 16, fontWeight: 900, letterSpacing: '.02em',
                cursor: cart.size > 0 ? 'pointer' : 'not-allowed',
                ...F, alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: cart.size > 0 ? `0 4px 18px ${GOLD}44` : 'none',
                transition: 'background .15s',
              }}
            >
              <Zap size={18} />
              {cart.size > 0 ? `Charge ${N(totalAmt)}` : 'Add items to charge'}
            </button>
            <div style={{ marginTop: 6, textAlign: 'center', fontSize: 10, color: '#cbd5e1' }}>
              <Kbd>Ctrl</Kbd> + <Kbd>↵</Kbd> to open payment
            </div>
          </div>
        </div>
      </div>

      {/* ── Payment modal ────────────────────────────────────────────────── */}
      {payOpen && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', ...F, alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}
          onClick={() => setPayOpen(false)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '24px 24px 20px', width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,.25)', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ ...F, justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>Select Payment</h2>
              <button onClick={() => setPayOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, color: GOLD, letterSpacing: '-0.03em', marginBottom: 18 }}>{N(totalAmt)}</div>

            {/* Methods */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {PAY.map(m => (
                <button key={m.id} onClick={() => {
                  if (m.id === 'CREDIT' && !note.trim()) {
                    setPendingMethod('CREDIT');
                    setPayOpen(false); // Close payment modal, return to cart
                    setError('Enter the customer name in the note field, then tap "Owe Me" again.');
                    return;
                  }
                  handlePay(m.id);
                }}
                  style={{ padding: '14px 10px', borderRadius: 14, border: `1.5px solid ${m.col}33`, background: m.col + '0E', color: m.col, cursor: 'pointer', textAlign: 'center', transition: 'background .12s', position: 'relative' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = m.col + '22'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = m.col + '0E'; }}>
                  <span style={{ position: 'absolute', top: 6, right: 6, background: m.col + '22', color: m.col, fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4 }}>{m.key}</span>
                  <m.Icon size={24} style={{ margin: '0 auto 6px', display: 'block' }} />
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{m.label}</div>
                  <div style={{ fontSize: 10, marginTop: 3, opacity: .7 }}>{m.sub}</div>
                </button>
              ))}
            </div>

            <ChangeCal total={totalAmt} onChange={setAmtPaid} />

            <button onClick={() => handlePay('CASH')} disabled={processing}
              style={{ width: '100%', marginTop: 14, padding: '13px 0', borderRadius: 12, border: 'none', background: '#16a34a', color: '#fff', fontSize: 15, fontWeight: 800, cursor: processing ? 'not-allowed' : 'pointer', ...F, alignItems: 'center', justifyContent: 'center', gap: 8, opacity: processing ? .7 : 1 }}>
              {processing
                ? <><Loader2 size={16} className="animate-spin" /> Processing…</>
                : <><Banknote size={16} /> Confirm Cash <Kbd>C</Kbd></>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── Success modal ────────────────────────────────────────────────── */}
      {doneSale && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', ...F, alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 60 }}
          onClick={handleCloseSuccess}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '28px 24px 22px', width: '100%', maxWidth: 380, boxShadow: '0 24px 64px rgba(0,0,0,.3)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#dcfce7', margin: '0 auto 12px', ...F, alignItems: 'center', justifyContent: 'center', animation: 'popIn .3s ease' }}>
                <CheckCircle2 size={38} style={{ color: '#16a34a' }} />
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>Sale Complete!</h2>
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                #{doneSale.id.slice(0, 8).toUpperCase()} · {doneSale.ts.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
              </p>
              {doneSale.customerName && (
                <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                  Customer: {doneSale.customerName}
                </p>
              )}
            </div>

            {/* Pending sync banner — shown when sale was saved offline */}
            {doneSale.pendingSync && (
              <div style={{ background: '#fffbeb', border: '1.5px dashed #d97706', borderRadius: 10, padding: '9px 12px', marginBottom: 14, ...F, alignItems: 'center', gap: 8 }}>
                <WifiOff size={14} style={{ color: '#d97706', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>Saved offline — will sync when reconnected</div>
                  <div style={{ fontSize: 11, color: '#b45309', marginTop: 1 }}>Sale is recorded. Stock updated locally.</div>
                </div>
              </div>
            )}

            <div style={{ background: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 18 }}>
              {([
                { l: 'Subtotal', v: N(doneSale.sub) },
                ...(doneSale.vat > 0 ? [{ l: 'VAT', v: N(doneSale.vat) }] : []),
                { l: 'Total', v: N(doneSale.total), bold: true, c: GOLD },
                { l: 'Paid via', v: doneSale.method },
                ...(doneSale.change > 0 ? [{ l: 'Change', v: N(doneSale.change), c: '#16a34a', bold: false }] : []),
              ] as { l: string; v: string; bold?: boolean; c?: string }[]).map(r => (
                <div key={r.l} style={{ ...F, justifyContent: 'space-between', fontSize: r.bold ? 15 : 12.5, fontWeight: r.bold ? 800 : 400, marginBottom: 5 }}>
                  <span style={{ color: r.bold ? r.c : '#64748b' }}>{r.l}</span>
                  <span style={{ color: r.c || '#0f172a' }}>{r.v}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => doneSale && setReceiptHtml(getReceiptHtml(doneSale))}
                style={{ padding: '12px 0', borderRadius: 12, border: 'none', background: GOLD, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', ...F, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Printer size={15} /> View Receipt
              </button>
              <button onClick={handleCloseSuccess}
                style={{ padding: '12px 0', borderRadius: 12, border: 'none', background: '#0f172a', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', ...F, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Zap size={15} /> New Sale
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: 10, fontSize: 10.5, color: '#94a3b8' }}>
              Press <Kbd>Esc</Kbd> to dismiss
            </div>
          </div>
          <style>{`@keyframes popIn{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
        </div>
      )}

      {/* Receipt modal */}
      {receiptHtml && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', ...F, alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 80 }} onClick={() => setReceiptHtml(null)}>
          <div style={{ width: '100%', maxWidth: 460, maxHeight: '90vh', background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.25)' }} onClick={e => e.stopPropagation()} className="receipt-print-modal">
            <div style={{ ...F, alignItems: 'center', justifyContent: 'space-between', padding: '18px 18px 8px' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Official Sales Receipt</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Rendered in modal for browser-friendly printing</div>
              </div>
              <button onClick={() => setReceiptHtml(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 18 }}><X size={20} /></button>
            </div>
            <div style={{ height: 'calc(90vh - 140px)', overflowY: 'auto', background: '#f8fafc', padding: 14 }}>
              <iframe
                id="receipt-frame"
                title="Receipt Preview"
                srcDoc={receiptHtml}
                style={{ width: '100%', minHeight: '100%', border: '1px solid #e2e8f0', borderRadius: 14 }}
              />
            </div>
            <div style={{ ...F, alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 18px 18px' }}>
              <button onClick={printReceipt} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: GOLD, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                <Printer size={14} /> Print Receipt
              </button>
              <button onClick={() => setReceiptHtml(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Processing overlay */}
      {processing && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.3)', ...F, alignItems: 'center', justifyContent: 'center', zIndex: 55 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '22px 32px', ...F, alignItems: 'center', gap: 12, boxShadow: '0 8px 32px rgba(0,0,0,.15)' }}>
            <Loader2 size={22} style={{ color: GOLD }} className="animate-spin" />
            <span style={{ fontSize: 15, fontWeight: 600 }}>Processing payment…</span>
          </div>
        </div>
      )}

      {/* Clock In Required Modal */}
      {pendingSale && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', ...F, alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 60 }} onClick={() => setPendingSale(null)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⏱️</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Start Your Shift</h2>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
                You need to clock in before making sales. This takes just a few seconds.
              </p>
            </div>

            <div style={{ background: '#fef9c3', border: `1px solid ${GOLD}44`, borderRadius: 12, padding: 14, marginBottom: 24, fontSize: 12, color: '#92400e' }}>
              <strong>Quick Setup:</strong> Your shift will start immediately with a starting float of ₦0. You can adjust this later if needed.
            </div>

            {error && (
              <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 12, padding: 12, marginBottom: 16, fontSize: 13, color: '#dc2626' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleClockInAndRetry}
              disabled={processingShift}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: 12,
                border: 'none',
                background: processingShift ? '#cbd5e1' : GOLD,
                color: '#fff',
                fontSize: 16,
                fontWeight: 700,
                cursor: processingShift ? 'not-allowed' : 'pointer',
                ...F,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: processingShift ? 'none' : `0 4px 18px ${GOLD}44`,
                transition: 'all 0.2s ease',
              }}
            >
              {processingShift ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Clocking in…
                </>
              ) : (
                <>
                  <Clock size={18} />
                  Clock In Now
                </>
              )}
            </button>

            <button
              onClick={() => setPendingSale(null)}
              style={{
                width: '100%',
                marginTop: 10,
                padding: '12px 0',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: '#0f172a',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 70, background: '#dc2626', color: '#fff', padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, ...F, alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(220,38,38,.35)', maxWidth: 360 }}>
          <AlertTriangle size={15} />{error}
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', marginLeft: 4 }}><X size={14} /></button>
        </div>
      )}
    </div>
  );
};
