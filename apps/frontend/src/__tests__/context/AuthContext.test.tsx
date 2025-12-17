import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from '@/context/AuthContext'

// Test component to access context
const TestComponent = () => {
  const { token, user, isAuthenticated, loading } = useAuth()
  return (
    <div>
      <div data-testid="token">{token || 'no-token'}</div>
      <div data-testid="user">{user?.email || 'no-user'}</div>
      <div data-testid="authenticated">{isAuthenticated.toString()}</div>
      <div data-testid="loading">{loading.toString()}</div>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('should provide initial state correctly', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(screen.getByTestId('token')).toHaveTextContent('no-token')
    expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false')
  })

  it('should set token and user correctly', () => {
    const TestComponentWithActions = () => {
      const { setToken } = useAuth()
      
      const handleLogin = () => {
        setToken('test-token', {
          id: '1',
          email: 'test@example.com',
          role: 'OWNER',
          tenantId: 'tenant1'
        })
      }

      return (
        <div>
          <button onClick={handleLogin}>Login</button>
          <TestComponent />
        </div>
      )
    }

    render(
      <AuthProvider>
        <TestComponentWithActions />
      </AuthProvider>
    )

    act(() => {
      screen.getByText('Login').click()
    })

    expect(screen.getByTestId('token')).toHaveTextContent('test-token')
    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
  })

  it('should load token from localStorage on mount', () => {
    localStorage.setItem('auth_token', 'stored-token')
    localStorage.setItem('auth_user', JSON.stringify({
      id: '1',
      email: 'stored@example.com',
      role: 'OWNER',
      tenantId: 'tenant1'
    }))

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(screen.getByTestId('token')).toHaveTextContent('stored-token')
    expect(screen.getByTestId('user')).toHaveTextContent('stored@example.com')
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
  })

  it('should clear token and user on logout', () => {
    const TestComponentWithLogout = () => {
      const { setToken } = useAuth()
      
      const handleLogin = () => {
        setToken('test-token', {
          id: '1',
          email: 'test@example.com',
          role: 'OWNER',
          tenantId: 'tenant1'
        })
      }

      const handleLogout = () => {
        setToken(null, null)
      }

      return (
        <div>
          <button onClick={handleLogin}>Login</button>
          <button onClick={handleLogout}>Logout</button>
          <TestComponent />
        </div>
      )
    }

    render(
      <AuthProvider>
        <TestComponentWithLogout />
      </AuthProvider>
    )

    // Login first
    act(() => {
      screen.getByText('Login').click()
    })

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true')

    // Then logout
    act(() => {
      screen.getByText('Logout').click()
    })

    expect(screen.getByTestId('token')).toHaveTextContent('no-token')
    expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false')
  })
})
