import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '@/lib/apiClient'

interface Product {
  id: string
  productName: string
  sellingPrice: number
  stock: number
}

interface SaleItem {
  productId: string
  quantity: number
  price: number
}

export const CreateSalePage = () => {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [selectedItems, setSelectedItems] = useState<SaleItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Load products
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/products', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        if (response.ok) {
          const data = await response.json()
          setProducts(data)
        }
      } catch (error) {
        console.error('Failed to load products:', error)
      }
    }

    if (token) {
      loadProducts()
    }
  }, [token])

  const addItem = () => {
    setSelectedItems([...selectedItems, { productId: '', quantity: 1, price: 0 }])
  }

  const removeItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof SaleItem, value: any) => {
    const newItems = [...selectedItems]
    newItems[index] = { ...newItems[index], [field]: value }
    
    // Update price if product is selected
    if (field === 'productId') {
      const product = products.find(p => p.id === value)
      if (product) {
        newItems[index].price = product.sellingPrice
      }
    }
    
    setSelectedItems(newItems)
  }

  const calculateTotal = () => {
    return selectedItems.reduce((total, item) => {
      return total + (item.price * item.quantity)
    }, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (selectedItems.length === 0) {
      setError('Please add at least one item to the sale')
      setLoading(false)
      return
    }

    try {
      const saleData = {
        paymentMethod,
        items: selectedItems
      }

      const sale = await apiClient.createSale(saleData)
      setSuccess('Sale created successfully!')
      setTimeout(() => navigate('/dashboard/sales'), 1500)
    } catch (err: any) {
      if (err.message === 'Request queued for offline sync') {
        setSuccess('Sale will be created when connection is restored')
        setTimeout(() => navigate('/dashboard/sales'), 2000)
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl text-blue-600 font-semibold mb-6">Create New Sale</h1>
      
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      {success && <p className="text-green-600 text-sm mb-4">{success}</p>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium mb-2">Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="border rounded-md px-3 py-2 w-full"
          >
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="TRANSFER">Transfer</option>
          </select>
        </div>

        {/* Sale Items */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Sale Items</h3>
            <Button type="button" onClick={addItem} variant="outline">
              Add Item
            </Button>
          </div>

          {selectedItems.map((item, index) => (
            <div key={index} className="grid grid-cols-4 gap-4 mb-4 p-4 border rounded">
              <select
                value={item.productId}
                onChange={(e) => updateItem(index, 'productId', e.target.value)}
                className="border rounded px-3 py-2"
                required
              >
                <option value="">Select Product</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.productName} - ${product.sellingPrice}
                  </option>
                ))}
              </select>

              <Input
                type="number"
                placeholder="Quantity"
                value={item.quantity}
                onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                min="1"
                required
              />

              <Input
                type="number"
                placeholder="Price"
                value={item.price}
                onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                step="0.01"
                required
              />

              <Button
                type="button"
                onClick={() => removeItem(index)}
                variant="outline"
                className="text-red-600"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="text-right">
          <p className="text-xl font-semibold">
            Total: ${calculateTotal().toFixed(2)}
          </p>
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-4 justify-end">
          <Button type="submit" disabled={loading || selectedItems.length === 0} className="bg-blue-600 hover:bg-blue-400 text-white font-semibold px-6 py-2 rounded-md transition-colors duration-150">
            {loading ? 'Creating...' : 'Create Sale'}
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => navigate('/dashboard/sales')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}