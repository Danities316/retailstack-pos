import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export const SuperAdminRegisterPage = () => {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    tenantName: '',
    phoneNumber: '',
    logoUrl: '',
    colorScheme: '',
    loyverseApiKey: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
<<<<<<< HEAD
      const res = await fetch('https://retailstack-pos.onrender.com/api/superadmin/tenants', {
=======
      const res = await fetch('http://localhost:3000/api/superadmin/tenants', {
>>>>>>> f3fdb7e (Initial commit)
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')
      setSuccess('Tenant registered successfully!')
      setTimeout(() => navigate('/login'), 1500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <form
        onSubmit={handleRegister}
        className="bg-white p-6 rounded-xl shadow-xl space-y-4 w-full max-w-sm"
      >
        <h2 className="text-xl font-semibold text-center">Super Admin Tenant Registration</h2>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm">{success}</p>}
        <Input name="tenantName" placeholder="Tenant Name" value={form.tenantName} onChange={handleChange} />
        <Input name="phoneNumber" placeholder="Phone Number" value={form.phoneNumber} onChange={handleChange} />
        <Input name="logoUrl" placeholder="Logo URL (optional)" value={form.logoUrl} onChange={handleChange} />
        <Input name="colorScheme" placeholder="Color Scheme (optional)" value={form.colorScheme} onChange={handleChange} />
        <Input name="loyverseApiKey" placeholder="Loyverse API Key (optional)" value={form.loyverseApiKey} onChange={handleChange} />
        <Input name="ownerName" placeholder="Owner Name" value={form.ownerName} onChange={handleChange} />
        <Input name="ownerEmail" placeholder="Owner Email" value={form.ownerEmail} onChange={handleChange} />
        <Input name="ownerPassword" type="password" placeholder="Owner Password" value={form.ownerPassword} onChange={handleChange} />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Registering...' : 'Register'}
        </Button>
      </form>
    </div>
  )
}