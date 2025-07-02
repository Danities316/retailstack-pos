import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'

export const SettingsPage = () => {
  const { token } = useAuth()

  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch('http://localhost:4000/api/tenants/me/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ loyverseApiKey: apiKey }),
      })
      if (!res.ok) throw new Error('Failed to save key')
      setSaved(true)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Loyverse Integration</h1>

      <div className="space-y-4 max-w-md">
        <Input
          placeholder="Enter your Loyverse API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <Button onClick={handleSave} disabled={loading || !apiKey}>
          {loading ? 'Saving...' : 'Save API Key'}
        </Button>
        {saved && <p className="text-green-600 text-sm">Key saved successfully!</p>}
      </div>
    </div>
  )
}
