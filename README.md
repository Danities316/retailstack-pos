<<<<<<< HEAD
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
=======
# Turborepo starter

This Turborepo starter is maintained by the Turborepo core team.

## Using this example

Run the following command:

```sh
npx create-turbo@latest
```

## What's inside?

This Turborepo includes the following packages/apps:

### Apps and Packages

- `docs`: a [Next.js](https://nextjs.org/) app
- `web`: another [Next.js](https://nextjs.org/) app
- `@repo/ui`: a stub React component library shared by both `web` and `docs` applications
- `@repo/eslint-config`: `eslint` configurations (includes `eslint-config-next` and `eslint-config-prettier`)
- `@repo/typescript-config`: `tsconfig.json`s used throughout the monorepo

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Build

To build all apps and packages, run the following command:

```
cd my-turborepo
pnpm build
```

### Develop

To develop all apps and packages, run the following command:

```
cd my-turborepo
pnpm dev
```

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use a technique known as [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

```
cd my-turborepo
npx turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

```
npx turbo link
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turborepo.com/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.com/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.com/docs/reference/configuration)
- [CLI Usage](https://turborepo.com/docs/reference/command-line-reference)
>>>>>>> f3fdb7e (Initial commit)
