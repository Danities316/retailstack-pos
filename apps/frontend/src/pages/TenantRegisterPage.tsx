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
    try {
      // Mock API call based on your structure
      console.log("Attempting registration with:", form);

      // In a real app, replace with:
      // const response = await fetch(`${baseURL}/tenant/register`, { ... });
      // const data = await response.json();

      // Mock success response
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSuccess("Registration successful! Redirecting to login...");

      setTimeout(() => {
        navigate("/login");
      }, 2000);

    } catch (err: any) {
      setError(err.message || "Registration failed. Please check your details.");
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

        {/* Registration Form Card */}
        <form
          onSubmit={handleRegister}
          className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl border border-gray-100 space-y-6"
        >
          <h2 className="text-2xl font-bold text-center text-gray-800 flex items-center justify-center gap-2 pb-4 border-b border-gray-100">
            <UserPlus className="w-6 h-6 text-gray-600" />
            Tenant Setup
          </h2>

          {/* Error and Success Messages */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 text-green-600 rounded-lg text-sm" role="alert">
              {success} <Link to="/login" className="font-bold hover:underline">Proceed to Login</Link> <ArrowRight className="w-4 h-4 inline ml-1" />
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
                form={form} // Pass form state
                handleChange={handleChange} // Pass handler
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
      </div>
    </div>
  );
};