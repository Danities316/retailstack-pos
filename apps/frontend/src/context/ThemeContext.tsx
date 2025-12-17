import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface BrandColors {
  primary: string
  secondary: string
  accent: string
  background: string
  surface: string
  text: string
  textSecondary: string
  border: string
  success: string
  warning: string
  error: string
}

interface ThemeConfig {
  mode: 'light' | 'dark'
  brandColors: BrandColors
  logo?: string
  fontFamily?: string
}

interface ThemeContextType {
  theme: ThemeConfig
  toggleTheme: () => void
  updateBrandColors: (colors: Partial<BrandColors>) => void
  updateLogo: (logo: string) => void
  updateFontFamily: (font: string) => void
}

const defaultLightColors: BrandColors = {
  primary: '#3B82F6', // Modern blue - trustworthy for retail
  secondary: '#64748B',
  accent: '#F59E0B',
  background: '#FFFFFF',
  surface: '#F8FAFC',
  text: '#1E293B',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444'
}

const defaultDarkColors: BrandColors = {
  primary: '#60A5FA',
  secondary: '#94A3B8',
  accent: '#FBBF24',
  background: '#0F172A',
  surface: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  border: '#334155',
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171'
}

const defaultTheme: ThemeConfig = {
  mode: 'light',
  brandColors: defaultLightColors,
  fontFamily: 'Inter, system-ui, sans-serif'
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  children: ReactNode
  tenantId?: string
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, tenantId }) => {
  const [theme, setTheme] = useState<ThemeConfig>(() => {
    // Load from localStorage first
    const savedTheme = localStorage.getItem('retailstack-theme')
    if (savedTheme) {
      try {
        return JSON.parse(savedTheme)
      } catch {
        return defaultTheme
      }
    }
    return defaultTheme
  })

  // Apply theme to CSS variables
  useEffect(() => {
    const root = document.documentElement
    const colors = theme.mode === 'dark' ? defaultDarkColors : defaultLightColors
    const brandColors = { ...colors, ...theme.brandColors }

    // Set CSS custom properties
    Object.entries(brandColors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value)
    })

    // Set theme mode
    root.setAttribute('data-theme', theme.mode)
    
    // Set font family
    if (theme.fontFamily) {
      root.style.setProperty('--font-family', theme.fontFamily)
    }

    // Save to localStorage
    localStorage.setItem('retailstack-theme', JSON.stringify(theme))
  }, [theme])

  // Load tenant-specific branding if available
  useEffect(() => {
    if (tenantId) {
      const tenantBranding = localStorage.getItem(`tenant-branding-${tenantId}`)
      if (tenantBranding) {
        try {
          const branding = JSON.parse(tenantBranding)
          setTheme(prev => ({
            ...prev,
            brandColors: { ...prev.brandColors, ...branding.colors },
            logo: branding.logo,
            fontFamily: branding.fontFamily
          }))
        } catch {
          // Ignore invalid branding data
        }
      }
    }
  }, [tenantId])

  const toggleTheme = () => {
    setTheme(prev => ({
      ...prev,
      mode: prev.mode === 'light' ? 'dark' : 'light',
      brandColors: prev.mode === 'light' ? defaultDarkColors : defaultLightColors
    }))
  }

  const updateBrandColors = (colors: Partial<BrandColors>) => {
    setTheme(prev => ({
      ...prev,
      brandColors: { ...prev.brandColors, ...colors }
    }))
  }

  const updateLogo = (logo: string) => {
    setTheme(prev => ({ ...prev, logo }))
  }

  const updateFontFamily = (fontFamily: string) => {
    setTheme(prev => ({ ...prev, fontFamily }))
  }

  const value: ThemeContextType = {
    theme,
    toggleTheme,
    updateBrandColors,
    updateLogo,
    updateFontFamily
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
} 