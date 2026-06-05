import React from 'react'
import { Link } from 'react-router-dom'

const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">
          ← Back to Home
        </Link>
        <h1 className="mt-4 text-3xl md:text-4xl font-extrabold text-slate-900">
          ADINO Privacy Policy
        </h1>
        <p className="mt-3 text-slate-600">
          This page explains how ADINO collects, uses, and protects information
          when businesses use our POS platform.
        </p>

        <div className="mt-8 space-y-6 bg-white border border-slate-200 rounded-2xl p-6 md:p-8">
          <section>
            <h2 className="text-xl font-bold text-slate-900">Information We Collect</h2>
            <p className="mt-2 text-slate-700">
              We may collect account information, store setup details, and sales
              activity required to provide POS services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900">How We Use Data</h2>
            <p className="mt-2 text-slate-700">
              We use data to operate the platform, provide reports, improve
              reliability, and support your team.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900">Security</h2>
            <p className="mt-2 text-slate-700">
              ADINO uses technical and organizational safeguards to protect your
              business information.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPage
