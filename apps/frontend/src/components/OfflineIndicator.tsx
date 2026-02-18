/**
 * OfflineIndicator Component
 * Shows a banner when user is in offline login mode
 * Displays remaining offline access time and limitations
 */

import { useEffect, useState } from 'react'
import { AlertCircle, Wifi, WifiOff } from 'lucide-react'
import { isInOfflineMode, getOfflineAccessRemainingHours, getOfflineSessionUser } from '@/lib/offlineAuth'

export const OfflineIndicator = () => {
  const [isOffline, setIsOffline] = useState(false)
  const [remainingHours, setRemainingHours] = useState(0)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const updateOfflineStatus = () => {
      setIsOffline(isInOfflineMode())
      setRemainingHours(getOfflineAccessRemainingHours())
      setUser(getOfflineSessionUser())
    }

    updateOfflineStatus()
    const interval = setInterval(updateOfflineStatus, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  if (!isOffline) return null

  return (
    <div className="fixed top-0 left-0 right-0 bg-amber-50 border-b-2 border-amber-400 px-4 py-3 z-50 shadow-md">
      <div className="max-w-6xl mx-auto flex items-center gap-3">
        <div className="flex items-center gap-2">
          <WifiOff className="w-5 h-5 text-amber-600" />
          <AlertCircle className="w-5 h-5 text-amber-600" />
        </div>

        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900">
            📳 Offline Mode Active
          </p>
          <p className="text-xs text-amber-700 mt-1">
            You are using offline access. Go online to sync your data.
            {remainingHours > 0 && (
              <span className="ml-2 font-medium">
                Access expires in {Math.ceil(remainingHours)} hours
              </span>
            )}
          </p>
        </div>

        <div className="text-right text-xs text-amber-700">
          <p className="font-medium">Limited functionality</p>
          <p>Offline mode active</p>
        </div>
      </div>

      {/* Progress bar showing remaining time */}
      {remainingHours > 0 && (
        <div className="mt-2 bg-amber-200 rounded-full h-1 overflow-hidden">
          <div
            className="bg-amber-600 h-full transition-all duration-1000"
            style={{
              width: `${Math.max(0, Math.min(100, (remainingHours / 72) * 100))}%`,
            }}
          />
        </div>
      )}
    </div>
  )
}

export default OfflineIndicator
