# 🚀 Backend — Work Simulator

<div align="center">

**A modern, production-ready Node.js backend built with best practices, TypeScript, and a scalable architecture.**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)

</div>

> This is the `backend/` app inside the [Work Simulator monorepo](../README.md). For git hooks, CI, and overall repo structure, see the [root README](../README.md) and [`docs/SETUP.md`](../docs/SETUP.md).

---

## ✨ Features

- ⚡ **Node.js + Express 5**
- 🔷 **TypeScript** with strict typing
- 🗄️ **Prisma ORM**
- 🐘 **PostgreSQL**
- ✅ **Zod** request validation
- 🔐 **JWT auth** — short-lived access token + long-lived, rotating refresh token, both set as **httpOnly cookies**
- 🔒 **Password hashing** with bcrypt
- 📋 **Pino** structured logging
- 🧪 **Vitest** testing setup
- 🎨 **ESLint + Prettier**
- 📦 Clean and scalable folder structure
- 🚀 Ready for production deployment

---

# 🛠 Tech Stack

| Technology | Purpose |
|------------|---------|
| **Node.js** | Runtime |
| **Express** | Web Framework |
| **TypeScript** | Programming Language |
| **Prisma** | ORM |
| **PostgreSQL** | Database |
| **Zod** | Validation |
| **JWT** | Authentication |
| **bcrypt** | Password Hashing |
| **Pino** | Logging |
| **Vitest** | Testing |
| **ESLint** | Linting |
| **Prettier** | Code Formatting |

*(Husky lives at the monorepo root now, not here — see the [root README](../README.md).)*

---

# 📂 Project Structure

```text
src/
├── config/          # Environment & database configuration
├── constants/       # HTTP status codes and application constants
├── controllers/     # Request handlers (auth.controller.ts so far)
├── middlewares/     # Express middlewares (auth, validation, rate limiting, errors)
├── routes/          # API routes (auth.routes.ts so far)
├── schemas/         # Zod validation schemas (auth.schema.ts so far)
├── services/        # Business logic (auth.service.ts so far)
├── types/           # TypeScript types
└── utils/           # Helper utilities (jwt, cookies, hashing, API response shapes)
```

> **Note on the repo layer:** you'll notice `services/auth.service.ts` calls Prisma directly instead of going through a repository. That's deliberate — the repo layer pattern hasn't been decided yet. See the comment at the top of that file before adding a new pattern.

---

# 🚀 Getting Started

This app lives inside the Work Simulator monorepo. If you haven't already, clone the whole repo and run the root install first — it also sets up the shared git hooks:

```bash
git clone <monorepo-url>
cd work-simulator
npm run install:all
```

Then from here on, everything below runs from inside `backend/`:

```bash
cd backend
```

---

## 1. Configure Environment Variables

Copy the example environment file.

```bash
cp .env.example .env
```

Update the values inside `.env` — in particular, generate your own `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` (two **different** long random strings):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 2. Start PostgreSQL

```bash
docker compose up -d
```

---

## 3. Generate Prisma Client

```bash
npm run prisma:generate
```

---

## 4. Run Database Migrations

```bash
npm run prisma:migrate
```

---

## 5. Start the Development Server

```bash
npm run dev
```

The server should now be running successfully.

---

# 📜 Available Scripts

| Command | Description |
|----------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Compile TypeScript |
| `npm run start` | Run compiled application |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code using Prettier |
| `npm run test` | Run tests |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Apply database migrations |

---

# 🌱 Environment Variables

Create a `.env` file using the provided example.

```bash
cp .env.example .env
```

See **`.env.example`** for all required configuration values.

---

# 📦 Production Build

Build the application:

```bash
npm run build
```

Run the compiled application:

```bash
npm run start
```

---

# 🧪 Testing

Run all tests:

```bash
npm run test
```

---

# 🎨 Code Quality

Lint the project:

```bash
npm run lint
```

Format the project:

```bash
npm run format
```

---

# 🗄 Database

Generate Prisma Client:

```bash
npm run prisma:generate
```

Run migrations:

```bash
npm run prisma:migrate
```

---

# 🔐 Authentication

Access and refresh tokens are issued as **httpOnly cookies** — never returned in a JSON response body, and never readable by frontend JS. This is deliberate: it keeps tokens safe from theft via an XSS bug in the frontend.

| Endpoint | What it does |
|---|---|
| `POST /api/v1/auth/register` | Creates a user, logs them in (sets cookies) |
| `POST /api/v1/auth/login` | Validates credentials, sets cookies |
| `POST /api/v1/auth/refresh` | Reads the refresh cookie, **rotates** it (old one is revoked, a new pair is issued) |
| `POST /api/v1/auth/logout` | Revokes the refresh token, clears both cookies |
| `GET /api/v1/auth/me` | Requires a valid access token; returns the current user |

A few things worth knowing before you touch this:

- **Refresh tokens are stored hashed** in the `RefreshToken` table (never the raw token), specifically so they can be revoked — logout, or reuse detection, actually mean something instead of just trusting any signature-valid JWT until it expires.
- **Rotation**: every successful `/auth/refresh` call kills the old refresh token and issues a brand new one. A refresh token is single-use.
- **Cookie settings are environment-aware** (see `src/utils/cookies.ts`): `SameSite=Lax` locally (frontend and backend are both `localhost`, just different ports — same-site), `SameSite=None; Secure` in production (frontend and backend are on different domains).
- The `register`/`login` implementation here is a **working reference, not a finished feature** — it exists so the cookie/refresh mechanism is testable end to end. Replace it with your real validation rules and user model as those get decided.

---

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create a new branch
3. Commit your changes
4. Open a Pull Request

---

# 📄 License

This project is licensed under the **MIT License**.

---

<div align="center">

### ⭐ If this template helps you, consider giving it a star!

**Happy Coding! 🚀**

</div>