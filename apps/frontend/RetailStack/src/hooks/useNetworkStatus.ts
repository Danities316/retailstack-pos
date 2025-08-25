import { useState, useEffect } from 'react'
import { syncService } from '@/services/syncService'

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [lastSync, setLastSync] = useState<number | null>(null)

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true)
      // Trigger sync when coming back online
      try {
        await syncService.syncData()
        setLastSync(Date.now())
        console.log('Offline data synced successfully')
      } catch (error) {
        console.error('Failed to sync offline data:', error)
      }
      window.dispatchEvent(new CustomEvent('networkOnline'))
    }

    const handleOffline = () => {
      setIsOnline(false)
      console.log('App is now offline - using cached data')
    }

    // Check network status on mount
    const checkNetworkStatus = () => {
      setIsOnline(navigator.onLine)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('focus', checkNetworkStatus)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('focus', checkNetworkStatus)
    }
  }, [])

  return { isOnline, lastSync }
}