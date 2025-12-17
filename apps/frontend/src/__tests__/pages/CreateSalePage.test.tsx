import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { CreateSalePage } from '@/pages/CreateSalePage'
import { mockProducts } from '../__mocks__/apiClient'

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

// Mock the API client
vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    createSale: vi.fn()
  }
}))

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

// Mock fetch for loading products
global.fetch = vi.fn()

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('CreateSalePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock successful product loading
    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProducts)
    })
  })

  it('should render create sale form', async () => {
    renderWithRouter(<CreateSalePage />)
    
    expect(screen.getByText('Create New Sale')).toBeInTheDocument()
    expect(screen.getByText('Payment Method')).toBeInTheDocument()
    expect(screen.getByText('Sale Items')).toBeInTheDocument()
  })

  it('should load products on mount', async () => {
    renderWithRouter(<CreateSalePage />)
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/products',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      )
    })
  })

  it('should add item when Add Item button is clicked', async () => {
    renderWithRouter(<CreateSalePage />)
    
    const addItemButton = screen.getByText('Add Item')
    fireEvent.click(addItemButton)
    
    // Should show product selection dropdown
    expect(screen.getByText('Select Product')).toBeInTheDocument()
  })

  it('should remove item when Remove button is clicked', async () => {
    renderWithRouter(<CreateSalePage />)
    
    // Add an item first
    const addItemButton = screen.getByText('Add Item')
    fireEvent.click(addItemButton)
    
    // Then remove it
    const removeButton = screen.getByText('Remove')
    fireEvent.click(removeButton)
    
    // Item should be removed
    expect(screen.queryByText('Select Product')).not.toBeInTheDocument()
  })

  it('should update item quantity when changed', async () => {
    renderWithRouter(<CreateSalePage />)
    
    // Add an item
    const addItemButton = screen.getByText('Add Item')
    fireEvent.click(addItemButton)
    
    // Change quantity
    const quantityInput = screen.getByDisplayValue('1')
    fireEvent.change(quantityInput, { target: { value: '5' } })
    
    expect(quantityInput).toHaveValue(5)
  })

  it('should calculate total correctly', async () => {
    renderWithRouter(<CreateSalePage />)
    
    // Add an item
    const addItemButton = screen.getByText('Add Item')
    fireEvent.click(addItemButton)
    
    // Select a product (assuming the first product has price 100)
    const productSelect = screen.getByDisplayValue('')
    fireEvent.change(productSelect, { target: { value: '1' } })
    
    // Set quantity to 2
    const quantityInput = screen.getByDisplayValue('1')
    fireEvent.change(quantityInput, { target: { value: '2' } })
    
    // Total should be 200 (100 * 2)
    expect(screen.getByText('Total: $200.00')).toBeInTheDocument()
  })

  it('should show error when trying to submit without items', async () => {
    renderWithRouter(<CreateSalePage />)
    
    const createButton = screen.getByText('Create Sale')
    fireEvent.click(createButton)
    
    expect(screen.getByText('Please add at least one item to the sale')).toBeInTheDocument()
  })

  it('should create sale successfully', async () => {
    const { apiClient } = await import('@/lib/apiClient')
    ;(apiClient.createSale as any).mockResolvedValueOnce({
      id: 'sale1',
      totalAmount: 200,
      paymentMethod: 'CASH',
      items: [{ productId: '1', quantity: 2, price: 100 }]
    })

    renderWithRouter(<CreateSalePage />)
    
    // Add an item and fill form
    const addItemButton = screen.getByText('Add Item')
    fireEvent.click(addItemButton)
    
    const productSelect = screen.getByDisplayValue('')
    fireEvent.change(productSelect, { target: { value: '1' } })
    
    // Submit form
    const createButton = screen.getByText('Create Sale')
    fireEvent.click(createButton)
    
    await waitFor(() => {
      expect(apiClient.createSale).toHaveBeenCalledWith({
        paymentMethod: 'CASH',
        items: expect.any(Array),
        total: expect.any(Number)
      })
    })
  })

  it('should show success message after creating sale', async () => {
    const { apiClient } = await import('@/lib/apiClient')
    ;(apiClient.createSale as any).mockResolvedValueOnce({
      id: 'sale1',
      totalAmount: 200,
      paymentMethod: 'CASH',
      items: [{ productId: '1', quantity: 2, price: 100 }]
    })

    renderWithRouter(<CreateSalePage />)
    
    // Add an item and fill form
    const addItemButton = screen.getByText('Add Item')
    fireEvent.click(addItemButton)
    
    const productSelect = screen.getByDisplayValue('')
    fireEvent.change(productSelect, { target: { value: '1' } })
    
    // Submit form
    const createButton = screen.getByText('Create Sale')
    fireEvent.click(createButton)
    
    await waitFor(() => {
      expect(screen.getByText('Sale created successfully!')).toBeInTheDocument()
    })
  })
})
