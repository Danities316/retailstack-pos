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
}

type EmailTemplate = {
  id?: string
  tenantId?: string
  templateType: string
  subject: string
  htmlContent: string
  variables?: string
  isActive?: boolean
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
    currency: 'USD',
    language: 'en',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: 'HH:mm',
    numberFormat: 'en-US',
    receiptHeader: '',
    receiptFooter: '',
    theme: 'light',
    offlineModeEnabled: true,
    autoSyncInterval: 300
  })

  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [tplSaving, setTplSaving] = useState(false)

  useEffect(() => {
    if (!token) return
    fetchSettings()
    fetchTemplates()
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

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${API_BASE}/settings/email-templates`, {
        headers: authHeaders()
      })
      if (!res.ok) throw new Error('Failed to load templates')
      const data = await res.json()
      setTemplates(data || [])
      setSelectedTemplate(data?.[0] || null)
    } catch (err) {
      console.warn('No templates or failed to load', err)
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

  const handleTemplateSelect = (type: string) => {
    const tpl = templates.find((t) => t.templateType === type) || null
    setSelectedTemplate(tpl)
  }

  const handleTemplateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!selectedTemplate) return
    const { name, value, type } = e.target
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    setSelectedTemplate({ ...selectedTemplate, [name]: val } as EmailTemplate)
  }

  const saveTemplate = async () => {
    if (!token || !selectedTemplate) return
    setTplSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/settings/email-templates/${encodeURIComponent(selectedTemplate.templateType)}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          subject: selectedTemplate.subject,
          htmlContent: selectedTemplate.htmlContent,
          variables: selectedTemplate.variables,
          isActive: selectedTemplate.isActive
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'Failed to save template')
      }
      const updated = await res.json()
      setTemplates((t) => {
        const others = t.filter((x) => x.templateType !== updated.templateType)
        return [updated, ...others]
      })
      setSelectedTemplate(updated)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Template save failed')
    } finally {
      setTplSaving(false)
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
                <option value="USD">USD ($)</option>
                <option value="NGN">NGN (₦)</option>
                <option value="GBP">GBP (£)</option>
                <option value="EUR">EUR (€)</option>
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
        </fieldset>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save Settings'}</Button>
        </div>
      </form>

      {/* Email Templates */}
      <div className="mt-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Email Templates</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Template</label>
          <select className="w-64 px-3 py-2 border rounded" value={selectedTemplate?.templateType || ''} onChange={(e) => handleTemplateSelect(e.target.value)}>
            <option value="">-- Select template --</option>
            {templates.map((t) => (
              <option key={t.templateType} value={t.templateType}>
                {t.templateType}
              </option>
            ))}
          </select>
        </div>

        {selectedTemplate ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Subject</label>
              <Input name="subject" value={selectedTemplate.subject || ''} onChange={handleTemplateChange as any} />
            </div>

            <div>
              <label className="block text-sm font-medium">HTML Content</label>
              <textarea name="htmlContent" value={selectedTemplate.htmlContent || ''} onChange={handleTemplateChange as any} rows={6} className="w-full px-3 py-2 border rounded" />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center">
                <input type="checkbox" name="isActive" checked={!!selectedTemplate.isActive} onChange={handleTemplateChange as any} className="mr-2" />
                <span className="text-sm font-medium">Active</span>
              </label>

              <Button onClick={saveTemplate} disabled={tplSaving}>{tplSaving ? 'Saving...' : 'Save Template'}</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600">Select a template to edit.</p>
        )}
      </div>
    </div>
  )
}