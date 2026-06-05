import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'

type SettingsPayload = {
  storeName?: string
  storeAddress?: string
  storePhone?: string
  storeTaxId?: string
  currency?: string
  language?: string
  dateFormat?: string
  timeFormat?: string
  numberFormat?: string
  receiptHeader?: string
  receiptFooter?: string
  theme?: 'light' | 'dark'
  offlineModeEnabled?: boolean
  autoSyncInterval?: number
  vatEnabled?: boolean
  vatRate?: number
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export const SettingsPage = () => {
  const { token } = useAuth()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<SettingsPayload>({
    storeName: '',
    storeAddress: '',
    storePhone: '',
    storeTaxId: '',
    currency: 'NGN',
    language: 'en',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: 'HH:mm',
    numberFormat: 'en-US',
    receiptHeader: '',
    receiptFooter: '',
    theme: 'light',
    offlineModeEnabled: true,
    autoSyncInterval: 300,
    vatEnabled: false,
    vatRate: 0,
  })

  const [tplSaving, setTplSaving] = useState(false)

  useEffect(() => {
    if (!token) return
    fetchSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  })

  const fetchSettings = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        headers: authHeaders()
      })
      if (!res.ok) throw new Error('Failed to load settings')
      const data = await res.json()
      setForm((prev) => ({ ...prev, ...data }))
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Error loading settings')
    } finally {
      setLoading(false)
    }
  }



  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setForm((f) => ({ ...f, [name]: (e.target as HTMLInputElement).checked }))
      return
    }
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleSave = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(form)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'Failed to save settings')
      }
      const updated = await res.json()
      setForm((f) => ({ ...f, ...updated }))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Save failed')
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">{error}</div>}
      {saved && <div className="mb-4 p-3 bg-green-100 text-green-800 rounded">Settings saved!</div>}

      <form className="space-y-6 bg-white p-6 rounded-lg shadow" onSubmit={(e) => { e.preventDefault(); handleSave() }}>
        <fieldset className="border-b pb-6">
          <legend className="text-xl font-semibold mb-4">Store Settings</legend>

          <div className="mb-4">
            <label className="block text-sm font-medium">Store Name</label>
            <Input name="storeName" value={form.storeName || ''} onChange={handleChange} />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium">Store Address</label>
            <Input name="storeAddress" value={form.storeAddress || ''} onChange={handleChange} />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium">Phone</label>
              <Input name="storePhone" value={form.storePhone || ''} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-sm font-medium">Tax ID</label>
              <Input name="storeTaxId" value={form.storeTaxId || ''} onChange={handleChange} />
            </div>
          </div>
        </fieldset>

        <fieldset className="border-b pb-6">
          <legend className="text-xl font-semibold mb-4">Currency & Localization</legend>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium">Currency</label>
              <select name="currency" value={form.currency} onChange={handleChange} className="w-full px-3 py-2 border rounded">
                <option value="NGN">NGN (₦) — Nigerian Naira</option>
                <option value="USD">USD ($) — US Dollar</option>
                <option value="GBP">GBP (£) — British Pound</option>
                <option value="EUR">EUR (€) — Euro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium">Language</label>
              <select name="language" value={form.language} onChange={handleChange} className="w-full px-3 py-2 border rounded">
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium">Number Format</label>
              <Input name="numberFormat" value={form.numberFormat || 'en-US'} onChange={handleChange} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Date Format</label>
              <select name="dateFormat" value={form.dateFormat} onChange={handleChange} className="w-full px-3 py-2 border rounded">
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium">Time Format</label>
              <select name="timeFormat" value={form.timeFormat} onChange={handleChange} className="w-full px-3 py-2 border rounded">
                <option value="HH:mm">24-hour (HH:mm)</option>
                <option value="hh:mm A">12-hour (hh:mm A)</option>
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset className="border-b pb-6">
          <legend className="text-xl font-semibold mb-4">Receipt Customization</legend>

          <div className="mb-4">
            <label className="block text-sm font-medium">Receipt Header</label>
            <textarea name="receiptHeader" value={form.receiptHeader || ''} onChange={handleChange} rows={3} className="w-full px-3 py-2 border rounded" />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium">Receipt Footer</label>
            <textarea name="receiptFooter" value={form.receiptFooter || ''} onChange={handleChange} rows={3} className="w-full px-3 py-2 border rounded" />
          </div>
        </fieldset>

        <fieldset className="border-b pb-6">
          <legend className="text-xl font-semibold mb-4">System Preferences</legend>

          <div className="mb-4">
            <label className="block text-sm font-medium">Theme</label>
            <select name="theme" value={form.theme} onChange={handleChange} className="w-full px-3 py-2 border rounded">
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="flex items-center">
              <input type="checkbox" name="offlineModeEnabled" checked={!!form.offlineModeEnabled} onChange={handleChange} className="mr-2" />
              <span className="text-sm font-medium">Enable Offline Mode</span>
            </label>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium">Auto-Sync Interval (seconds)</label>
            <Input name="autoSyncInterval" type="number" value={String(form.autoSyncInterval || 300)} onChange={handleChange as any} />
          </div>
          <div className="mb-4 border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">VAT / Tax Settings</h3>
            <label className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                name="vatEnabled"
                checked={!!form.vatEnabled}
                onChange={handleChange}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">Enable VAT on sales</span>
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Only enable this if your business is registered with FIRS and you are legally required to collect VAT.
              Most small businesses should leave this OFF.
            </p>
            {form.vatEnabled && (
              <div>
                <label className="block text-sm font-medium mb-1">VAT Rate (%)</label>
                <Input
                  name="vatRate"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={String((Number(form.vatRate) * 100).toFixed(1))}
                  onChange={(e) => {
                    const pct = parseFloat(e.target.value) || 0;
                    setForm(f => ({ ...f, vatRate: pct / 100 }));
                  }}
                  placeholder="e.g. 7.5"
                  className="w-32"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Standard Nigerian VAT rate is 7.5%. Enter the percentage, e.g. 7.5.
                </p>
              </div>
            )}
          </div>
        </fieldset>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save Settings'}</Button>
        </div>
      </form>

    </div>
  )
}