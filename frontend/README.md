# ⚛️ template-react

> **A production-ready React SPA starter built for serious applications.**
> Modern tooling, scalable architecture, and sensible defaults—so you can focus on building features instead of configuring infrastructure.

---

## ✨ Features

* ⚡ **Vite** for lightning-fast development and builds
* 🔷 **TypeScript** for type-safe development
* 🎨 **Tailwind CSS v4** with **shadcn/ui** and Radix UI primitives
* 🔄 **TanStack Query** for server-state management
* 🧠 **Zustand** for lightweight client-state management
* 🌐 **Axios** with centralized configuration and interceptors
* 🛣️ **React Router v7** with lazy-loaded routes
* 📝 **React Hook Form + Zod** for robust forms and validation
* 🧪 **Vitest + React Testing Library** for testing
* 🧹 **ESLint + Prettier + lint-staged** for consistent, automated code quality (git hooks that trigger it live at the monorepo root — see below)
* 📦 Opinionated folder structure designed for long-term scalability

---

# 🛠 Tech Stack

| Category      | Technology                     |
| ------------- | ------------------------------ |
| Build Tool    | Vite                           |
| Language      | TypeScript                     |
| Styling       | Tailwind CSS v4                |
| UI Components | shadcn/ui + Radix UI           |
| Routing       | React Router v7                |
| Server State  | TanStack Query                 |
| Client State  | Zustand                        |
| HTTP Client   | Axios                          |
| Forms         | React Hook Form                |
| Validation    | Zod                            |
| Testing       | Vitest + React Testing Library |
| Linting       | ESLint                         |
| Formatting    | Prettier                       |
| Git Hooks     | Husky + lint-staged *(configured here, run from the monorepo root)* |

---

> This is the `frontend/` app inside the [Work Simulator monorepo](../README.md). For git hooks, CI, and overall repo structure, see the [root README](../README.md) and [`docs/SETUP.md`](../docs/SETUP.md).

---

# 🚀 Perfect For

This template is designed specifically for authenticated Single Page Applications.

Ideal for:

* SaaS products
* Internal company tools
* Admin dashboards
* Analytics platforms
* CRM systems
* Data visualization applications
* Management portals

---

## ❌ Not Recommended For

Use another starter (such as a Next.js template) if your project requires:

* SEO
* Server-side rendering (SSR)
* Static site generation (SSG)
* Server Actions
* Public marketing websites

---

# 📦 Getting Started

## Prerequisites

* Node.js **20.x**

The repository includes an `.nvmrc` file.

---

## Installation

This app lives inside the Work Simulator monorepo. If you haven't already, clone the whole repo and run the root install first — it also sets up the shared git hooks:

```bash
git clone <monorepo-url>
cd work-simulator
npm run install:all
```

Then from here on, everything below runs from inside `frontend/`:

```bash
cd frontend
cp .env.example .env
```

---

## Configure Environment Variables

Edit your `.env` file.

```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_APP_NAME=MyApp
VITE_APP_ENV=development
```

All browser-exposed variables **must** begin with:

```
VITE_
```

Environment variables are validated using **Zod** during application startup.

---

## Start Development

```bash
npm run dev
```

Open:

```
http://localhost:5173
```

---

# 📜 Available Scripts

| Command           | Description                         |
| ----------------- | ----------------------------------- |
| `npm run dev`     | Start Vite development server       |
| `npm run build`   | Type-check and build for production |
| `npm run preview` | Preview production build locally    |
| `npm run lint`    | Run ESLint                          |
| `npm run format`  | Format project with Prettier        |
| `npm run test`    | Run Vitest                          |

---

# 📁 Project Structure

```text
src/
├── assets/
│
├── components/
│   ├── ui/
│   ├── common/
│   └── layouts/
│
├── config/
│   └── env.ts
│
├── constants/
│
├── hooks/
│
├── lib/
│   ├── axios.ts
│   ├── queryClient.ts
│   └── utils.ts
│
├── pages/
│
├── routes/
│
├── store/
│
├── styles/
│
├── types/
│
├── utils/
│
├── App.tsx
└── main.tsx


tests/
├── setup.ts
├── index.test.tsx
└── ...
```

---

# 🏗 Architecture Principles

This template intentionally enforces a few rules to keep applications maintainable.

## 1. Use the configured Axios instance

✅ Correct

```ts
import axios from "@/lib/axios";
```

❌ Never

```ts
import axios from "axios";
```

The configured instance automatically handles:

* Sending the httpOnly auth cookies on every request (`withCredentials`)
* Unwrapping the backend's response envelope
* Silent token refresh + retry on a 401 (see "🔐 Authentication Strategy" below)
* Global logout-on-expired-session handling

---

## 2. Never fetch data inside `useEffect`

Instead of

```tsx
useEffect(() => {
  fetchUsers();
}, []);
```

Use TanStack Query.

```tsx
const { data } = useQuery(...);
```

Benefits:

* Automatic caching
* Background refetching
* Loading states
* Error handling
* Cache invalidation
* Request deduplication

---

## 3. Never access `import.meta.env`

Always import:

```ts
import { env } from "@/config/env";
```

This guarantees all environment variables are validated before the application runs.

---

## 4. Separate Server State from Client State

### TanStack Query

Use for:

* Users
* Products
* Orders
* API responses
* Remote data

### Zustand

Use for:

* Authentication
* Theme
* Sidebar state
* Modal state
* UI preferences

A simple rule:

> **If it comes from your backend, use TanStack Query. If it belongs only to the UI, use Zustand.**

---

## 5. Mirror Test Structure

Every file inside `src` should have its equivalent test inside `tests`.

Example:

```text
src/hooks/useAuth.ts

↓

tests/hooks/useAuth.test.ts
```

---

# 🔐 Authentication Strategy

Authentication uses **httpOnly cookies**, set by the backend — not `localStorage`.

The access and refresh tokens are never readable by frontend JavaScript. This app's Zustand store (`useAuthStore`) only holds a `user` object for rendering the UI immediately — it is **not** the source of truth for whether someone is actually logged in; the cookie + backend decide that.

Because the token isn't client-readable, the app can't just check "is there a token in storage" on load. Instead:

* `useSessionBootstrap` calls `GET /auth/me` once when the app starts, to ask the backend whether the cookie is still valid, and syncs `user` accordingly
* `App.tsx` waits for that check before rendering the router, so a logged-in user doesn't see a flash of the login page on every hard refresh
* `lib/axios.ts`'s response interceptor watches for a `401`, tries `POST /auth/refresh` once (relying on the httpOnly refresh cookie), and retries the original request — if that also fails, the session really is over and the user is signed out

Why this instead of `localStorage`:

* `localStorage` tokens are readable by any JS running on the page — including injected JS from an XSS bug. httpOnly cookies aren't readable by JS at all, which removes that entire theft vector.
* The trade-off is complexity: you need a backend that issues/rotates the tokens as cookies (see `backend/README.md`'s Authentication section), CORS configured with an exact origin + `credentials: true`, and the session-bootstrap dance above instead of a simple "read token from storage" check.

If you're cloning this template for a project where the backend can't support cookie-based auth, you'd swap this for a `localStorage`-based approach instead — but that's a real security trade-off, not a neutral default; know what you're giving up before choosing it.

---

# 🎨 Adding shadcn/ui Components

Components are copied directly into your project.

```bash
npx shadcn@latest add button
```

Multiple components:

```bash
npx shadcn@latest add input dialog sheet table
```

Because the source code is owned by your project, customization is simple.

---

# 🧪 Testing

Run the complete test suite:

```bash
npm run test
```

Technology stack:

* Vitest
* React Testing Library
* jsdom

Tests should mirror the source directory structure.

---

# 🚦 Routing & Code Splitting

Pages are lazy-loaded using:

* `React.lazy()`
* `Suspense`

This keeps the initial bundle small and improves loading performance as the application grows.

Every page component should use a **default export**.

---

# 🚫 Keep This Template Generic

This repository is intended to be cloned for future projects.

Avoid committing:

* Business logic
* Domain models
* Project-specific API endpoints
* Customer data
* Hardcoded application content

> **Exception, and why:** this copy of the template *does* include a working reference auth flow (see "🔐 Authentication Strategy" above and `backend/README.md`), instead of leaving httpOnly cookie auth as an unimplemented option like the original generic template did. That was a deliberate call for this project, so the cookie/refresh mechanism is actually testable rather than theoretical. Treat the auth implementation as infrastructure you can extend (real user model, real validation rules) — not as an example of "business logic belongs in the cloned project" being ignored. If you fork this back into a truly generic template later, that's the piece to reconsider.

Infrastructure belongs here.

Business logic belongs in the cloned project.

---

# 💡 Design Philosophy

This template favors:

* Simplicity over cleverness
* Convention over configuration
* Scalability over shortcuts
* Readability over abstraction
* Explicit architecture over hidden magic

The goal is to provide a foundation that remains maintainable whether your application has **5 pages or 500**.

---

# 🤝 Contributing

Contributions are welcome.

If you find an issue or have an idea for improvement:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a pull request

---

# 📄 License

This project is licensed under the **MIT License**.

---

<div align="center">

### Built with ❤️ using React, TypeScript, and modern frontend tooling.

**Clone. Build. Ship.**

</div>
