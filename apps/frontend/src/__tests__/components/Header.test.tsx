import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Header } from '@/components/Header'

// Mock the AuthContext
const mockAuthContext = {
  token: 'test-token',
  setToken: vi.fn(),
  user: {
    id: '1',
    email: 'test@example.com',
    role: 'OWNER',
    tenantId: 'tenant1'
  },
  isAuthenticated: true,
  loading: false
}

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockAuthContext
}))

describe('Header', () => {
  const defaultProps = {
    toggleSidebar: vi.fn(),
    isSidebarOpen: true,
    storeName: 'Test Store'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render header with store name', () => {
    render(<Header {...defaultProps} />)
    
    expect(screen.getByText('Test Store')).toBeInTheDocument()
  })

  it('should render user email', () => {
    render(<Header {...defaultProps} />)
    
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('should call toggleSidebar when menu button is clicked', () => {
    render(<Header {...defaultProps} />)
    
    const menuButton = screen.getByRole('button', { name: /menu/i })
    fireEvent.click(menuButton)
    
    expect(defaultProps.toggleSidebar).toHaveBeenCalledTimes(1)
  })

  it('should show logout button', () => {
    render(<Header {...defaultProps} />)
    
    const logoutButton = screen.getByRole('button', { name: /logout/i })
    expect(logoutButton).toBeInTheDocument()
  })

  it('should call setToken with null when logout is clicked', () => {
    render(<Header {...defaultProps} />)
    
    const logoutButton = screen.getByRole('button', { name: /logout/i })
    fireEvent.click(logoutButton)
    
    expect(mockAuthContext.setToken).toHaveBeenCalledWith(null, null)
  })

  it('should show sidebar toggle icon correctly when sidebar is open', () => {
    render(<Header {...defaultProps} isSidebarOpen={true} />)
    
    // The icon should be visible (you might need to adjust the selector based on your actual implementation)
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument()
  })

  it('should show sidebar toggle icon correctly when sidebar is closed', () => {
    render(<Header {...defaultProps} isSidebarOpen={false} />)
    
    // The icon should still be visible but might have different styling
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument()
  })
})
