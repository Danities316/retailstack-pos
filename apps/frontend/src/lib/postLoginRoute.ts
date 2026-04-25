/**
 * postLoginRoute.ts
 *
 * Single source of truth for role + onboarding-aware routing.
 * Called after login, on session restore, and by route guards.
 *
 * DO NOT scatter this logic across components — always import from here.
 */

export interface OnboardingState {
  hasProduct: boolean
  hasSale: boolean
  hasInvitedUser: boolean
  completed: boolean
}

export interface RoutableUser {
  role: string
  isFirstLogin?: boolean
}

/**
 * Returns the correct route for a user immediately after login
 * or on session restore.
 *
 * Rules (in priority order):
 *  CASHIER  → always /pos
 *  MANAGER  → always /dashboard
 *  OWNER    → onboarding funnel if incomplete, otherwise /dashboard
 *  SUPER_ADMIN / unknown → /dashboard (failsafe)
 */
export function getPostLoginRoute(
  user: RoutableUser | null,
  onboarding: OnboardingState | null,
): string {
  // Failsafe: no user data → send to login
  if (!user) return '/login'

  switch (user.role) {
    case 'CASHIER':
      return '/pos'

    case 'MANAGER':
      return '/dashboard'

    case 'OWNER': {
      // If onboarding data is missing (e.g. restored offline session), fall through to dashboard
      if (!onboarding) return '/dashboard'

      if (!onboarding.hasProduct) return '/onboarding/product'
      if (onboarding.hasProduct && !onboarding.hasSale) return '/onboarding/first-sale'
      return '/dashboard'
    }

    // SUPER_ADMIN and any unrecognised roles
    default:
      return '/dashboard'
  }
}
