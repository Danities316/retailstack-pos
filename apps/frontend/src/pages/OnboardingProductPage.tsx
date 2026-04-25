/**
 * OnboardingProductPage — FULL IMPLEMENTATION
 * Owner lands here when hasProduct === false.
 * Two paths: manual form OR CSV import.
 * On success → updates onboarding state → navigates to /onboarding/first-sale
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '@/lib/apiClient'
import { OnboardingShell } from './OnboardingShell'
import {
    Package, Upload, ChevronRight, ChevronDown, ArrowRight,
    CheckCircle2, Loader2, AlertCircle, FileSpreadsheet, PlusCircle,
} from 'lucide-react'

const GOLD = '#D4AF37'

interface Category { id: string; categoryName: string }

function Field({ label, name, type = 'text', placeholder, value, onChange, required, prefix }: {
    label: string; name: string; type?: string; placeholder?: string
    value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    required?: boolean; prefix?: string
}) {
    return (
        <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {label}{required && <span style={{ color: GOLD, marginLeft: 2 }}>*</span>}
            </label>
            <div style={{ position: 'relative' }}>
                {prefix && (
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 14, fontWeight: 600, pointerEvents: 'none' }}>
                        {prefix}
                    </span>
                )}
                <input
                    name={name} type={type} placeholder={placeholder} value={value}
                    onChange={onChange} required={required}
                    style={{
                        width: '100%', padding: prefix ? '10px 12px 10px 28px' : '10px 12px',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8, color: '#f8fafc', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                    }}
                    onFocus={e => { e.target.style.borderColor = GOLD }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
                />
            </div>
        </div>
    )
}

function SuccessBanner({ message }: { message: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', padding: '32px 16px', flexDirection: 'column' }}>
            <CheckCircle2 size={44} color="#16a34a" />
            <p style={{ color: '#86efac', fontWeight: 600, fontSize: 16, margin: 0, textAlign: 'center' }}>{message}</p>
        </div>
    )
}

function ErrorBanner({ message }: { message: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#ef444415', border: '1px solid #ef444430', borderRadius: 8, padding: '10px 14px' }}>
            <AlertCircle size={15} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ color: '#fca5a5', fontSize: 13 }}>{message}</span>
        </div>
    )
}

const skipStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#475569', fontSize: 13, fontWeight: 500,
    textDecoration: 'underline', textUnderlineOffset: 3, padding: 0,
}

const primaryBtnStyle = (disabled: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 7,
    background: disabled ? '#334155' : GOLD, color: disabled ? '#64748b' : '#0f172a',
    border: 'none', borderRadius: 8, padding: '10px 20px',
    fontSize: 14, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
})

export default function OnboardingProductPage() {
    const navigate = useNavigate()
    const { token, user, updateOnboarding } = useAuth()
    const [tab, setTab] = useState<'manual' | 'import'>('manual')
    const [form, setForm] = useState({ productName: '', costPrice: '', sellingPrice: '', stock: '', categoryId: '', productDescription: '' })
    const [categories, setCategories] = useState<Category[]>([])
    const [showOptional, setShowOptional] = useState(false)
    const [csvFile, setCsvFile] = useState<File | null>(null)
    const [importReport, setImportReport] = useState<{ successCount: number } | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        if (!token) return
        apiClient.getCategories().then(setCategories).catch(() => { })
    }, [token])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(f => ({ ...f, [e.target.name]: e.target.value }))

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.productName || !form.sellingPrice) { setError('Product name and selling price are required.'); return }
        setLoading(true); setError(null)
        try {
            await apiClient.createProduct({
                productName: form.productName, productDescription: form.productDescription,
                costPrice: parseFloat(form.costPrice) || 0, sellingPrice: parseFloat(form.sellingPrice),
                stock: parseInt(form.stock) || 0, quantity: parseInt(form.stock) || 0,
                categoryId: form.categoryId || null,
            })
            setSuccess(true)
            updateOnboarding({ hasProduct: true })
            setTimeout(() => navigate('/onboarding/first-sale'), 1400)
        } catch (err: any) {
            setError(err.message || 'Failed to create product. Please try again.')
        } finally { setLoading(false) }
    }

    const handleImportSubmit = async () => {
        if (!csvFile || !user) { setError('Please select a CSV file.'); return }
        setLoading(true); setError(null)
        try {
            const result = await apiClient.uploadProducts(csvFile, user.tenantId, token!)
            const report = result.report || result
            setImportReport({ successCount: report.successCount })
            if (report.successCount > 0) {
                setSuccess(true)
                updateOnboarding({ hasProduct: true })
                setTimeout(() => navigate('/onboarding/first-sale'), 1800)
            } else {
                setError('No products were imported. Check your CSV format and try again.')
            }
        } catch (err: any) {
            setError(err.message || 'Import failed. Please try again.')
        } finally { setLoading(false) }
    }

    const handleSkip = () => {
        updateOnboarding({ hasProduct: true, hasSale: true })
        navigate('/dashboard')
    }

    return (
        <OnboardingShell currentStep={1}>
            {/* Header */}
            <div style={{ marginBottom: 28, paddingTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${GOLD}33, ${GOLD}11)`, border: `1px solid ${GOLD}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Package size={18} color={GOLD} />
                    </div>
                    <h1 style={{ color: '#f8fafc', fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
                        Add your first product
                    </h1>
                </div>
                <p style={{ color: '#64748b', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
                    You need at least one product before you can record a sale. Add it manually or import from a spreadsheet.
                </p>
            </div>

            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4, border: '1px solid rgba(255,255,255,0.08)' }}>
                {([{ key: 'manual' as const, label: 'Add manually', Icon: PlusCircle }, { key: 'import' as const, label: 'Import from CSV', Icon: FileSpreadsheet }]).map(({ key, label, Icon }) => (
                    <button key={key} onClick={() => { setTab(key); setError(null) }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 16px', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s', background: tab === key ? GOLD : 'transparent', color: tab === key ? '#0f172a' : '#64748b' }}>
                        <Icon size={14} /> {label}
                    </button>
                ))}
            </div>

            {/* Card */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 24 }}>

                {/* ── MANUAL TAB ── */}
                {tab === 'manual' && (
                    success ? <SuccessBanner message="Product created! Moving to your first sale…" /> : (
                        <form onSubmit={handleManualSubmit}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <Field label="Product Name" name="productName" value={form.productName} onChange={handleChange} required placeholder="e.g. Indomie Noodles" />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <Field label="Selling Price" name="sellingPrice" type="number" value={form.sellingPrice} onChange={handleChange} required prefix="₦" placeholder="0.00" />
                                    <Field label="Cost Price" name="costPrice" type="number" value={form.costPrice} onChange={handleChange} prefix="₦" placeholder="0.00 (optional)" />
                                </div>
                                <Field label="Stock / Quantity" name="stock" type="number" value={form.stock} onChange={handleChange} placeholder="0" />

                                <button type="button" onClick={() => setShowOptional(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', padding: 0 }}>
                                    {showOptional ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Optional details
                                </button>

                                {showOptional && (
                                    <>
                                        <Field label="Description" name="productDescription" value={form.productDescription} onChange={handleChange} placeholder="Short description" />
                                        {categories.length > 0 && (
                                            <div>
                                                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Category</label>
                                                <select name="categoryId" value={form.categoryId} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f8fafc', fontSize: 14, outline: 'none' }}>
                                                    <option value="">No category</option>
                                                    {categories.map(c => <option key={c.id} value={c.id}>{c.categoryName}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </>
                                )}

                                {error && <ErrorBanner message={error} />}

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
                                    <button type="button" onClick={handleSkip} style={skipStyle}>Skip for now</button>
                                    <button type="submit" disabled={loading} style={primaryBtnStyle(loading)}>
                                        {loading ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : <><CheckCircle2 size={15} /> Save & Continue <ArrowRight size={14} /></>}
                                    </button>
                                </div>
                            </div>
                        </form>
                    )
                )}

                {/* ── IMPORT TAB ── */}
                {tab === 'import' && (
                    success ? <SuccessBanner message={`${importReport?.successCount} product(s) imported! Moving to first sale…`} /> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ background: 'rgba(212,175,55,0.08)', border: `1px solid ${GOLD}33`, borderRadius: 8, padding: 14, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
                                <p style={{ margin: '0 0 6px', fontWeight: 600, color: GOLD }}>CSV column format</p>
                                <code style={{ fontSize: 11, color: '#cbd5e1' }}>productName, sellingPrice, costPrice, stock, categoryName, description</code>
                                <p style={{ margin: '8px 0 0', fontSize: 12 }}>Only <strong style={{ color: '#f8fafc' }}>productName</strong> and <strong style={{ color: '#f8fafc' }}>sellingPrice</strong> are required.</p>
                            </div>

                            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px dashed ${csvFile ? GOLD : 'rgba(255,255,255,0.12)'}`, borderRadius: 12, padding: '32px 24px', cursor: 'pointer', gap: 10, background: csvFile ? `${GOLD}08` : 'transparent', transition: 'all 0.2s' }}>
                                <input type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setCsvFile(f); setError(null) } }} />
                                <Upload size={28} color={csvFile ? GOLD : '#475569'} />
                                {csvFile ? (
                                    <><span style={{ color: GOLD, fontWeight: 600, fontSize: 14 }}>{csvFile.name}</span><span style={{ color: '#64748b', fontSize: 12 }}>{(csvFile.size / 1024).toFixed(1)} KB — Click to change</span></>
                                ) : (
                                    <><span style={{ color: '#94a3b8', fontWeight: 500, fontSize: 14 }}>Click to upload or drag a CSV here</span><span style={{ color: '#475569', fontSize: 12 }}>Max 5 MB</span></>
                                )}
                            </label>

                            {error && <ErrorBanner message={error} />}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <button type="button" onClick={handleSkip} style={skipStyle}>Skip for now</button>
                                <button onClick={handleImportSubmit} disabled={!csvFile || loading} style={primaryBtnStyle(!csvFile || loading)}>
                                    {loading ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Importing…</> : <><Upload size={15} /> Import & Continue <ArrowRight size={14} /></>}
                                </button>
                            </div>
                        </div>
                    )
                )}
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </OnboardingShell>
    )
}