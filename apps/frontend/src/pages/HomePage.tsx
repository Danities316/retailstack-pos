import React, { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  ArrowRight,
  CheckCircle,
  Menu,
  MessageCircle,
  ShieldCheck,
  X,
  AlertTriangle,
  TrendingUp,
  Users,
  WifiOff,
  ChevronDown,
} from 'lucide-react'
import heroImage from '../assets/images/logo4.png'
import heroImage2 from '../assets/images/hero1.jpg'
import heroImage3 from '../assets/images/kwame.png'
import heroImage4 from '../assets/images/love.png'
import heroImage5 from '../assets/images/heroo.png'

// ─── Brand tokens ────────────────────────────────────────────────────────────
const GOLD = '#C9972C'
const GOLD_LIGHT = '#FEF3C7'
const GOLD_MID = '#F59E0B'
const NAVY = '#0f172a'
const NAVY_MID = '#1e293b'
const SLATE = '#475569'
const OFF_WHITE = '#FAFAF8'
const BRAND = 'ADINO'
const WHATSAPP_NUMBER = '23407035545177'
const WHATSAPP_CTA_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=Hi%2C%20I%20want%20to%20know%20more%20about%20Adino%20for%20my%20shop`

// ─── Copy data ────────────────────────────────────────────────────────────────

const trustSignals = [
  'Works without internet — even during NEPA and network outages',
  'Cash, transfer, POS card — every payment type recorded',
  'Your records stay safe even if your phone is lost or damaged',
  'No IT person needed — most shops start in under 15 minutes',
  'Used by traders in Lagos, Kano, Onitsha, Abuja, Ibadan, Port Harcourt',
]

const painReliefs = [
  {
    icon: TrendingUp,
    pain: 'The money never balances at end of day',
    relief:
      'See the exact amount that entered your shop — sale by sale, cashier by cashier. No estimation. No guessing.',
  },
  {
    icon: Users,
    pain: "Your cashier's count and your count never agree",
    relief:
      "Every sale is recorded with the cashier's name, time, items sold, and payment method. If there's a gap, you'll see it.",
  },
  {
    icon: ShieldCheck,
    pain: 'A credit customer "forgets" what they owe you',
    relief:
      'Owe Me tracks every customer who takes goods on credit. You see the balance. They see the receipt. The awkwardness is gone.',
  },
  {
    icon: AlertTriangle,
    pain: 'You find out products finished only when a customer asks',
    relief:
      'You get a warning before the shelf is empty — not after the customer has already walked to the next shop.',
  },
  {
    icon: ShieldCheck,
    pain: 'No records when you go to the bank for a loan',
    relief:
      'Every sale builds your business record. Six months of Adino is the only formal proof of income most Nigerian traders will ever have.',
  },
]

const situations = [
  {
    situation: 'NEPA takes light at 3pm, network drops at 5pm',
    resolution:
      'Your cashier keeps selling. Adino stores every sale on the device and syncs the moment internet returns. Not one transaction is lost.',
  },
  {
    situation: 'Customer swears they paid in full. Your cashier says otherwise.',
    resolution:
      "The receipt exists. The timestamp exists. The cashier's name is on it. No argument needed.",
  },
  {
    situation: 'You leave the shop and cannot see what is happening',
    resolution:
      'Check your phone from anywhere. Every sale, every cashier session, every payment — visible in real time.',
  },
  {
    situation: 'A customer wants to pay half cash, half transfer',
    resolution:
      'Split payments are handled in one sale. Cash, transfer, and card — all in one clean record.',
  },
  {
    situation: 'You want a business loan but have nothing to show the bank',
    resolution:
      'Export your transaction history. You have months of clean records your bank can read — built automatically, every trading day.',
  },
  {
    situation: 'Your cashier is new and has never used a POS before',
    resolution:
      'Most cashiers are selling on their own within 20 minutes. No training day. No IT setup.',
  },
]

const testimonials = [
  {
    name: 'Emeka Okafor',
    role: 'Provision Store Owner — Onitsha Main Market',
    image: heroImage3,
    before:
      "My cashier would hand me \u20a692,000 at closing. I'd count \u20a678,000. Every week there was a gap and I had no proof.",
    after:
      'Now I see every sale on my phone before I even get to the till. Three months in, the losses stopped.',
    highlight: 'Losses stopped in 3 months',
  },
  {
    name: 'Amina Bello',
    role: 'Cosmetics Shop Owner — Kano',
    image: heroImage2,
    before:
      'One customer owed me for eight months. I was too embarrassed to confront her because I had nothing on paper.',
    after:
      'Owe Me showed me every balance. I sent her the total on WhatsApp. She paid the next day.',
    highlight: '8-month debt collected in 1 day',
  },
  {
    name: 'Adaeze Johnson',
    role: 'Boutique Owner — Lekki, Lagos',
    image: heroImage4,
    before:
      'I left my assistant in charge for a weekend and came back nervous about what had happened.',
    after:
      'Monday morning I could see exactly what was sold, when, and who sold it. That feeling of seeing without being there — that changed everything.',
    highlight: 'Full weekend visibility from her phone',
  },
]

const pricingTiers = [
  {
    name: 'Solo Store',
    nairaPerMonth: '\u20a69,900',
    nairaPerDay: 'About \u20a6330/day — less than a plate of jollof rice',
    forWho: 'One shop, one or two cashiers, one owner who wants to see everything',
    bullets: [
      'Record every sale with cashier name and time',
      'Know what every cashier sold each day',
      'Track who owes you and how much (Owe Me)',
      'Get alerted when products are about to finish',
      'Build your business records automatically',
      'Works without internet — syncs when back online',
    ],
    bestFor: 'Provision stores, pharmacies, boutiques, cosmetics shops, mini marts',
    isFeatured: false,
    cta: 'Start Free — 30 Days',
  },
  {
    name: 'Growing Business',
    nairaPerMonth: '\u20a624,900',
    nairaPerDay: 'About \u20a6830/day — less than fuel on a bad day',
    forWho: 'Shops with 3 or more cashiers, busy weekends, faster stock movement',
    bullets: [
      'Everything in Solo Store',
      'Up to 3 cashier terminals',
      'Track product variants — size, colour, type',
      'Full shift reports for every staff member',
      'Export records for your accountant or bank',
      'Manage multiple product categories clearly',
    ],
    bestFor: 'Supermarkets, large pharmacies, fashion boutiques, multi-staff stores',
    isFeatured: true,
    cta: 'Start Free — 30 Days',
  },
]

const faqs = [
  {
    q: 'What if my phone gets stolen or damaged?',
    a: 'Your records are stored on our servers, not just your phone. The moment you log in on any new device, everything is there — every sale, every cashier record, every customer balance.',
  },
  {
    q: 'Will FIRS or the government see my sales records?',
    a: 'No. Adino is a private business tool. Your records belong to you and are not shared with any government agency. Many traders use Adino specifically because it gives them records only when they choose to show them — for a bank loan or a business audit.',
  },
  {
    q: 'What if I have no internet in my shop?',
    a: 'Adino was built for this. Your cashier sells normally during network outages. Every sale is stored on the device. When internet returns — even hours later — everything syncs automatically. No sale is ever lost.',
  },
  {
    q: 'Do I need to pay someone to set it up for me?',
    a: 'No. Most shop owners finish setup on their own in 15-20 minutes. If you get stuck at any point, message us on WhatsApp and a real person will walk you through it — same day, during trading hours.',
  },
]

const howItWorks = [
  {
    step: '01',
    title: 'Add your products once',
    desc: 'Enter your product names and prices. You can add 10 products or 500 — Adino handles both. Import from a spreadsheet if you already have a list.',
  },
  {
    step: '02',
    title: 'Your cashier starts selling',
    desc: "Search, tap, confirm payment. A sale takes under 15 seconds. Every transaction is recorded with the cashier's name, time, and payment method — automatically.",
  },
  {
    step: '03',
    title: 'You see everything',
    desc: 'Check your daily total from anywhere. See what each cashier sold. Know who owes you. Get alerted when stock is low. Your shop, in your pocket.',
  },
]

// ─── Intersection observer hook ───────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          obs.disconnect()
        }
      },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

function FadeIn({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const { ref, inView } = useInView()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 12)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (isAuthenticated && user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ backgroundColor: OFF_WHITE }}
      >
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full text-center border border-amber-100">
          <div
            className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6"
            style={{ backgroundColor: GOLD_LIGHT }}
          >
            <CheckCircle className="w-10 h-10" style={{ color: GOLD }} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Welcome back, {user.name || user.email}
          </h1>
          <p className="text-slate-500 mb-8">Your shop records are ready.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full text-white px-6 py-3 rounded-xl font-bold transition-opacity hover:opacity-90"
            style={{ backgroundColor: GOLD }}
          >
            Open Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen text-slate-800"
      style={{ backgroundColor: OFF_WHITE, fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Playfair+Display:wght@700;800&display=swap');

        .adino-btn-gold {
          background-color: ${GOLD};
          color: #fff;
          font-weight: 700;
          border-radius: 10px;
          padding: 14px 28px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background-color 0.2s, transform 0.15s;
          text-decoration: none;
          font-size: 15px;
          line-height: 1;
          border: none;
          cursor: pointer;
        }
        .adino-btn-gold:hover { background-color: #b5821e; transform: translateY(-1px); }

        .adino-btn-outline {
          background: transparent;
          color: ${NAVY};
          font-weight: 600;
          border-radius: 10px;
          padding: 13px 26px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1.5px solid #cbd5e1;
          transition: border-color 0.2s, transform 0.15s;
          text-decoration: none;
          font-size: 15px;
          line-height: 1;
          cursor: pointer;
          background-color: transparent;
        }
        .adino-btn-outline:hover { border-color: ${GOLD}; color: ${GOLD}; transform: translateY(-1px); }

        .adino-display { font-family: 'Playfair Display', Georgia, serif; }

        .adino-pain-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 28px;
          transition: box-shadow 0.2s, transform 0.2s;
          height: 100%;
        }
        .adino-pain-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.08); transform: translateY(-2px); }

        .adino-situation-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          padding: 24px;
          transition: background 0.2s;
        }
        .adino-situation-card:hover { background: rgba(255,255,255,0.08); }

        .adino-testimonial-card {
          background: white;
          border-radius: 20px;
          padding: 32px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 4px 24px rgba(0,0,0,0.05);
          height: 100%;
        }

        .adino-faq-btn {
          width: 100%;
          text-align: left;
          padding: 20px 0;
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          font-family: inherit;
        }

        .adino-step-number {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 56px;
          font-weight: 800;
          color: ${GOLD_LIGHT};
          line-height: 1;
          user-select: none;
        }

        @keyframes adino-fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .adino-h1 { animation: adino-fadeUp 0.6s ease 0.1s both; }
        .adino-h2 { animation: adino-fadeUp 0.6s ease 0.25s both; }
        .adino-h3 { animation: adino-fadeUp 0.6s ease 0.4s both; }
        .adino-h4 { animation: adino-fadeUp 0.6s ease 0.55s both; }
        .adino-h5 { animation: adino-fadeUp 0.6s ease 0.7s both; }

        @media (max-width: 900px) {
          .adino-hero-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .adino-hero-img { order: -1; }
          .adino-hero-headline { font-size: 34px !important; }
          .adino-owe-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .adino-desktop-only { display: none !important; }
        }
        @media (min-width: 901px) {
          .adino-mobile-hamburger { display: none !important; }
          .adino-desktop-nav { display: flex !important; }
        }
        @media (max-width: 900px) {
          .adino-desktop-nav { display: none !important; }
          .adino-mobile-hamburger { display: flex !important; }
        }
      `}</style>

      {/* ════ NAV ════ */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          transition: 'background 0.3s, box-shadow 0.3s',
          background: isScrolled ? 'rgba(250,250,248,0.97)' : 'transparent',
          backdropFilter: isScrolled ? 'blur(12px)' : 'none',
          borderBottom: isScrolled ? '1px solid #e2e8f0' : '1px solid transparent',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '0 24px',
            height: 72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={heroImage} alt={`${BRAND} Logo`} style={{ height: 38, objectFit: 'contain' }} />
            <span
              className="adino-desktop-only"
              style={{ fontSize: 12, color: SLATE, fontWeight: 500, letterSpacing: '0.02em' }}
            >
              Built for Nigerian shops
            </span>
          </div>

          <div
            className="adino-desktop-nav"
            style={{ alignItems: 'center', gap: 24 }}
          >
            <a
              href={WHATSAPP_CTA_LINK}
              target="_blank"
              rel="noreferrer"
              style={{
                color: SLATE,
                fontWeight: 500,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                textDecoration: 'none',
              }}
            >
              <MessageCircle style={{ width: 15, height: 15 }} />
              WhatsApp
            </a>
            <Link
              to="/login"
              style={{ color: SLATE, fontWeight: 500, fontSize: 14, textDecoration: 'none' }}
            >
              Sign In
            </Link>
            <Link
              to="/onboard"
              className="adino-btn-gold"
              style={{ padding: '10px 22px', fontSize: 14 }}
            >
              Start Free — 30 Days
            </Link>
          </div>

          <button
            className="adino-mobile-hamburger"
            style={{
              padding: 8,
              background: 'none',
              border: '1.5px solid #e2e8f0',
              borderRadius: 8,
              cursor: 'pointer',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => setIsMobileMenuOpen((p) => !p)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X style={{ width: 20, height: 20 }} />
            ) : (
              <Menu style={{ width: 20, height: 20 }} />
            )}
          </button>
        </div>

        {isMobileMenuOpen && (
          <div
            style={{
              background: 'white',
              borderTop: '1px solid #e2e8f0',
              padding: '16px 24px 24px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Link
                to="/login"
                style={{ color: SLATE, fontWeight: 500, textDecoration: 'none' }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Sign In
              </Link>
              <a
                href={WHATSAPP_CTA_LINK}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: SLATE,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  textDecoration: 'none',
                }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <MessageCircle style={{ width: 16, height: 16 }} />
                Chat on WhatsApp
              </a>
              <Link
                to="/onboard"
                className="adino-btn-gold"
                style={{ justifyContent: 'center' }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Start Free — 30 Days
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ════ HERO ════ */}
      <header style={{ padding: '72px 24px 80px', maxWidth: 1200, margin: '0 auto' }}>
        <div className="adino-hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          {/* Copy */}
          <div>
            <div
              className="adino-h1"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: GOLD_LIGHT,
                borderRadius: 999,
                padding: '7px 16px',
                marginBottom: 24,
              }}
            >
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: GOLD }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>
                30-day free trial · No card needed
              </span>
            </div>

            <h1
              className="adino-display adino-h2 adino-hero-headline"
              style={{ fontSize: 52, lineHeight: 1.15, fontWeight: 800, color: NAVY, margin: '0 0 20px' }}
            >
              At the end of today, will you know exactly what your shop{' '}
              <span style={{ color: GOLD }}>made?</span>
            </h1>

            <div className="adino-h3">
              <p style={{ fontSize: 17, lineHeight: 1.7, color: SLATE, maxWidth: 520, margin: '0 0 12px' }}>
                Most Nigerian shop owners close their till and still cannot tell you the exact number.
                Their cashier gives one figure. The money says something different.
              </p>
              <p style={{ fontSize: 17, lineHeight: 1.7, color: SLATE, maxWidth: 520, margin: '0 0 32px' }}>
                Adino records every sale, every cashier, every naira — even with no internet. So
                tonight, before you count the cash, you already know.
              </p>
            </div>

            <div
              className="adino-h4"
              style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}
            >
              <Link to="/onboard" className="adino-btn-gold">
                Start Free — First 30 Days on Us
                <ArrowRight style={{ width: 16, height: 16 }} />
              </Link>
              <a
                href={WHATSAPP_CTA_LINK}
                target="_blank"
                rel="noreferrer"
                className="adino-btn-outline"
              >
                <MessageCircle style={{ width: 15, height: 15 }} />
                Talk to us on WhatsApp first
              </a>
            </div>

            <div
              className="adino-h5"
              style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}
            >
              {['1,200+ shops across Nigeria', 'Lagos · Kano · Onitsha · Abuja · Ibadan'].map(
                (tag) => (
                  <span
                    key={tag}
                    style={{
                      background: '#f1f5f9',
                      borderRadius: 999,
                      padding: '5px 14px',
                      fontSize: 13,
                      fontWeight: 500,
                      color: SLATE,
                    }}
                  >
                    {tag}
                  </span>
                )
              )}
            </div>
          </div>

          {/* Hero image */}
          <div className="adino-hero-img adino-h2" style={{ position: 'relative' }}>
            <div
              style={{
                borderRadius: 24,
                overflow: 'hidden',
                boxShadow: '0 32px 80px rgba(15,23,42,0.18)',
              }}
            >
              <img
                src={heroImage5}
                alt="Adino POS being used in a Nigerian shop"
                style={{ width: '100%', height: 440, objectFit: 'cover', display: 'block' }}
              />
            </div>
            {/* Offline badge */}
            <div
              style={{
                position: 'absolute',
                top: 20,
                left: 20,
                background: 'white',
                borderRadius: 12,
                padding: '10px 16px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
              <WifiOff style={{ width: 14, height: 14, color: '#64748b' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: NAVY_MID }}>
                Selling Offline — 7 sales recorded
              </span>
            </div>
            {/* Session total */}
            <div
              style={{
                position: 'absolute',
                bottom: 24,
                right: 20,
                background: NAVY,
                color: 'white',
                borderRadius: 14,
                padding: '14px 20px',
                boxShadow: '0 8px 24px rgba(15,23,42,0.3)',
              }}
            >
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginBottom: 2 }}>
                Today's total
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'white', fontFamily: 'monospace' }}>
                ₦124,500
              </div>
              <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 600, marginTop: 2 }}>
                ↑ 18 sales this shift
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ════ TRUST BAR ════ */}
      <section style={{ background: NAVY, padding: '20px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              gap: 0,
              justifyContent: 'center',
              flexWrap: 'wrap',
              rowGap: 10,
            }}
          >
            {trustSignals.map((item, i) => (
              <React.Fragment key={item}>
                <span
                  style={{ fontSize: 13, color: '#cbd5e1', padding: '4px 18px', fontWeight: 400 }}
                >
                  {item}
                </span>
                {i < trustSignals.length - 1 && (
                  <span style={{ color: GOLD, opacity: 0.5, fontSize: 13, padding: '4px 0' }}>·</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ════ HOW IT WORKS ════ */}
      <section style={{ padding: '88px 24px', background: 'white' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: GOLD,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                Simple by design
              </span>
              <h2
                className="adino-display"
                style={{ fontSize: 38, fontWeight: 800, color: NAVY, margin: '12px 0 0' }}
              >
                Your shop running on Adino
              </h2>
            </div>
          </FadeIn>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 48,
            }}
          >
            {howItWorks.map((step, i) => (
              <FadeIn key={step.step} delay={i * 120}>
                <div>
                  <div className="adino-step-number">{step.step}</div>
                  <h3
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: NAVY,
                      margin: '-8px 0 12px',
                    }}
                  >
                    {step.title}
                  </h3>
                  <p style={{ fontSize: 15, lineHeight: 1.7, color: SLATE, margin: 0 }}>
                    {step.desc}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ════ PAIN → RELIEF ════ */}
      <section style={{ padding: '88px 24px', background: OFF_WHITE }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <FadeIn>
            <div style={{ marginBottom: 56 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: GOLD,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                Pain → Relief
              </span>
              <h2
                className="adino-display"
                style={{
                  fontSize: 38,
                  fontWeight: 800,
                  color: NAVY,
                  margin: '12px 0 16px',
                  maxWidth: 560,
                }}
              >
                The exact problems Adino was built to solve
              </h2>
              <p style={{ fontSize: 16, color: SLATE, maxWidth: 560, lineHeight: 1.7, margin: 0 }}>
                These are not software features. These are the daily frustrations that cost Nigerian
                shop owners money every single week.
              </p>
            </div>
          </FadeIn>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 20,
            }}
          >
            {painReliefs.map((item, i) => (
              <FadeIn key={item.pain} delay={i * 80}>
                <div className="adino-pain-card">
                  <div style={{ marginBottom: 16 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#dc2626',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      The problem
                    </span>
                    <p
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: NAVY,
                        margin: '6px 0 0',
                        lineHeight: 1.4,
                      }}
                    >
                      {item.pain}
                    </p>
                  </div>
                  <div
                    style={{
                      width: 32,
                      height: 2,
                      background: GOLD,
                      borderRadius: 2,
                      margin: '0 0 16px',
                    }}
                  />
                  <div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#16a34a',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      What Adino does
                    </span>
                    <p
                      style={{ fontSize: 15, color: SLATE, margin: '6px 0 0', lineHeight: 1.6 }}
                    >
                      {item.relief}
                    </p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ════ OWE ME SPOTLIGHT ════ */}
      <section style={{ padding: '88px 24px', background: 'white' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div
            className="adino-owe-grid"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}
          >
            <FadeIn>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: GOLD,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                The feature no other POS has
              </span>
              <h2
                className="adino-display"
                style={{
                  fontSize: 38,
                  fontWeight: 800,
                  color: NAVY,
                  margin: '12px 0 20px',
                  lineHeight: 1.2,
                }}
              >
                The awkward conversation you will never have to have again
              </h2>
              <p style={{ fontSize: 16, lineHeight: 1.7, color: SLATE, marginBottom: 16 }}>
                You know the situation. A customer takes goods on credit. Days pass. Weeks pass. You
                are too embarrassed to ask again because you have nothing on paper — just a number
                in your head.
              </p>
              <p style={{ fontSize: 16, lineHeight: 1.7, color: SLATE, marginBottom: 32 }}>
                <strong style={{ color: NAVY }}>Owe Me</strong> records every credit sale with the
                customer's name, amount, date, and what was taken. When it is time to collect, you
                send them the record on WhatsApp. There is nothing to dispute.
              </p>
              {[
                'Track exactly who owes you and how much',
                'Send the balance to your customer on WhatsApp',
                'Know how long each debt has been outstanding',
                'Never lose a credit record — even offline',
              ].map((pt) => (
                <div
                  key={pt}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <CheckCircle
                    style={{
                      width: 18,
                      height: 18,
                      color: GOLD,
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  />
                  <span style={{ fontSize: 15, color: SLATE }}>{pt}</span>
                </div>
              ))}
            </FadeIn>

            {/* Owe Me UI mockup */}
            <FadeIn delay={150}>
              <div
                style={{
                  background: NAVY,
                  borderRadius: 24,
                  padding: 32,
                  color: 'white',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: -40,
                    right: -40,
                    width: 180,
                    height: 180,
                    borderRadius: '50%',
                    background: GOLD,
                    opacity: 0.08,
                    pointerEvents: 'none',
                  }}
                />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div
                    style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, marginBottom: 20 }}
                  >
                    Owe Me — Active Balances
                  </div>
                  {[
                    {
                      name: 'Mama Kemi',
                      amount: '₦12,500',
                      days: '14 days',
                      items: 'Rice, Indomie, Milo',
                    },
                    {
                      name: 'Chukwu Emeka',
                      amount: '₦8,200',
                      days: '6 days',
                      items: 'Toiletries, soft drinks',
                    },
                    {
                      name: 'Fatima Hassan',
                      amount: '₦3,700',
                      days: '2 days',
                      items: 'Bread, eggs, butter',
                    },
                  ].map((debtor, i) => (
                    <div
                      key={debtor.name}
                      style={{
                        background: 'rgba(255,255,255,0.07)',
                        borderRadius: 12,
                        padding: '14px 16px',
                        marginBottom: i < 2 ? 10 : 0,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{debtor.name}</span>
                        <span style={{ fontWeight: 800, fontSize: 16, color: GOLD_MID }}>
                          {debtor.amount}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>{debtor.items}</span>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>{debtor.days}</span>
                      </div>
                    </div>
                  ))}
                  <div
                    style={{
                      marginTop: 20,
                      padding: '12px 16px',
                      background: 'rgba(201,151,44,0.15)',
                      borderRadius: 10,
                      border: '1px solid rgba(201,151,44,0.3)',
                    }}
                  >
                    <div
                      style={{ fontSize: 12, color: GOLD_MID, fontWeight: 600, marginBottom: 2 }}
                    >
                      Total outstanding
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'white' }}>₦24,400</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                      Across 3 customers · This month
                    </div>
                  </div>
                  <button
                    style={{
                      marginTop: 16,
                      width: '100%',
                      padding: '12px',
                      background: GOLD,
                      color: 'white',
                      border: 'none',
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      fontFamily: 'inherit',
                    }}
                  >
                    <MessageCircle style={{ width: 15, height: 15 }} />
                    Send balance to customer on WhatsApp
                  </button>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ════ SITUATIONS — dark section ════ */}
      <section
        style={{ background: NAVY_MID, padding: '88px 24px', position: 'relative', overflow: 'hidden' }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
            backgroundSize: '160px',
            pointerEvents: 'none',
          }}
        />
        <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <FadeIn>
            <div style={{ marginBottom: 56 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: GOLD,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                Built for your shop floor
              </span>
              <h2
                className="adino-display"
                style={{
                  fontSize: 38,
                  fontWeight: 800,
                  color: 'white',
                  margin: '12px 0 16px',
                  maxWidth: 600,
                }}
              >
                We built Adino for the shop floor, not the boardroom.
              </h2>
              <p
                style={{
                  fontSize: 16,
                  color: '#94a3b8',
                  maxWidth: 560,
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                Here is what Adino handles that other software ignores.
              </p>
            </div>
          </FadeIn>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 16,
            }}
          >
            {situations.map((item, i) => (
              <FadeIn key={item.situation} delay={i * 60}>
                <div className="adino-situation-card">
                  <p
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: GOLD_MID,
                      marginBottom: 10,
                      lineHeight: 1.4,
                      margin: '0 0 10px',
                    }}
                  >
                    {item.situation}
                  </p>
                  <p
                    style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.65, margin: 0 }}
                  >
                    {item.resolution}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ════ TESTIMONIALS ════ */}
      <section style={{ padding: '88px 24px', background: OFF_WHITE }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: GOLD,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                Real traders, real outcomes
              </span>
              <h2
                className="adino-display"
                style={{ fontSize: 38, fontWeight: 800, color: NAVY, margin: '12px 0 0' }}
              >
                What shop owners actually say
              </h2>
            </div>
          </FadeIn>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 24,
            }}
          >
            {testimonials.map((t, i) => (
              <FadeIn key={t.name} delay={i * 100}>
                <div className="adino-testimonial-card">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      marginBottom: 24,
                    }}
                  >
                    <img
                      src={t.image}
                      alt={t.name}
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: `2px solid ${GOLD}`,
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, color: NAVY, fontSize: 15 }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: SLATE, marginTop: 2 }}>{t.role}</div>
                    </div>
                  </div>

                  <div
                    style={{
                      background: GOLD_LIGHT,
                      borderRadius: 999,
                      padding: '5px 14px',
                      display: 'inline-block',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#92400e',
                      marginBottom: 20,
                    }}
                  >
                    {t.highlight}
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#dc2626',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      Before
                    </span>
                    <p
                      style={{
                        fontSize: 14,
                        color: SLATE,
                        lineHeight: 1.6,
                        margin: '5px 0 0',
                        fontStyle: 'italic',
                      }}
                    >
                      "{t.before}"
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#16a34a',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      After Adino
                    </span>
                    <p
                      style={{
                        fontSize: 14,
                        color: SLATE,
                        lineHeight: 1.6,
                        margin: '5px 0 0',
                      }}
                    >
                      {t.after}
                    </p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ════ PRICING ════ */}
      <section style={{ padding: '88px 24px', background: 'white' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <FadeIn>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: GOLD,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              No surprises
            </span>
            <h2
              className="adino-display"
              style={{ fontSize: 38, fontWeight: 800, color: NAVY, margin: '12px 0 16px' }}
            >
              Less than the cost of one unrecorded sale
            </h2>
            <p
              style={{
                fontSize: 16,
                color: SLATE,
                maxWidth: 540,
                margin: '0 auto 48px',
                lineHeight: 1.7,
              }}
            >
              A single cashier shortfall. One credit customer who disappears. One product that
              finishes before you could restock. Any one of these costs more than what Adino costs
              per month.
            </p>
          </FadeIn>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 24,
              textAlign: 'left',
            }}
          >
            {pricingTiers.map((tier, i) => (
              <FadeIn key={tier.name} delay={i * 100}>
                <div
                  style={{
                    borderRadius: 24,
                    padding: 36,
                    border: tier.isFeatured ? `2px solid ${GOLD}` : '1.5px solid #e2e8f0',
                    background: tier.isFeatured ? NAVY : 'white',
                    position: 'relative',
                    boxShadow: tier.isFeatured
                      ? '0 24px 60px rgba(15,23,42,0.2)'
                      : '0 4px 16px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                  }}
                >
                  {tier.isFeatured && (
                    <div
                      style={{
                        position: 'absolute',
                        top: -14,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: GOLD,
                        color: 'white',
                        borderRadius: 999,
                        padding: '4px 18px',
                        fontSize: 12,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Most popular
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: tier.isFeatured ? GOLD_MID : GOLD,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      marginBottom: 8,
                    }}
                  >
                    {tier.name}
                  </div>
                  <div
                    style={{
                      fontSize: 40,
                      fontWeight: 800,
                      color: tier.isFeatured ? 'white' : NAVY,
                      marginBottom: 4,
                    }}
                  >
                    {tier.nairaPerMonth}
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 500,
                        color: tier.isFeatured ? '#94a3b8' : SLATE,
                      }}
                    >
                      /month
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: tier.isFeatured ? GOLD_MID : GOLD,
                      fontWeight: 600,
                      marginBottom: 8,
                    }}
                  >
                    {tier.nairaPerDay}
                  </div>
                  <p
                    style={{
                      fontSize: 14,
                      color: tier.isFeatured ? '#94a3b8' : SLATE,
                      marginBottom: 24,
                      lineHeight: 1.5,
                    }}
                  >
                    {tier.forWho}
                  </p>

                  <div style={{ marginBottom: 24, flexGrow: 1 }}>
                    {tier.bullets.map((b) => (
                      <div
                        key={b}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          marginBottom: 10,
                        }}
                      >
                        <CheckCircle
                          style={{
                            width: 16,
                            height: 16,
                            color: tier.isFeatured ? GOLD_MID : GOLD,
                            flexShrink: 0,
                            marginTop: 2,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 14,
                            color: tier.isFeatured ? '#e2e8f0' : SLATE,
                            lineHeight: 1.4,
                          }}
                        >
                          {b}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: tier.isFeatured ? '#64748b' : '#94a3b8',
                      marginBottom: 24,
                      fontStyle: 'italic',
                    }}
                  >
                    Best for: {tier.bestFor}
                  </div>

                  <Link
                    to="/onboard"
                    className={tier.isFeatured ? 'adino-btn-gold' : 'adino-btn-outline'}
                    style={{
                      justifyContent: 'center',
                      ...(tier.isFeatured ? { backgroundColor: GOLD } : {}),
                    }}
                  >
                    {tier.cta}
                  </Link>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={200}>
            <p
              style={{
                fontSize: 14,
                color: '#94a3b8',
                marginTop: 32,
                fontStyle: 'italic',
              }}
            >
              Both plans include a 30-day free trial. No bank card required. If Adino does not work
              for your shop, you pay nothing.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ════ FAQ ════ */}
      <section style={{ padding: '88px 24px', background: OFF_WHITE }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: GOLD,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                Questions
              </span>
              <h2
                className="adino-display"
                style={{ fontSize: 38, fontWeight: 800, color: NAVY, margin: '12px 0 0' }}
              >
                The questions traders ask us every day
              </h2>
            </div>
          </FadeIn>

          <FadeIn delay={80}>
            <div
              style={{
                background: 'white',
                borderRadius: 20,
                padding: '8px 32px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
              }}
            >
              {faqs.map((faq, i) => (
                <div
                  key={faq.q}
                  style={{
                    borderBottom: i < faqs.length - 1 ? '1px solid #f1f5f9' : 'none',
                  }}
                >
                  <button
                    className="adino-faq-btn"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: NAVY,
                        lineHeight: 1.4,
                        textAlign: 'left',
                      }}
                    >
                      {faq.q}
                    </span>
                    <ChevronDown
                      style={{
                        width: 20,
                        height: 20,
                        color: GOLD,
                        flexShrink: 0,
                        transition: 'transform 0.25s',
                        transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    />
                  </button>
                  <div
                    style={{
                      overflow: 'hidden',
                      maxHeight: openFaq === i ? 300 : 0,
                      transition: 'max-height 0.35s ease',
                    }}
                  >
                    <p
                      style={{
                        fontSize: 15,
                        color: SLATE,
                        lineHeight: 1.7,
                        paddingBottom: 20,
                        margin: 0,
                      }}
                    >
                      {faq.a}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={150}>
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <span style={{ fontSize: 15, color: SLATE }}>Still have questions? </span>
              <a
                href={WHATSAPP_CTA_LINK}
                target="_blank"
                rel="noreferrer"
                style={{ color: GOLD, fontWeight: 700, textDecoration: 'none' }}
              >
                Message us on WhatsApp →
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ════ FINAL CTA ════ */}
      <section
        style={{
          background: NAVY,
          padding: '96px 24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -60,
            right: -60,
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: GOLD,
            opacity: 0.06,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -80,
            left: -40,
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: GOLD,
            opacity: 0.04,
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            maxWidth: 720,
            margin: '0 auto',
            textAlign: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <FadeIn>
            <h2
              className="adino-display"
              style={{
                fontSize: 42,
                fontWeight: 800,
                color: 'white',
                margin: '0 0 20px',
                lineHeight: 1.2,
              }}
            >
              Your shop is open tomorrow. You will either know exactly what happened — or you will{' '}
              <span style={{ color: GOLD }}>guess.</span>
            </h2>
            <p
              style={{
                fontSize: 17,
                color: '#94a3b8',
                margin: '0 0 40px',
                lineHeight: 1.7,
              }}
            >
              Start recording today. Most shops are running their first sale within 15 minutes of
              signing up.
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 16,
                justifyContent: 'center',
                marginBottom: 32,
              }}
            >
              <Link
                to="/onboard"
                className="adino-btn-gold"
                style={{ fontSize: 16, padding: '16px 32px' }}
              >
                Start Free — No Card Needed
                <ArrowRight style={{ width: 18, height: 18 }} />
              </Link>
              <a
                href={WHATSAPP_CTA_LINK}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1.5px solid rgba(255,255,255,0.15)',
                  color: 'white',
                  borderRadius: 10,
                  padding: '15px 28px',
                  fontSize: 15,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  textDecoration: 'none',
                }}
              >
                <MessageCircle style={{ width: 18, height: 18 }} />
                Talk to a real person on WhatsApp first
              </a>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 24,
                flexWrap: 'wrap',
              }}
            >
              {[
                'No contract',
                'No hidden fees',
                'Cancel any time',
                '1,200+ shops already on Adino',
              ].map((pt) => (
                <span
                  key={pt}
                  style={{
                    fontSize: 13,
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <CheckCircle style={{ width: 13, height: 13, color: GOLD }} />
                  {pt}
                </span>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ════ FOOTER ════ */}
      <footer
        style={{
          background: 'white',
          borderTop: '1px solid #f1f5f9',
          padding: '40px 24px',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src={heroImage}
                alt={BRAND}
                style={{ height: 32, objectFit: 'contain' }}
              />
              <div>
                <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{BRAND}</div>
                <div style={{ fontSize: 12, color: SLATE, marginTop: 2 }}>
                  Your shop records. Your money. Your proof.
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                flexWrap: 'wrap',
              }}
            >
              <Link
                to="/privacy"
                style={{ fontSize: 13, color: SLATE, textDecoration: 'none' }}
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms"
                style={{ fontSize: 13, color: SLATE, textDecoration: 'none' }}
              >
                Terms of Use
              </Link>
              <a
                href={WHATSAPP_CTA_LINK}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 13,
                  color: GOLD,
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <MessageCircle style={{ width: 14, height: 14 }} />
                Questions? Message us — we reply same day
              </a>
            </div>

            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              © {new Date().getFullYear()} {BRAND}. Built in Nigeria, for Nigerian traders.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default HomePage