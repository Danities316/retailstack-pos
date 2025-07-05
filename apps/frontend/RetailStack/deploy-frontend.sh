#!/bin/bash

# 🚀 RetailStack Frontend Deployment Script
# This script helps prepare and deploy the frontend to Vercel

echo "🚀 Starting RetailStack Frontend Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -d "apps/frontend/RetailStack" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_status "Checking prerequisites..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

print_success "Prerequisites check passed"

# Navigate to frontend directory
cd apps/frontend/RetailStack

print_status "Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    print_error "Failed to install dependencies"
    exit 1
fi

print_success "Dependencies installed"

print_status "Building for production..."
npm run build

if [ $? -ne 0 ]; then
    print_error "Build failed. Please check the error messages above."
    exit 1
fi

print_success "Build completed successfully"

# Check if dist directory exists
if [ ! -d "dist" ]; then
    print_error "Build output directory 'dist' not found"
    exit 1
fi

print_success "Frontend is ready for deployment!"

echo ""
echo "📋 Next Steps:"
echo "1. Go to https://vercel.com"
echo "2. Sign in with your GitHub account"
echo "3. Click 'New Project'"
echo "4. Import your GitHub repository"
echo "5. Configure the following settings:"
echo "   - Framework Preset: Vite"
echo "   - Root Directory: apps/frontend/RetailStack"
echo "   - Build Command: npm run build"
echo "   - Output Directory: dist"
echo "6. Add environment variables:"
echo "   - VITE_API_BASE_URL=https://your-backend-render-url.onrender.com/api"
echo "7. Click 'Deploy'"
echo ""
echo "🔧 Don't forget to:"
echo "- Update CORS in your backend with your Vercel domain"
echo "- Test the deployed application"
echo "- Configure custom domain (optional)"
echo ""

print_success "Deployment script completed!" 