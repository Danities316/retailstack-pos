import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '@/lib/apiClient'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { getAllFromStore, openDatabase } from '@/offline/db'

const N = (n: number) =>
    '₦' + Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const normalizeName = (name: string | null | undefined) =>
    name?.trim() ? name.trim() : 'Unknown customer'

const clampNumber = (value: any) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

type LocalCreditSale = {
    id: string
    amount: number
    amountPaid: number
    balance: number
    sale: { createdAt: string; totalAmount: number }
    pendingSync?: boolean
}

type CustomerDebt = {
    id: string
    name: string
    phone: string | null
    totalOwed: number
    creditSales: LocalCreditSale[]
}

export function CustomerDebtPage() {
    const { token, user } = useAuth()
    const isOnline = useOnlineStatus()
    const [customers, setCustomers] = useState<CustomerDebt[]>([])
    const [loading, setLoading] = useState(true)
    const [settling, setSettling] = useState<string | null>(null)
    const [amounts, setAmounts] = useState<Record<string, string>>({})
    const [error, setError] = useState<string | null>(null)

    const buildLocalDebts = useCallback(async (): Promise<CustomerDebt[]> => {
        if (!user?.tenantId) return []

        try {
            const db = await openDatabase()
            const allSales = await getAllFromStore(db, 'sales')
            const records = Array.isArray(allSales) ? allSales : []
            const grouped = new Map<string, CustomerDebt>()

            records.forEach((record: any) => {
                if (!record || record.tenantId !== user.tenantId) return
                const payload = record.data
                if (!payload || payload.paymentMethod !== 'CREDIT') return

                const name = normalizeName(payload.customerName)
                const key = name.toLowerCase()
                const amount = clampNumber(payload.totalAmount)
                const creditSale: LocalCreditSale = {
                    id: record.id,
                    amount,
                    amountPaid: 0,
                    balance: amount,
                    sale: {
                        createdAt: payload.createdAt || new Date().toISOString(),
                        totalAmount: amount,
                    },
                    pendingSync: true,
                }

                const existing = grouped.get(key)
                if (existing) {
                    existing.totalOwed += amount
                    existing.creditSales.push(creditSale)
                } else {
                    grouped.set(key, {
                        id: `offline_${key}`,
                        name,
                        phone: null,
                        totalOwed: amount,
                        creditSales: [creditSale],
                    })
                }
            })

            return Array.from(grouped.values())
        } catch (err) {
            console.warn('[CustomerDebtPage] Failed to load offline debts', err)
            return []
        }
    }, [user?.tenantId])

    const mergeCustomers = useCallback((online: any[], local: CustomerDebt[]): CustomerDebt[] => {
        const merged = new Map<string, CustomerDebt>()

        online.forEach((customer) => {
            const name = normalizeName(customer.name)
            const key = name.toLowerCase()
            const totalOwed = Math.max(clampNumber(customer.totalOwed), 0)
            const creditSales = Array.isArray(customer.creditSales)
                ? customer.creditSales.map((cs: any) => ({
                    id: cs.id,
                    amount: clampNumber(cs.amount),
                    amountPaid: clampNumber(cs.amountPaid),
                    balance: Math.max(clampNumber(cs.balance), 0),
                    sale: {
                        createdAt: cs.sale?.createdAt || new Date().toISOString(),
                        totalAmount: clampNumber(cs.sale?.totalAmount),
                    },
                }))
                : []

            merged.set(key, {
                id: customer.id,
                name,
                phone: customer.phone || null,
                totalOwed,
                creditSales,
            })
        })

        local.forEach((customer) => {
            const key = customer.name.toLowerCase()
            const existing = merged.get(key)

            if (existing) {
                existing.totalOwed += customer.totalOwed
                existing.creditSales = [...existing.creditSales, ...customer.creditSales]
            } else {
                merged.set(key, customer)
            }
        })

        return Array.from(merged.values())
    }, [])

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)

        const localDebts = await buildLocalDebts()
        let serverCustomers: any[] = []

        if (token && isOnline) {
            try {
                const res = await apiClient.request('/credit/customers')
                serverCustomers = Array.isArray(res.data) ? res.data : []
            } catch (err: any) {
                console.warn('[CustomerDebtPage] Failed to load credit customers', err)
                if (!navigator.onLine) {
                    setError('Offline — showing local pending credit sales only.')
                } else {
                    setError(err?.message || 'Unable to load customer debts.')
                }
            }
        }

        setCustomers(mergeCustomers(serverCustomers, localDebts))
        setLoading(false)
    }, [buildLocalDebts, mergeCustomers, isOnline, token])

    useEffect(() => {
        if (!user) return
        load()
    }, [user, load])

    const handleSettle = async (creditSaleId: string) => {
        if (!isOnline) {
            alert('Please connect to the internet to settle customer debt.')
            return
        }

        const amt = parseFloat(amounts[creditSaleId] || '')
        if (!amt || amt <= 0) return

        setSettling(creditSaleId)
        try {
            await apiClient.request('/credit/settle', {
                method: 'POST',
                body: JSON.stringify({ creditSaleId, amountPaid: amt }),
            })
            await load()
            setAmounts((a) => ({ ...a, [creditSaleId]: '' }))
        } catch (err: any) {
            alert(err.message || 'Failed to record payment')
        } finally {
            setSettling(null)
        }
    }

    const totalOutstanding = customers.reduce((sum, c) => sum + Math.max(clampNumber(c.totalOwed), 0), 0)

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <p className="text-gray-400">Loading customer debts…</p>
        </div>
    )

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

            {/* Header */}
            <div>
                <h1 className="text-3xl font-extrabold text-gray-900">Customer Debts</h1>
                <p className="text-gray-500 text-sm mt-1">
                    Track what customers owe your shop.
                </p>
            </div>

            {!isOnline && (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-5 py-4 text-sm text-yellow-700">
                    Offline mode: showing pending credit sales from local storage. Connect to sync and settle debts.
                </div>
            )}

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* Total outstanding */}
            {totalOutstanding > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-red-800">Total Outstanding</p>
                        <p className="text-xs text-red-600 mt-0.5">Across all customers</p>
                    </div>
                    <p className="text-2xl font-black text-red-700">{N(totalOutstanding)}</p>
                </div>
            )}

            {/* Empty state */}
            {customers.length === 0 && (
                <div className="py-16 text-center bg-white rounded-xl border border-gray-200">
                    <p className="text-4xl mb-3">📒</p>
                    <p className="font-semibold text-gray-800">No outstanding debts</p>
                    <p className="text-sm text-gray-400 mt-1">
                        When you charge a sale to a customer's account, it appears here.
                    </p>
                </div>
            )}

            {/* Customer list */}
            {customers.map((customer) => (
                <div key={customer.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* Customer header */}
                    <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                        <div>
                            <p className="font-bold text-gray-900">{customer.name}</p>
                            {customer.phone && (
                                <p className="text-sm text-gray-400">{customer.phone}</p>
                            )}
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-black text-red-600">{N(customer.totalOwed)}</p>
                            <p className="text-xs text-gray-400">total owed</p>
                        </div>
                    </div>

                    {/* Individual credit sales */}
                    {customer.creditSales.map((cs) => (
                        <div key={cs.id} className="px-5 py-3 border-b border-gray-50 last:border-0">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm text-gray-700">
                                            Sale on {new Date(cs.sale.createdAt).toLocaleDateString('en-NG')}
                                        </p>
                                        {cs.pendingSync && (
                                            <span className="text-xs font-semibold uppercase tracking-wide text-yellow-800 bg-yellow-100 rounded-full px-2 py-0.5">
                                                Pending sync
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        Original: {N(cs.amount)} · Paid: {N(cs.amountPaid)} · Balance: {N(Math.max(cs.balance, 0))}
                                    </p>
                                </div>

                                {/* Record payment */}
                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="₦ amount"
                                        value={amounts[cs.id] || ''}
                                        onChange={(e) => setAmounts((a) => ({ ...a, [cs.id]: e.target.value }))}
                                        disabled={!isOnline || cs.pendingSync}
                                        className="w-28 px-2 py-1.5 border rounded-lg text-sm text-gray-800 disabled:bg-gray-100"
                                    />
                                    <button
                                        onClick={() => handleSettle(cs.id)}
                                        disabled={
                                            settling === cs.id ||
                                            !amounts[cs.id] ||
                                            !isOnline ||
                                            cs.pendingSync
                                        }
                                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                                    >
                                        {cs.pendingSync
                                            ? 'Sync first'
                                            : settling === cs.id
                                                ? 'Saving…'
                                                : 'Record Payment'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    )
}

export default CustomerDebtPage