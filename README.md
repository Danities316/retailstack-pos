# RetailStack POS System

A modern, full-stack, multi-tenant Point of Sale (POS) system built with a React (Vite + Tailwind) frontend and a Node.js/Express backend using Prisma and PostgreSQL.  
Supports offline mode, real-time dashboard widgets, and multi-role access (Super Admin, Owner, Manager, Cashier).

---

## Features

- **Multi-tenant**: Each business/store has its own data and users.
- **Role-based Access**: Super Admin, Owner, Manager, Cashier.
- **Dashboard**: QuickStats, SalesChart, SalesSummary, Top Selling Products.
- **Product & Category Management**
- **Sales & Inventory Tracking**
- **Offline Support**: IndexedDB caching for key data and sales.
- **Modern UI**: Built with React, Tailwind CSS, and Recharts.
- **API-first**: RESTful backend with JWT authentication.

---

## Monorepo Structure

```
retailstack-pos/
  apps/
    backend/      # Node.js/Express/Prisma backend
    frontend/
      RetailStack/  # React + Vite frontend
  packages/
    ui/           # Shared UI components
    eslint-config/ # Shared lint config
    typescript-config/ # Shared tsconfig
```

---

## Getting Started

### 1. Prerequisites

- Node.js v18+
- PostgreSQL database
- [Yarn](https://yarnpkg.com/) or [npm](https://www.npmjs.com/) (npm v10+ recommended)

---

### 2. Clone & Install

```sh
git clone https://github.com/Danities316/retailstack-pos.git
cd retailstack-pos
npm install
```

---

### 3. Backend Setup

```sh
cd apps/backend
# Copy and edit your environment variables
cp .env.example .env
# Edit .env to set DATABASE_URL, JWT_SECRET, etc.

# Run database migrations
npx prisma migrate deploy

# (Optional) Seed the database
npx prisma db seed

# Start the backend server
npm run dev
# or
npm start
```

**Environment Variables (`.env`):**
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — Secret for JWT tokens
- `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_PHONE_NUMBER` — For initial super admin seed

---

### 4. Frontend Setup

```sh
cd apps/frontend/RetailStack
# Copy and edit your environment variables
cp .env.example .env
# Set VITE_API_URL to your backend API (e.g., https://your-backend.onrender.com/api)

# Start the frontend dev server
npm run dev
```

---

### 5. Running Locally (Monorepo)

From the root:

```sh
# Start all apps in dev mode (if using turbo)
npm run dev
```

---

## Deployment

### **Backend (Render)**
- Connect your GitHub repo on [Render](https://dashboard.render.com/).
- Set root directory to `apps/backend`.
- Set environment variables (`DATABASE_URL`, `JWT_SECRET`, etc).
- Build command: `npm install`
- Start command: `npm start`

### **Frontend (Vercel)**
- Import your repo on [Vercel](https://vercel.com/).
- Set root directory to `apps/frontend/RetailStack`.
- Set environment variable `VITE_API_URL` to your Render backend URL.
- Build command: `npm run build`
- Output directory: `dist`

---

## Offline Support

- The app uses IndexedDB to cache products, categories, sales, and dashboard data.
- Offline mode works if data was previously fetched online.

---

## Scripts

From the root:
- `npm run dev` — Start all apps in dev mode
- `npm run build` — Build all apps/packages
- `npm run lint` — Lint all code

---

## License

MIT

---

**For more details, see each app’s README or the codebase.**  
**PRs and issues welcome!**
