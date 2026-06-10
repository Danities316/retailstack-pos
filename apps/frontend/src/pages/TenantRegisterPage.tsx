import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Store, Mail, Lock, User, Phone, UserPlus, Loader2 } from 'lucide-react';

const HERO_GOLD = '#D4AF37';

const defaultFormState = {
  tenantName: "",
  ownerEmail: "",
  ownerPassword: "",
  ownerName: "",
  phoneNumber: "",
};

interface InputFieldProps {
  Icon: React.ElementType;
  name: keyof typeof defaultFormState;
  placeholder: string;
  type?: string;
  form: typeof defaultFormState;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const InputWithIcon: React.FC<InputFieldProps> = ({ Icon, name, placeholder, type = 'text', form, handleChange }) => (
  <div className="relative">
    <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
    <input
      id={name}
      name={name}
      type={type}
      placeholder={placeholder}
      value={form[name]}
      onChange={handleChange}
      className="pl-11 pr-4 py-3 w-full border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition duration-200"
      required
    />
  </div>
);

export const TenantRegisterPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(defaultFormState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseURL = import.meta.env.VITE_API_BASE_URL;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prevForm => ({ ...prevForm, [name]: value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.tenantName || !form.ownerName || !form.ownerEmail || !form.ownerPassword || !form.phoneNumber) {
      setError('All fields are required.');
      return;
    }

    if (form.ownerPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${baseURL}/auth/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantName: form.tenantName,
          ownerName: form.ownerName,
          email: form.ownerEmail,
          password: form.ownerPassword,
          phoneNumber: form.phoneNumber,
        }),
      });

      const resBody = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(resBody?.error || resBody?.message || 'Registration failed.');
      }

      // Backend returns tenant with the created user inside tenant.users[0]
      const userId = resBody?.tenant?.users?.[0]?.id;

      // Navigate to phone OTP verification — SMS has already been sent by the backend
      navigate('/verify-phone', {
        state: {
          userId,
          phoneNumber: form.phoneNumber,
          // After successful verification, redirect to login
          redirectTo: '/login',
        },
      });

    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="w-full max-w-lg">

        {/* Branding Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold" style={{ color: HERO_GOLD }}>
            ADINO POS
          </h1>
          <p className="text-gray-600 mt-2">Get started in minutes and revolutionize your retail business.</p>
        </div>

        {/* Registration Form */}
        <form
          onSubmit={handleRegister}
          className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl border border-gray-100 space-y-6"
        >
          <h2 className="text-2xl font-bold text-center text-gray-800 flex items-center justify-center gap-2 pb-4 border-b border-gray-100">
            <UserPlus className="w-6 h-6 text-gray-600" />
            Register Your Store
          </h2>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm" role="alert">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Store Details */}
            <div className="sm:col-span-2">
              <h3 className="text-base font-semibold text-gray-700 mb-2">Store Details</h3>
              <InputWithIcon
                Icon={Store}
                name="tenantName"
                placeholder="Store Name (e.g., Jane's Boutique)"
                form={form}
                handleChange={handleChange}
              />
            </div>

            {/* Owner Details */}
            <div className="sm:col-span-2">
              <h3 className="text-base font-semibold text-gray-700 mt-2 mb-2">Your Account</h3>
            </div>

            <InputWithIcon
              Icon={User}
              name="ownerName"
              placeholder="Your Full Name"
              form={form}
              handleChange={handleChange}
            />
            <InputWithIcon
              Icon={Phone}
              name="phoneNumber"
              placeholder="Phone Number (e.g. 08012345678)"
              type="tel"
              form={form}
              handleChange={handleChange}
            />
            <div className="sm:col-span-2">
              <InputWithIcon
                Icon={Mail}
                name="ownerEmail"
                placeholder="Email Address (used for login)"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center px-6 py-3 rounded-xl font-bold text-white text-lg transition duration-300 hover:opacity-90 shadow-md disabled:opacity-50"
            style={{ backgroundColor: HERO_GOLD }}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Creating your store...
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5 mr-2" />
                Register My Store
              </>
            )}
          </button>

          <div className="text-center text-sm text-gray-600 pt-4 border-t border-gray-100">
            Already have an account?{' '}
            <Link to="/login" className="font-bold hover:underline" style={{ color: HERO_GOLD }}>
              Log In
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TenantRegisterPage;
