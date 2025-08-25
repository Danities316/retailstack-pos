# Offline Features Fix Guide

## Issues Fixed

### 1. **Hardcoded Localhost URL**
- **Problem**: `apiClient.ts` was using `http://localhost:3000/api` instead of the deployed backend URL
- **Solution**: Updated to use environment variable `VITE_API_BASE_URL` with fallback to deployed URL

### 2. **Missing Environment Configuration**
- **Problem**: No environment variables set for production deployment
- **Solution**: Added TypeScript types and environment variable handling

### 3. **Improved Offline Detection**
- **Problem**: Basic `navigator.onLine` check wasn't catching all network errors
- **Solution**: Enhanced error detection to catch fetch failures and network errors

### 4. **Added Service Worker**
- **Problem**: No caching mechanism for offline app functionality
- **Solution**: Added service worker for better offline support and caching

## Deployment Steps

### 1. Set Environment Variables on Vercel

Go to your Vercel dashboard and add these environment variables:

```
VITE_API_BASE_URL=http://localhost:3000/api
```

### 2. Redeploy Frontend

```bash
# In the frontend directory
npm run build
# Deploy to Vercel
```

### 3. Test Offline Functionality

1. **Load the app online first** to cache data
2. **Go offline** (disconnect internet or use DevTools)
3. **Test offline features**:
   - View products (should show cached data)
   - Create new products (should queue for sync)
   - Create new sales (should queue for sync)
4. **Go back online** and verify sync works

## How Offline Features Work

### 1. **Data Caching**
- Products, categories, and sales are cached in IndexedDB when online
- Dashboard stats and charts are cached for offline viewing

### 2. **Offline Operations**
- When offline, new operations are stored locally with `isOffline: true` flag
- Operations are queued for sync when connection is restored

### 3. **Sync Process**
- When coming back online, queued operations are sent to the server
- Local offline records are updated with server IDs
- Cache is refreshed with latest data

### 4. **Service Worker**
- Caches app shell for offline loading
- Provides fallback for network requests
- Handles cache updates automatically

## Troubleshooting

### "Failed to fetch" errors still occur
1. Check that `VITE_API_BASE_URL` is set correctly in Vercel
2. Verify the backend URL is accessible
3. Check browser console for specific error messages

### Offline data not showing
1. Ensure you've loaded the app online first to cache data
2. Check IndexedDB in DevTools > Application > Storage
3. Verify the `offlineDB.init()` is called in App.jsx

### Sync not working
1. Check network status in browser DevTools
2. Verify the sync service is properly handling the queue
3. Check server logs for sync request errors

## Files Modified

- `src/lib/apiClient.ts` - Fixed API URL and improved offline detection
- `src/vite-env.d.ts` - Added TypeScript types for environment variables
- `public/sw.js` - Added service worker for offline caching
- `src/main.jsx` - Added service worker registration
- `src/hooks/useNetworkStatus.ts` - Improved network status detection

## Testing Checklist

- [ ] App loads correctly online
- [ ] Data is cached when online
- [ ] App works offline (shows cached data)
- [ ] New operations work offline (queue for sync)
- [ ] Sync works when coming back online
- [ ] No "failed to fetch" errors when offline
- [ ] Service worker is registered
- [ ] Environment variables are set correctly