import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

interface PendingSale {
  id: string
  data: any
  meta: any
}

export const Outbox: React.FC = () => {
  const [pending, setPending] = useState<PendingSale[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    try {
      const { openDatabase, getAllFromStore } = await import('@/offline/db')
      const db = await openDatabase()
      const all = await getAllFromStore(db, 'sales')
      const list = (all || []).filter((s: any) => s.meta && s.meta.syncStatus === 'DIRTY')
      setPending(list)
    } catch (e) {
      console.error('Outbox load failed', e)
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [])

  const retry = async (sale: PendingSale) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('auth_token')
      const baseURL = import.meta.env.VITE_API_BASE_URL || ''
      const headers: Record<string,string> = { 'Content-Type': 'application/json', 'Idempotency-Key': sale.id }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`${baseURL}/sales`, {
        method: 'POST',
        headers,
        body: JSON.stringify(sale.data),
      })

      if (res.ok) {
        const { openDatabase, deleteFromStore } = await import('@/offline/db')
        const db = await openDatabase()
        await deleteFromStore(db, 'sales', sale.id)
        await load()
      } else {
        console.warn('Retry failed', await res.text())
      }
    } catch (e) {
      console.error('Retry error', e)
    } finally {
      setLoading(false)
    }
  }

  const cancel = async (sale: PendingSale) => {
    try {
      const { openDatabase, deleteFromStore } = await import('@/offline/db')
      const db = await openDatabase()
      await deleteFromStore(db, 'sales', sale.id)
      await load()
    } catch (e) {
      console.error('Cancel failed', e)
    }
  }

  if (!pending || pending.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white dark:bg-gray-800 border rounded shadow p-4 z-50">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Outbox ({pending.length})</h3>
        <Button variant="ghost" onClick={load}>Refresh</Button>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-2">
        {pending.map((s) => (
          <div key={s.id} className="p-2 border rounded bg-gray-50 dark:bg-gray-700">
            <div className="text-xs text-gray-600 dark:text-gray-300">ID: {s.id}</div>
            <div className="text-sm font-medium">Total: {s.data?.total ?? '-'}</div>
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={() => retry(s)} disabled={loading}>Retry</Button>
              <Button size="sm" variant="destructive" onClick={() => cancel(s)} disabled={loading}>Cancel</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Outbox
