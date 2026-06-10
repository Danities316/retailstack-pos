/**
 * OnboardingShell
 * Consistent chrome wrapping both onboarding steps.
 * Renders: logo bar, step indicator, progress fill, page content.
 */
import { useAuth } from '@/context/AuthContext'
import { CheckCircle2, LogOut } from 'lucide-react'

const GOLD = '#D4AF37'

interface Step {
    number: number
    label: string
    done: boolean
    active: boolean
}

interface OnboardingShellProps {
    currentStep: 1 | 2
    children: React.ReactNode
}

export function OnboardingShell({ currentStep, children }: OnboardingShellProps) {
    const { user, logout } = useAuth()

    const steps: Step[] = [
        { number: 1, label: 'Add Product', done: currentStep > 1, active: currentStep === 1 },
        { number: 2, label: 'First Sale', done: false, active: currentStep === 2 },
    ]

    const progressPct = currentStep === 1 ? 25 : 65

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
        }}>
            {/* Top bar */}
            <header style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 32px',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                background: 'rgba(15,23,42,0.7)',
                backdropFilter: 'blur(12px)',
                position: 'sticky', top: 0, zIndex: 10,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: 8,
                        background: `linear-gradient(135deg, ${GOLD}, #b8960c)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 900, color: '#fff', fontSize: 16, letterSpacing: '-0.5px',
                    }}>R</div>
                    <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>
                        Adino POS
                    </span>
                    <span style={{
                        marginLeft: 8, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
                        color: GOLD, background: '#D4AF3722', borderRadius: 4, padding: '2px 8px',
                        textTransform: 'uppercase',
                    }}>Setup</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>
                        👋 {user?.name || user?.email}
                    </span>
                    <button
                        onClick={logout}
                        style={{
                            background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                            color: '#94a3b8', borderRadius: 6, padding: '5px 12px',
                            fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                        }}
                    >
                        <LogOut size={12} /> Sign out
                    </button>
                </div>
            </header>

            {/* Progress area */}
            <div style={{ padding: '28px 32px 0', maxWidth: 700, margin: '0 auto', width: '100%' }}>
                {/* Step pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 16 }}>
                    {steps.map((step, idx) => (
                        <div key={step.number} style={{ display: 'flex', alignItems: 'center', flex: idx < steps.length - 1 ? 1 : 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                    width: 28, height: 28, borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 12, fontWeight: 700,
                                    background: step.done ? '#16a34a' : step.active ? GOLD : 'rgba(255,255,255,0.08)',
                                    color: step.done || step.active ? '#fff' : '#64748b',
                                    border: step.active ? `2px solid ${GOLD}` : '2px solid transparent',
                                    flexShrink: 0,
                                    transition: 'all 0.3s',
                                }}>
                                    {step.done ? <CheckCircle2 size={14} /> : step.number}
                                </div>
                                <span style={{
                                    fontSize: 13, fontWeight: step.active ? 600 : 400,
                                    color: step.done ? '#86efac' : step.active ? '#f8fafc' : '#475569',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {step.label}
                                </span>
                            </div>
                            {idx < steps.length - 1 && (
                                <div style={{
                                    flex: 1, height: 1, margin: '0 12px',
                                    background: step.done ? '#16a34a' : 'rgba(255,255,255,0.1)',
                                    transition: 'background 0.4s',
                                }} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Progress bar */}
                <div style={{
                    height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
                }}>
                    <div style={{
                        height: '100%', borderRadius: 99,
                        background: `linear-gradient(90deg, ${GOLD}, #f59e0b)`,
                        width: `${progressPct}%`,
                        transition: 'width 0.6s cubic-bezier(.4,0,.2,1)',
                    }} />
                </div>
                <p style={{ color: '#475569', fontSize: 12, marginTop: 6, textAlign: 'right' }}>
                    Step {currentStep} of 2
                </p>
            </div>

            {/* Page content */}
            <main style={{ flex: 1, padding: '12px 32px 48px', maxWidth: 700, margin: '0 auto', width: '100%' }}>
                {children}
            </main>
        </div>
    )
}