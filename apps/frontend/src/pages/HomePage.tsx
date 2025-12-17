import React from 'react'
import { Link } from 'react-router-dom'
import {
  ShoppingCart,
  BarChart3,
  Users,
  Package,
  TrendingUp,
  Shield,
  ArrowRight,
  CheckCircle,
  Star,
  Play
} from 'lucide-react'
import heroImage from '../assets/images/logo4.png'

const HERO_GOLD = '#D4AF37'

const features = [
  { icon: ShoppingCart, title: 'Offline Mode', description: 'Continue selling when offline — syncs automatically when online.' },
  { icon: Package, title: 'Inventory', description: 'Real-time stock, low-stock alerts and cost tracking.' },
  { icon: Users, title: 'Multi-Store', description: 'Manage multiple outlets from a single dashboard.' },
  { icon: TrendingUp, title: 'Sales Tracking', description: 'Daily, weekly and monthly analytics for fast decisions.' },
  { icon: BarChart3, title: 'Dashboard', description: 'Clear visual reports and KPI widgets for managers.' }
]

const testimonials = [
  {
    name: 'Amina Owusu',
    role: 'Owner — Amina Grocers',
    image: "../src/assets/images/hero1.jpg",
    quote: 'ADINO POS kept our shop running during load shedding. Reliable and simple.'
  },
  {
    name: 'Kwame Mensah',
    role: 'Manager — Market Square',
    image: "../src/assets/images/kwame.png",
    quote: 'Reports are clear and exports make accountant review easy.'
  },
  {
    name: 'Zainab Bello',
    role: 'Founder — ZB Boutique',
    image: "../src/assets/images/love.png",
    quote: 'Beautiful receipts and fast checkout. My staff learned it in a day.'
  }
]

const pricingTiers = [
  {
    name: "Starter",
    price: "₦ 1,900 / month", // Changed currency to Naira (₦)
    description: "For small businesses just getting started.",
    bullets: [
      "1 POS Register",
      "Basic Inventory Management",
      "Offline Mode",
      "Up to 500 Transactions/Month",
    ],
    isFeatured: false,
  },
  {
    name: "Standard",
    price: "₦ 4,900 / month", // Changed currency to Naira (₦)
    description: "The best value for growing businesses.",
    bullets: [
      "3 POS Registers",
      "Advanced Inventory & Variants",
      "Detailed Sales Reports",
      "Customer Loyalty Program",
      "Unlimited Transactions",
    ],
    isFeatured: true,
  },
  {
    name: "Pro",
    price: "Custom Quote",
    description: "For multi-location stores and large retail chains.",
    bullets: [
      "Unlimited Registers",
      "Multi-Store Management",
      "Dedicated Account Manager",
      "API Access & Integrations",
      "Priority 24/7 Support",
    ],
    isFeatured: false,
  },
];

const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* Top nav */}
      <nav className="relative z-50 px-6 py-2 border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-24 h-10 rounded-lg flex items-center justify-center">
              <img src={heroImage} alt="Logo" className="w-24 h-10 text-black" />
            </div>
            {/* <span className="text-lg font-semibold tracking-tight">ADINO POS</span> */}
          </div>

          <div className="flex items-center gap-4">
            <Link to="/login" className="text-slate-700 hover:text-black">Sign in</Link>
            <Link to="/register" className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-[#D4AF37] text-white hover:opacity-95">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="py-16 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col-reverse lg:flex-row items-center gap-10 lg:gap-16">

            {/* Text Content */}
            <div className="w-full lg:w-1/2 pt-8 lg:-mt-24 lg:pt-0">

              {/* Main Heading */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight text-gray-900">
                {/* Use Tailwind's default text-color for better integration */}
                The <span className="text-[#D4AF37]">POS</span> That Never Stops Working.
              </h1>

              {/* Subtext */}
              <p className="mt-4 sm:mt-6 text-base sm:text-lg text-gray-600 max-w-xl">
                Offline-first point of sale built for African businesses — markets, boutiques, supermarkets and restaurants. Fast checkout, reliable syncing and simple reports even when the internet drops.
              </p>

              {/* CTA Buttons */}
              <div className="mt-8 flex flex-col sm:flex-row gap-4"> {/* Stack buttons vertically on mobile */}

                {/* Primary Button */}
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-3 px-8 py-3 rounded-xl bg-[#D4AF37] text-white font-semibold shadow-lg hover:bg-[#c2a032] transition duration-300 transform hover:scale-[1.02]"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Link>

                {/* Secondary Button */}
                <button className="inline-flex items-center justify-center gap-3 px-8 py-3 rounded-xl border-2 border-slate-300 text-gray-700 hover:text-[#D4AF37] hover:border-[#D4AF37] hover:bg-slate-50 transition duration-300">
                  <Play className="w-4 h-4" />
                  Book Demo
                </button>
              </div>

              {/* Stat Counters */}
              <div className="mt-10 grid grid-cols-2 gap-4 max-w-sm"> {/* Added mt-10 for more separation */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="text-sm text-gray-500 font-medium">Active Stores</div>
                  <div className="text-3xl font-bold text-gray-900 mt-1">1,200+</div>
                </div>
                <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                  <div className="text-sm text-gray-500 font-medium">Guaranteed Uptime</div>
                  <div className="text-3xl font-bold text-gray-900 mt-1">99.9%</div>
                </div>
              </div>
            </div>

            {/* Single Hero Image */}
            <div className="w-full lg:w-1/2 rounded-3xl overflow-hidden shadow-2xl">
              <img
                src="../src/assets/images/heroo.png"
                alt="Adino POS Interface with Cashier"
                // Adjusted height classes: h-80 for mobile, h-96 for medium, aspect-video for better image control
                className="w-full h-80 md:h-96 lg:h-auto object-cover object-center transform hover:scale-[1.02] transition duration-500 aspect-video lg:aspect-square"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="py-8 border-t border-gray-100 bg-white"> {/* Increased vertical padding */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"> {/* Increased max-width and adjusted padding */}

          {/* Title and Subtitle Block */}
          <div className="text-center mb-12">
            <h2 className="text-4xl font-extrabold text-gray-900 md:text-5xl">
              Features built for <span className="text-[#D4AF37]">real stores</span>
            </h2>
            <p className="text-lg text-gray-600 mt-4 max-w-3xl mx-auto">
              Everything you need to sell more and manage less — designed for African retail realities.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 lg:gap-8">
            {features.map((f, i) => (
              <div
                key={i}
                className="p-6 bg-white border border-gray-100 rounded-2xl shadow-lg hover:shadow-xl transition duration-300 transform hover:translate-y-[-2px]" // Enhanced card style
              >
                {/* Icon Container */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: HERO_GOLD, color: 'white' }} // Reversed colors for better contrast and appeal
                >
                  {/* Removed the inline style for color from the icon itself */}
                  <f.icon className="w-6 h-6 text-white" />
                </div>

                {/* Feature Text */}
                <h4 className="text-xl font-bold text-gray-900 mb-2">{f.title}</h4>
                <p className="text-base text-gray-600">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Real-store photography + testimonial */}
      <section className="py-20 bg-gray-50"> {/* Increased vertical padding, kept light background */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"> {/* Increased max-width and adjusted padding */}

          {/* Title for the entire section */}
          <div className="text-center mb-12">
            <h2 className="text-4xl font-extrabold text-gray-900">
              Trusted by Businesses <span className="text-[#D4AF37]">Across Africa</span>
            </h2>
            <p className="text-lg text-gray-600 mt-2">See how our POS performs in real-world retail settings.</p>
          </div>

          {/* Main Grid: Gallery (2/3) and Testimonial (1/3) */}
          <div className="grid lg:grid-cols-3 gap-10 items-start">

            {/* Image Gallery (Takes 2/3 space on large screens) */}
            <div className="lg:col-span-2">
              <div className="grid grid-cols-2 gap-4 md:gap-6"> {/* Increased gap for better spacing */}

                {/* Image 1: Tall/Feature Image */}
                <img
                  src="../src/assets/images/hero2.jpg"
                  alt="Market"
                  className="w-full h-80 md:h-96 object-cover rounded-2xl shadow-xl transform hover:scale-[1.01] transition duration-300" // Larger, deeper shadow, hover effect
                />

                {/* Grid for the remaining 3 images */}
                <div className="grid grid-cols-1 gap-4 md:gap-6">
                  <img
                    src="../src/assets/images/kwame.png"
                    alt="Restaurant"
                    className="w-full h-60 md:h-48 object-cover rounded-2xl shadow-lg transform hover:scale-[1.01] transition duration-300" // Half-height to fit next two
                  />

                  {/* Nested grid for the last two side-by-side */}
                  <div className="grid grid-cols-2 gap-4 md:gap-6">
                    <img
                      src="../src/assets/images/hero4.jpg"
                      alt="Supermarket"
                      className="w-full h-36 md:h-44 object-cover rounded-2xl shadow-lg transform hover:scale-[1.01] transition duration-300"
                    />
                    <img
                      src="../src/assets/images/hero3.jpg"
                      alt="Shop owner"
                      className="w-full h-36 md:h-44 object-cover rounded-2xl shadow-lg transform hover:scale-[1.01] transition duration-300"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Testimonial Sidebar (Takes 1/3 space on large screens) */}
            <aside className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-100"> {/* Enhanced card look */}
              <h3 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4 border-gray-100">
                <span className="text-[#D4AF37]">Testimonials</span>: What store owners say
              </h3>
              <div className="space-y-6"> {/* Increased spacing between testimonials */}
                {testimonials.map((t, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 border border-gray-50 rounded-xl bg-white transition hover:bg-yellow-50">
                    {/* Avatar */}
                    <img
                      src={t.image}
                      alt={t.name}
                      className="w-14 h-14 rounded-full object-cover border-2 border-[#D4AF37]" // Larger avatar with a gold border
                    />
                    <div>
                      {/* Quote */}
                      <div className="mt-1 text-gray-800 text-base italic leading-relaxed">“{t.quote}”</div>
                      {/* Name and Role */}
                      <div className="mt-3 font-semibold text-gray-900">{t.name}</div>
                      <div className="text-sm text-gray-500">{t.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </aside>

          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="py-24 bg-white"> {/* Increased vertical padding */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

          {/* Title and Subtitle Block */}
          <h2 className="text-4xl font-extrabold text-gray-900 md:text-5xl">
            Simple pricing for busy <span className="text-[#D4AF37]">businesses</span>
          </h2>
          <p className="text-lg text-gray-600 mt-4 max-w-2xl mx-auto">
            No surprises. Transparent billing and plans that grow with you.
          </p>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
            {pricingTiers.map((tier, i) => {
              const isFeatured = tier.isFeatured || i === 1; // Use isFeatured prop or index 1

              return (
                <div
                  key={i}
                  className={`
                  p-8 rounded-3xl transition duration-300 shadow-xl flex flex-col h-full
                  ${isFeatured
                      ? 'border-2 border-[#D4AF37] bg-white transform scale-[1.05]' // Featured style
                      : 'border border-gray-200 bg-white hover:shadow-lg' // Default style
                    }
                `}
                >
                  {/* Plan Name */}
                  <div className="text-sm font-semibold uppercase tracking-widest mb-2"
                    style={{ color: isFeatured ? HERO_GOLD : '#4b5563' }}>
                    {tier.name}
                  </div>

                  {/* Price */}
                  <div className="text-4xl font-extrabold text-gray-900 my-3">
                    {tier.price.includes('/') ? (
                      <>
                        {tier.price.split(' / ')[0]}
                        <span className="text-xl font-medium text-gray-500"> / {tier.price.split(' / ')[1]}</span>
                      </>
                    ) : (
                      tier.price
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-6">{tier.description}</p>

                  {/* Features List */}
                  <ul className="text-base text-gray-700 mb-8 space-y-3 flex-grow">
                    {tier.bullets.map((b, k) => (
                      <li key={k} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <div>
                    <button
                      className={`w-full px-6 py-3 rounded-xl font-bold transition duration-300 text-lg
                      ${isFeatured
                          ? 'bg-[#D4AF37] text-white hover:bg-[#c2a032] shadow-md' // Featured button
                          : 'border-2 border-gray-300 text-gray-700 hover:border-[#D4AF37] hover:text-[#D4AF37]' // Default button
                        }
                    `}
                    >
                      {isFeatured ? 'Start Your Free Trial' : 'Choose Plan'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Security & footer CTA */}
      <section className="py-12 bg-[#0f172a] text-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-2xl font-semibold">Secure, reliable and built for Africa</h3>
            <p className="text-slate-300 mt-2">PCI-ready integrations, automatic backups and offline resilience to keep your business running.</p>
          </div>
          <div className="flex gap-3">
            <Link to="/register" className="inline-flex items-center px-6 py-3 bg-[#D4AF37] text-black rounded-md font-semibold">Start Free</Link>
            <button className="px-6 py-3 border border-slate-600 rounded-md text-slate-200">Contact Sales</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: HERO_GOLD }}>
              <ShoppingCart className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="font-semibold">ADINO POS</div>
              <div className="text-sm text-slate-500">Offline-first POS for African businesses</div>
            </div>
          </div>

          <div className="text-sm text-slate-500">© {new Date().getFullYear()} ADINO POS. All rights reserved.</div>
        </div>
      </footer>
    </div>
  )
}

export default HomePage