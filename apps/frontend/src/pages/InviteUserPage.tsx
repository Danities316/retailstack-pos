import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '@/lib/apiClient'
import { User, Phone, Loader2, UserPlus, CheckCircle, ArrowLeft } from 'lucide-react'

const HERO_GOLD = '#D4AF37'

const ROLES = [
  {
    value: 'CASHIER',
    label: 'Cashier',
    description: 'Can process sales and view products',
  },
  {
    value: 'MANAGER',
    label: 'Manager',
    description: 'Can manage products, users, and view reports',
  },
]

export const InviteUserPage = () => {
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()

  const [form, setForm] = useState({
    name: '',
    phoneNumber: '',
    role: 'CASHIER',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.name.trim() || !form.phoneNumber.trim()) {
      setError('Name and phone number are required.')
      return
    }

    setLoading(true)

    try {
      // Always use SMS — email is disabled until domain is set up
      await apiClient.request('/users/invite', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          phoneNumber: form.phoneNumber.trim(),
          // email is generated server-side as a placeholder — not used for notification
          email: `${form.phoneNumber.trim().replace(/\D/g, '')}@placeholder.adinopos.com`,
          role: form.role,
          notificationMethod: 'sms',
        }),
      })

      setSuccess(true)
      setTimeout(() => navigate('/dashboard/users'), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto p-6 mt-10">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-10 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invitation Sent!</h2>
          <p className="text-gray-600 mb-1">
            A 6-digit setup code was sent to{' '}
            <span className="font-semibold text-gray-800">{form.phoneNumber}</span>.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            They can visit <span className="font-mono text-gray-700">/auth/setup</span> and enter
            the code to activate their account.
          </p>
          <p className="text-xs text-gray-400">Redirecting to users list...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/dashboard/users')}
          className="p-2 rounded-lg hover:bg-gray-100 transition"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invite Team Member</h1>
          <p className="text-gray-500 text-sm">They'll receive a setup code via SMS</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={e => handleChange('name', e.target.value)}
                placeholder="e.g. Amaka Johnson"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition"
                required
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="phoneNumber"
                type="tel"
                value={form.phoneNumber}
                onChange={e => handleChange('phoneNumber', e.target.value)}
                placeholder="e.g. 08012345678"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition"
                required
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              A 6-digit setup code will be sent to this number
            </p>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Role</label>
            <div className="space-y-2">
              {ROLES.map(role => (
                <label
                  key={role.value}
                  className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition ${form.role === role.value ? 'border-[#D4AF37] bg-[#D4AF3708]' : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={role.value}
                    checked={form.role === role.value}
                    onChange={e => handleChange('role', e.target.value)}
                    className="mt-0.5 accent-[#D4AF37]"
                  />
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{role.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{role.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: HERO_GOLD }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Send Invite
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/users')}
              className="px-4 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default InviteUserPage

// import { useState } from 'react'
// import { useNavigate } from 'react-router-dom'
// import { Button } from '@/components/ui/button'
// import { Input } from '@/components/ui/input'
// import { useAuth } from '@/context/AuthContext'
// import { apiClient } from '@/lib/apiClient'

// export const InviteUserPage = () => {
//   const navigate = useNavigate()
//   const { user: currentUser } = useAuth()
//   const [formData, setFormData] = useState({
//     email: '',
//     name: '',
//     role: 'CASHIER',
//     phoneNumber: '',
//     notificationMethod: 'email' // 'email' | 'sms' | 'both'
//   })
//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState<string | null>(null)
//   const [success, setSuccess] = useState<string | null>(null)

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault()
//     setLoading(true)
//     setError(null)
//     setSuccess(null)
//     console.log("Send invitation with details: ", JSON.stringify(formData))

//     if (!formData.email || !formData.name || !formData.phoneNumber) {
//       setError('Email, name, and phone number are required')
//       setLoading(false)
//       return
//     }

//     if (!formData.notificationMethod) {
//       setError('Please select a notification method')
//       setLoading(false)
//       return
//     }

//     try {
//       const response = await apiClient.request('/users/invite', {
//         method: 'POST',
//         body: JSON.stringify(formData)
//       })

//       setSuccess(`User invitation sent successfully via ${formData.notificationMethod}!`)
//       setFormData({
//         email: '',
//         name: '',
//         role: 'CASHIER',
//         phoneNumber: '',
//         notificationMethod: 'email'
//       })

//       setTimeout(() => navigate('/dashboard/users'), 2500)
//     } catch (err: any) {
//       setError(err.message || 'Failed to send invitation')
//     } finally {
//       setLoading(false)
//     }
//   }

//   const handleInputChange = (field: string, value: string) => {
//     setFormData(prev => ({
//       ...prev,
//       [field]: value
//     }))
//   }

//   const getAvailableRoles = () => {
//     const roles = [
//       { value: 'CASHIER', label: 'Cashier' },
//       { value: 'MANAGER', label: 'Manager' }
//     ]

//     // Only SUPER_ADMIN can create OWNER roles
//     if (currentUser?.role === 'SUPER_ADMIN') {
//       roles.push({ value: 'OWNER', label: 'Owner' })
//     }

//     return roles
//   }

//   return (
//     <div className="max-w-2xl mx-auto p-6">
//       <div className="flex justify-between items-center mb-6">
//         <div>
//           <h1 className="text-3xl font-extrabold text-gray-900">Invite User</h1>
//           <p className="text-gray-600">Send an invitation to join your organization</p>
//         </div>
//         <Button style={{ background: '#0f172a', borderColor: '#0f172a', color: '#D4AF37' }} onClick={() => navigate('/dashboard/users')}>
//           Back to Users
//         </Button>
//       </div>

//       <div className="bg-white rounded-lg shadow p-6">
//         <form onSubmit={handleSubmit} className="space-y-6">
//           {error && (
//             <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
//               {error}
//             </div>
//           )}

//           {success && (
//             <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
//               {success}
//             </div>
//           )}

//           <div>
//             <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
//               Full Name *
//             </label>
//             <Input
//               id="name"
//               type="text"
//               value={formData.name}
//               onChange={(e) => handleInputChange('name', e.target.value)}
//               placeholder="Enter full name"
//               required
//             />
//           </div>

//           <div>
//             <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
//               Email Address *
//             </label>
//             <Input
//               id="email"
//               type="email"
//               value={formData.email}
//               onChange={(e) => handleInputChange('email', e.target.value)}
//               placeholder="Enter email address"
//               required
//             />
//           </div>

//           <div>
//             <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
//               Phone Number *
//             </label>
//             <Input
//               id="phoneNumber"
//               type="tel"
//               value={formData.phoneNumber}
//               onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
//               placeholder="Enter phone number"
//               required
//             />
//           </div>

//           <div>
//             <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
//               Role *
//             </label>
//             <select
//               id="role"
//               value={formData.role}
//               onChange={(e) => handleInputChange('role', e.target.value)}
//               className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//               required
//             >
//               {getAvailableRoles().map(role => (
//                 <option key={role.value} value={role.value}>
//                   {role.label}
//                 </option>
//               ))}
//             </select>
//             <p className="text-sm text-gray-500 mt-1">
//               Select the appropriate role for this user
//             </p>
//           </div>

//           {/* Notification Method Selection */}
//           <div>
//             <label className="block text-sm font-medium text-gray-700 mb-3">
//               How should we send the invitation? *
//             </label>
//             <div className="space-y-3">
//               <div className="flex items-center border border-gray-300 rounded-lg p-4 cursor-pointer hover:bg-gray-50" onClick={() => handleInputChange('notificationMethod', 'email')}>
//                 <input
//                   type="radio"
//                   id="method-email"
//                   name="notificationMethod"
//                   value="email"
//                   checked={formData.notificationMethod === 'email'}
//                   onChange={(e) => handleInputChange('notificationMethod', e.target.value)}
//                   className="h-4 w-4 text-blue-600 focus:ring-blue-500"
//                 />
//                 <label htmlFor="method-email" className="ml-3 cursor-pointer flex-1">
//                   <div className="font-medium text-gray-900">📧 Email Invitation</div>
//                   <p className="text-sm text-gray-600">Send setup link via email (user clicks link to set password)</p>
//                 </label>
//               </div>

//               <div className="flex items-center border border-gray-300 rounded-lg p-4 cursor-pointer hover:bg-gray-50" onClick={() => handleInputChange('notificationMethod', 'sms')}>
//                 <input
//                   type="radio"
//                   id="method-sms"
//                   name="notificationMethod"
//                   value="sms"
//                   checked={formData.notificationMethod === 'sms'}
//                   onChange={(e) => handleInputChange('notificationMethod', e.target.value)}
//                   className="h-4 w-4 text-blue-600 focus:ring-blue-500"
//                 />
//                 <label htmlFor="method-sms" className="ml-3 cursor-pointer flex-1">
//                   <div className="font-medium text-gray-900">📱 SMS with Code</div>
//                   <p className="text-sm text-gray-600">Send 6-digit setup code via SMS (user enters code on setup page)</p>
//                 </label>
//               </div>

//               <div className="flex items-center border border-gray-300 rounded-lg p-4 cursor-pointer hover:bg-gray-50" onClick={() => handleInputChange('notificationMethod', 'both')}>
//                 <input
//                   type="radio"
//                   id="method-both"
//                   name="notificationMethod"
//                   value="both"
//                   checked={formData.notificationMethod === 'both'}
//                   onChange={(e) => handleInputChange('notificationMethod', e.target.value)}
//                   className="h-4 w-4 text-blue-600 focus:ring-blue-500"
//                 />
//                 <label htmlFor="method-both" className="ml-3 cursor-pointer flex-1">
//                   <div className="font-medium text-gray-900">📧📱 Both Methods</div>
//                   <p className="text-sm text-gray-600">Send both email link and SMS code for maximum flexibility</p>
//                 </label>
//               </div>
//             </div>
//           </div>

//           <div className="flex gap-4 pt-4">
//             <Button type="submit" disabled={loading} style={{ background: '#0f172a', borderColor: '#0f172a', color: '#D4AF37' }}>
//               {loading ? 'Sending Invitation...' : 'Send Invitation'}
//             </Button>
//             <Button
//               type="button"
//               style={{ background: '#D4AF37', borderColor: '#0f172a', color: '#f0eced' }}
//               onClick={() => navigate('/dashboard/users')}
//             >
//               Cancel
//             </Button>
//           </div>
//         </form>
//       </div>

//       {/* Information Section */}
//       <div className="mt-6 bg-blue-50 p-4 rounded-lg">
//         <h3 className="text-lg font-semibold mb-2">How It Works</h3>
//         <ul className="text-sm text-gray-700 space-y-1">
//           <li>• <strong>Email:</strong> User receives link to set up password (recommended for managers)</li>
//           <li>• <strong>SMS:</strong> User receives 6-digit code to complete setup (recommended for remote staff)</li>
//           <li>• <strong>Both:</strong> Send both email and SMS for users who prefer flexibility</li>
//           <li>• All invitations expire after 24 hours for security</li>
//         </ul>
//       </div>

//       {/* Role Information */}
//       <div className="mt-4 bg-yellow-50 p-4 rounded-lg">
//         <h3 className="text-lg font-semibold mb-2 text-yellow-800">Role Permissions</h3>
//         <div className="text-sm text-yellow-700 space-y-2">
//           <div>
//             <strong>Cashier:</strong> Can view products, create sales, and manage basic operations
//           </div>
//           <div>
//             <strong>Manager:</strong> Can manage products, categories, users, and view reports
//           </div>
//           {currentUser?.role === 'SUPER_ADMIN' && (
//             <div>
//               <strong>Owner:</strong> Full access to all features including tenant settings
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   )
// } 