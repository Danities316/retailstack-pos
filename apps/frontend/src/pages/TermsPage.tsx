import React from 'react'
import { Link } from 'react-router-dom'

const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">
          ← Back to Home
        </Link>
        <h1 className="mt-4 text-3xl md:text-4xl font-extrabold text-slate-900">
          ADINO Terms of Service
        </h1>
        <p className="mt-3 text-slate-600">
          These terms govern your use of ADINO and outline service expectations
          for merchants and teams.
        </p>

        <div className="mt-8 space-y-6 bg-white border border-slate-200 rounded-2xl p-6 md:p-8">
          <section>
            <h2 className="text-xl font-bold text-slate-900">Service Use</h2>
            <p className="mt-2 text-slate-700">
              You agree to use ADINO for lawful business operations and provide
              accurate account details.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900">Billing and Trial</h2>
            <p className="mt-2 text-slate-700">
              ADINO provides a 30-day free trial, no card needed. Paid plans
              follow the pricing shown at signup.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900">Support</h2>
            <p className="mt-2 text-slate-700">
              Our team supports onboarding and day-to-day usage through available
              customer channels.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

export default TermsPage
