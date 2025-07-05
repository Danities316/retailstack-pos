# 🚀 Vercel Deployment Guide for RetailStack Frontend

## 📋 **Prerequisites**

1. **GitHub Repository**: Your code should be on GitHub
2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
3. **Backend URL**: Your Render backend should be deployed and accessible

## 🛠️ **Step 1: Prepare Frontend for Production**

### **1.1 Create Production Environment File**
Create `.env.production` in `apps/frontend/RetailStack/`:

```env
# Production Environment Variables
VITE_API_BASE_URL=https://your-backend-render-url.onrender.com/api
VITE_APP_NAME=RetailStack POS
VITE_APP_VERSION=1.0.0

# Feature Flags
VITE_ENABLE_OFFLINE_MODE=true
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_DEBUG_MODE=false
```

### **1.2 Update API Configuration**
Make sure your frontend uses the production API URL:

```typescript
// src/config/api.ts or similar
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://retailstack-pos.onrender.com/api';
```

### **1.3 Test Build Locally**
```bash
cd apps/frontend/RetailStack
npm run build
```

## 🌐 **Step 2: Deploy to Vercel**

### **2.1 Connect GitHub to Vercel**
1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "New Project"
4. Import your GitHub repository

### **2.2 Configure Project Settings**

**Project Name**: `retailstack-frontend`

**Framework Preset**: `Vite`

**Root Directory**: `apps/frontend/RetailStack`

**Build Command**: `npm run build`

**Output Directory**: `dist`

**Install Command**: `npm install`

### **2.3 Environment Variables**
Add these in Vercel dashboard:

```
VITE_API_BASE_URL=https://your-backend-render-url.onrender.com/api
VITE_APP_NAME=RetailStack POS
VITE_APP_VERSION=1.0.0
VITE_ENABLE_OFFLINE_MODE=true
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_DEBUG_MODE=false
```

### **2.4 Deploy**
Click "Deploy" and wait for the build to complete.

## ⚙️ **Step 3: Configure Custom Domain (Optional)**

### **3.1 Add Custom Domain**
1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed

### **3.2 SSL Certificate**
Vercel automatically provides SSL certificates.

## 🔧 **Step 4: Post-Deployment Configuration**

### **4.1 Update CORS in Backend**
Make sure your backend allows requests from your Vercel domain:

```typescript
// In your backend CORS configuration
app.use(cors({
  origin: [
    'https://your-vercel-domain.vercel.app',
    'https://your-custom-domain.com',
    'http://localhost:5173' // for local development
  ],
  credentials: true
}));
```

### **4.2 Test API Connectivity**
1. Open your deployed frontend
2. Try to log in or access API endpoints
3. Check browser console for errors
4. Verify offline functionality

## 📊 **Step 5: Monitoring & Analytics**

### **5.1 Vercel Analytics**
Enable Vercel Analytics in your project settings.

### **5.2 Error Monitoring**
Consider adding error monitoring:
- Sentry
- LogRocket
- Bugsnag

### **5.3 Performance Monitoring**
- Vercel Speed Insights
- Core Web Vitals
- Lighthouse scores

## 🔄 **Step 6: Continuous Deployment**

### **6.1 Automatic Deployments**
Vercel automatically deploys on:
- Push to main branch
- Pull request creation
- Manual deployment

### **6.2 Preview Deployments**
- Each PR gets a preview URL
- Test changes before merging
- Share with stakeholders

## 🚨 **Step 7: Troubleshooting**

### **Common Issues & Solutions**

#### **Build Failures**
```bash
# Check build logs in Vercel dashboard
# Common fixes:
npm install --legacy-peer-deps
# or
npm ci
```

#### **API Connection Issues**
1. Check CORS configuration
2. Verify API URL in environment variables
3. Test API endpoints directly
4. Check network tab in browser

#### **Environment Variables**
1. Ensure all variables are set in Vercel
2. Check variable names (case-sensitive)
3. Restart deployment after adding variables

#### **Routing Issues**
1. Verify `vercel.json` configuration
2. Check SPA routing setup
3. Test direct URL access

## 📱 **Step 8: PWA Configuration (If Applicable)**

### **8.1 Service Worker**
If you have offline functionality:
1. Ensure service worker is properly configured
2. Test offline mode after deployment
3. Verify cache strategies

### **8.2 Manifest File**
Check `public/manifest.json` for PWA settings.

## 🔒 **Step 9: Security Considerations**

### **9.1 Environment Variables**
- Never commit sensitive data
- Use Vercel's environment variable system
- Rotate API keys regularly

### **9.2 Content Security Policy**
Consider adding CSP headers in `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
        }
      ]
    }
  ]
}
```

## 📈 **Step 10: Performance Optimization**

### **10.1 Build Optimization**
- Enable tree shaking
- Optimize bundle size
- Use code splitting

### **10.2 Caching Strategy**
- Configure proper cache headers
- Use CDN effectively
- Optimize static assets

## 🎯 **Deployment Checklist**

- [ ] Frontend builds successfully locally
- [ ] Environment variables configured
- [ ] API URL updated for production
- [ ] CORS configured in backend
- [ ] Custom domain configured (if needed)
- [ ] SSL certificate active
- [ ] API connectivity tested
- [ ] Offline functionality tested
- [ ] Performance optimized
- [ ] Monitoring configured

## 🚀 **Final Steps**

1. **Test thoroughly** on the deployed version
2. **Monitor performance** and errors
3. **Set up alerts** for downtime
4. **Document deployment process** for team
5. **Plan for scaling** as you grow

Your RetailStack frontend should now be live on Vercel! 🎉

## 🔗 **Useful Links**

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [React Deployment Best Practices](https://create-react-app.dev/docs/deployment/)