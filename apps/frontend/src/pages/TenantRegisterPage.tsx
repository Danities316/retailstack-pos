import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/context/AuthContext'
import { Store, Mail, Lock, User, Phone, UserPlus, Loader2, ArrowRight } from 'lucide-react';

// Define the brand color for consistency
const HERO_GOLD = '#D4AF37';

interface InputProps {
  Icon: React.ElementType;
  name: keyof typeof defaultFormState; // Ensure type safety for form keys
  placeholder: string;
  type?: string;
  form: typeof defaultFormState;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const defaultFormState = {
  tenantName: "",
  ownerEmail: "",
  ownerPassword: "",
  ownerName: "",
  phoneNumber: "",
};

const InputWithIcon: React.FC<InputProps> = ({ Icon, name, placeholder, type = 'text', form, handleChange }) => (
  <div className="relative">
    <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
    <input
      id={name}
      name={name}
      type={type}
      placeholder={placeholder}
      // FIX: Ensure value is correctly read from the form state
      value={form[name]}
      onChange={handleChange}
      className="pl-11 pr-4 py-3 w-full border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition duration-200"
      required
    />
  </div>
);
// ----------------------------------------------------------------------

export const TenantRegisterPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth()
  const [form, setForm] = useState(defaultFormState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [devVerificationLink, setDevVerificationLink] = useState<string | null>(null);
  // const baseURL = "http://localhost:3000/api"
  const baseURL = import.meta.env.VITE_API_BASE_URL

  // ----------------------------------------------------------------------
  // FIX: Using functional update for setForm for reliability
  // This ensures the update uses the latest state, though the original was usually fine.
  // ----------------------------------------------------------------------
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prevForm => ({ ...prevForm, [name]: value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Validation
    if (!form.tenantName || !form.ownerName || !form.ownerEmail || !form.ownerPassword) {
      setError('All fields are required.');
      setLoading(false);
      return;
    }

    if (form.ownerPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      setLoading(false);
      return;
    }

    try {
      // Use the new /auth/onboard endpoint (public, rate-limited)
      const payload = {
        tenantName: form.tenantName,
        ownerName: form.ownerName,
        ownerEmail: form.ownerEmail,
        ownerPassword: form.ownerPassword,
        phoneNumber: form.phoneNumber,
      };

      const url = `${baseURL}/auth/onboard`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const resBody = await res.json().catch(() => null);
      console.log('Onboarding response:', resBody);

      if (!res.ok) {
        const message = resBody?.error || resBody?.message || 'Registration failed';
        throw new Error(message);
      }

      // Store dev verification link if available (development mode)
      if (resBody?.verificationLink) {
        setDevVerificationLink(resBody.verificationLink);
      }

      setSuccess('✓ Tenant created successfully! Check your email to verify your account.');
      // Redirect to verification page with token extracted from the verification link
      // Wait 5 seconds so user can read the success message
      setTimeout(() => {
        // Extract token from verificationLink (format: http://localhost:5173/verify-email/{token})
        let redirectPath = '/verify-email';
        if (resBody?.verificationLink) {
          // Parse the token from the link
          const linkParts = resBody.verificationLink.split('/verify-email/');
          if (linkParts.length > 1) {
            const token = linkParts[1];
            redirectPath = `/verify-email/${token}`;
          }
        }
        // Include email as query param for resend capability
        const params = new URLSearchParams({ email: form.ownerEmail });
        navigate(`${redirectPath}?${params.toString()}`);
      }, 5000);
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="w-full max-w-lg">

        {/* Branding Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900" style={{ color: HERO_GOLD }}>
            ADINO POS Registration
          </h1>
          <p className="text-gray-600 mt-2">Get started in minutes and revolutionize your retail business.</p>
        </div>

        {/* Success Screen - Show when registration is successful */}
        {success ? (
          <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl border border-gray-100 text-center">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Registration Successful! 🎉</h2>
              <p className="text-gray-600 mb-4">Your store has been created successfully.</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6 text-left">
              <h3 className="font-bold text-blue-900 mb-3 text-lg">Next Step: Verify Your Email</h3>
              <p className="text-blue-800 text-sm mb-3">
                We've sent a verification link to: <span className="font-mono font-bold">{form.ownerEmail}</span>
              </p>
              <ul className="text-blue-800 text-sm space-y-2">
                <li>✓ Check your email for the verification link</li>
                <li>✓ Click the link to verify your account</li>
                <li>✓ Return here to log in with your credentials</li>
              </ul>
              <p className="text-blue-700 text-xs mt-3">
                💡 <strong>Tip:</strong> Don't see the email? Check your spam/junk folder
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => navigate('/verify-email')}
                className="w-full px-6 py-3 rounded-xl font-bold text-white text-lg transition hover:opacity-90"
                style={{ backgroundColor: HERO_GOLD }}
              >
                Go to Email Verification
              </button>
              <Link
                to="/login"
                className="w-full block px-6 py-3 rounded-xl font-bold text-gray-700 text-lg transition border-2"
                style={{ borderColor: HERO_GOLD, color: HERO_GOLD }}
              >
                Already Verified? Go to Login
              </Link>
            </div>

            <p className="text-gray-500 text-xs mt-6">
              Automatically redirecting to verification in a few seconds...
            </p>
          </div>
        ) : (
          /* Registration Form Card */
          <form
            onSubmit={handleRegister}
            className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl border border-gray-100 space-y-6"
          >
            <h2 className="text-2xl font-bold text-center text-gray-800 flex items-center justify-center gap-2 pb-4 border-b border-gray-100">
              <UserPlus className="w-6 h-6 text-gray-600" />
              Tenant Setup
            </h2>

            {/* Error Messages */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm" role="alert">
                {error}
              </div>
            )}

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Store Details */}
              <div className="sm:col-span-2">
                <h3 className="text-base font-semibold text-gray-700 mt-2 mb-2">Store Details</h3>
                <InputWithIcon
                  Icon={Store}
                  name="tenantName"
                  placeholder="Store/Tenant Name (e.g., Jane's Boutique)"
                  form={form}
                  handleChange={handleChange}
                />
              </div>

              {/* Owner/Admin Details */}
              <div className="sm:col-span-2">
                <h3 className="text-base font-semibold text-gray-700 mt-4 mb-2">Admin Account Setup</h3>
              </div>

              <InputWithIcon
                Icon={User}
                name="ownerName"
                placeholder="Owner/Admin Name"
                form={form}
                handleChange={handleChange}
              />
              <InputWithIcon
                Icon={Phone}
                name="phoneNumber"
                placeholder="Phone Number"
                form={form}
                handleChange={handleChange}
              />
              <div className="sm:col-span-2">
                <InputWithIcon
                  Icon={Mail}
                  name="ownerEmail"
                  placeholder="Admin Email (used for login)"
                  type="email"
                  form={form}
                  handleChange={handleChange}
                />
              </div>
              <div className="sm:col-span-2">
                <InputWithIcon
                  Icon={Lock}
                  name="ownerPassword"
                  placeholder="Password (minimum 8 characters)"
                  type="password"
                  form={form}
                  handleChange={handleChange}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center px-6 py-3 rounded-xl font-bold text-white text-lg transition duration-300 transform hover:scale-[1.01] shadow-md mt-6"
              style={{ backgroundColor: HERO_GOLD }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5 mr-2" />
                  Register My Store
                </>
              )}
            </button>

            {/* Login Prompt */}
            <div className="text-center mt-6 text-sm text-gray-600 pt-4 border-t border-gray-100">
              Already have an account?{' '}
              <Link to="/login" className="font-bold hover:text-gray-900" style={{ color: HERO_GOLD }}>
                Log In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};