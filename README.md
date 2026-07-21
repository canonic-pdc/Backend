# Canonic Backend Architecture

This is the backend API layer for the **Canonic** vehicle management and operations system. It is designed to act as a secure, modular, and highly scalable companion serving the React + TypeScript frontend application.

The project is structured following clean coding paradigms (SOLID, DRY, KISS) and utilizes a modular **Feature-First Architecture** to facilitate quick, friction-free onboarding and development.

---

## Table of Contents

1. [Project Overview & Purpose](#project-overview--purpose)
2. [Technology Stack](#technology-stack)
3. [Architecture & Folder Structure](#architecture--folder-structure)
4. [Design Principles](#design-principles)
5. [Development Workflow](#development-workflow)
6. [Available Scripts](#available-scripts)
7. [Environment Variables](#environment-variables)
8. [API & Feature Routing Structure](#api--feature-routing-structure)
9. [Coding Standards](#coding-standards)
10. [How to Add New Features](#how-to-add-new-features)
11. [Future Integration Roadmap](#future-integration-roadmap)

---

## Project Overview & Purpose

The Canonic backend serves as the core orchestration and data-access layer for vehicle tracking, SOP management, ordinance rules, reconciliation, and authentication. It keeps runtime dependencies isolated from the frontend and communicates strictly over versioned JSON HTTP APIs.

Its primary purpose is to provide:
- A standardized REST API interface for vehicle operations.
- Operational abstractions for database (Firestore), storage, and logging.
- Authentication filters (JWT / Firebase Auth integration placeholder).
- Resilient operational controls like global exception filters and graceful shutdowns.

---

## Technology Stack

- **Runtime**: Node.js (v20+)
- **Application Framework**: Express.js (v4.x)
- **Programming Language**: TypeScript (v5.x, strict typing enabled)
- **Linter & Formatter**: ESLint (v9.x), Prettier (v3.x)
- **Package Manager**: npm

---

## Architecture & Folder Structure

The project implements a **Feature-First Architecture** combined with a layered configuration and infrastructure setup:

```text
backend/
├── src/
│   ├── app.ts                 # Express app initialization & middleware registration
│   ├── server.ts              # Server bootstrap, exception traps, and graceful shutdown
│   │
│   ├── config/                # Central config files reading from environment variables
│   │   ├── index.ts           # Unified configuration aggregator
│   │   ├── api.config.ts
│   │   ├── app.config.ts
│   │   ├── cors.config.ts
│   │   ├── firebase.config.ts
│   │   └── logging.config.ts
│   │
│   ├── features/              # Feature modules containing domain specific code
│   │   └── automation/        # Schema automation, version checking, and API key management
│   │       ├── controllers/   # Request/response controllers
│   │       ├── services/      # Core business logic handlers (schemaGenerator, apiKey)
│   │       ├── routes/        # Router configuration mapping paths to controllers
│   │       └── types/         # Domain-specific DTOs and TypeScript interfaces
│   │
│   ├── routes/                # Central route aggregates (mounting /api/v1/...)
│   │   └── v1/
│   │       ├── auth.routes.ts
│   │       ├── collections.routes.ts # Dynamic PDC & vehicle management across root collections
│   │       ├── export.routes.ts
│   │       ├── health.routes.ts
│   │       ├── ordinance.routes.ts   # SOP and rules management
│   │       ├── reconciliation.routes.ts
│   │       ├── system.routes.ts
│   │       ├── users.routes.ts       # User management and role assignment
│   │       └── vehicles.routes.ts
│   │
│   ├── shared/                # Shared utilities, error types, and middleware layers
│   │   ├── constants/         # HTTP status codes
│   │   ├── errors/            # Custom AppError classes (BadRequest, Conflict, NotFound, etc.)
│   │   ├── middleware/        # Error handlers, request logging, authentication (requireAuth)
│   │   ├── responses/         # Unified JSON response formatters
│   │   ├── types/             # Shared TypeScript typings and Firestore schema contracts
│   │   └── utils/             # Helper utilities (asyncHandler, cache, concurrency)
│   │
│   └── infrastructure/        # Core adapters and third-party API configurations
│       ├── firebase/          # Firebase Service singleton (Firestore & Auth Admin SDK)
│       ├── storage/           # Cloud Storage providers
│       ├── logger/            # Console/Winston logger abstraction
│       └── external-services/ # Outgoing integrations
```

---

## Design Principles

1. **Separation of Concerns**: Business logic is restricted to services. Controllers handle routing/payload mapping, and repositories govern database operations.
2. **SOLID Principles**: Single responsibility classes, interface-based adapters, and dependency-injection-friendly constructs.
3. **Fail Safe (Graceful Shut Down)**: Traps `SIGTERM`/`SIGINT` signals, rejects incoming connections, closes connection pools, and exits without leaving hanging handles.
4. **Strong Typing & Safety**: Employs strict TypeScript configuration. Explicitly restricts type coercions or unnecessary `any` overrides.

---

## Development Workflow

1. **Environment Setup**: Copy `.env.example` to `.env` and fill in local configurations.
2. **Dependency Installation**: Run `npm install` to download dependencies.
3. **Execution**: Start the server in hot-reload mode using `npm run dev`.
4. **Validation**: Before committing, execute `npm run lint` and `npm run typecheck` to verify code quality.

---

## Available Scripts

In the backend root directory, the following scripts are available:

- `npm run dev`: Starts the application in development mode with `nodemon` and `ts-node` using path alias support.
- `npm run build`: Compiles TypeScript source files into output JavaScript files under `dist/` and runs `tsc-alias` to resolve path imports.
- `npm run start`: Runs the built production server using the compiled files (`node dist/server.js`).
- `npm run lint`: Performs lint checking across the codebase.
- `npm run lint:fix`: Fixes auto-resolvable formatting and lint issues.
- `npm run typecheck`: Performs static TypeScript type validation check without generating output files.
- `npm test`: Placeholder script for running unit tests.

---

## Environment Variables

Configure these values in your `.env` file (see `.env.example` for details):

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Local host port mapping for the Express web server | `8000` |
| `NODE_ENV` | Environment identifier (e.g. `development`, `production`) | `development` |
| `API_PREFIX` | Versioned route mounting path prefix | `/api/v1` |
| `CORS_ORIGIN` | Allowed clients list mapped for CORS permissions | `http://localhost:5173` |
| `LOG_LEVEL` | Log filtering verbosity (e.g. `debug`, `info`, `error`) | `debug` |

---

## API & Feature Routing Structure

All API routes are structured version-specifically under `/api/v1`. Currently, placeholder routes are active representing the primary business domains:

| Route Path | Description | Access | Auth Required |
|------------|-------------|--------|----------------|
| `/health` | Server uptime status and environments checker | Public | No |
| `/auth/login` | Exchanges user credentials for token/profile | Public | No |
| `/auth/logout` | Disables token session | Public | No |
| `/auth/me` | Fetches active user profile | Private | Yes |
| `/collections/:collectionName` | Retrieves list of all PDCs inside a root collection | Public / Cache | No (GET) / Yes (POST) |
| `/collections/:collectionName/pdc/:pdcName` | Deep details and update/delete for specific PDC & vehicles | Public / Private | No (GET) / Yes (PUT/DELETE) |
| `/users` | Lists users and manages role/profile administration | Private | Yes (Admin) |
| `/automation/schema/check-version` | Checks version metadata and returns on-demand schema JSON | Private | Yes (API Key/Token) |
| `/automation/keys` | Generates or regenerates API keys for automation devices | Private | Yes |
| `/automation/users/:userId/reset-device` | Resets device binding for target user | Private | Yes (Admin) |
| `/ordinance` | Pulls and manages ordinance SOP rules | Private | Yes |
| `/vehicles` | Fetches registered inventory list / Adds vehicles | Private | Yes |
| `/reconciliation` | Retrieves reports list containing audit matches | Private | Yes |
| `/export/csv` | Initiates export task runner | Private | Yes |
| `/system/info` | Retrieves server node capabilities details | Private | Yes |

---

## Coding Standards

- **File Naming**: Use camelCase for standard modules and helper functions. Use kebab-case for middleware (`error-handler.middleware.ts`) and routes (`auth.routes.ts`).
- **Interfaces vs Types**: Use `interface` for structural service and class contracts. Use `type` for simple data containers, request bodies, or aliases.
- **Error Handling**: Never use raw status codes in controllers. Throw appropriate shared errors (e.g., `BadRequestError`, `UnauthorizedError`, `ConflictError`, `NotFoundError`) and handle formatting automatically in `errorHandler`.
- **Validation**: Payload sanitization and data validation are handled cleanly inside route handlers and domain controllers with explicit TypeScript casting and error trapping.

---

## How to Add New Features

Follow these steps to expand the backend with a new business domain (e.g., `reports`):

1. **Create Feature Folder**: Add a new folder `src/features/reports` containing all feature sub-folders (`controllers`, `services`, etc.).
2. **Define Routes**: Create routes under `src/features/reports/routes/reports.routes.ts`.
3. **Register Route in central V1 Router**: Add the router inside `src/routes/v1/index.ts`:
   ```typescript
   import reportsRoutes from '@features/reports/routes/reports.routes';
   router.use('/reports', reportsRoutes);
   ```
4. **Implement Business Logic**: Fill in services and repositories in your feature folder to interact with the database.

---

## Future Integration Roadmap

- [x] **Firebase Authentication**: Firebase Admin verification active within the `requireAuth` middleware inspecting incoming Bearer/ID tokens.
- [x] **Firestore Database Client**: Singleton `FirebaseService` initializes Firestore Admin SDK connecting repositories and routes directly with cloud collections.
- [ ] **Rate Limiting**: Hook up standard security limiters to prevent API route scraping.

---

## Deployment (Vercel)

This application is fully pre-configured for serverless deployment on **Vercel** using `@vercel/node`.

### 1. Configuration Files
- `api/index.ts`: The serverless handler entry point that exports the Express `app` instance directly.
- `vercel.json`: Vercel routing settings redirecting all incoming HTTP traffic (`/(.*)`) directly to the serverless entry point `api/index.ts`.
- `.vercelignore`: Excludes local compilation folders (`dist`, `node_modules`) to optimize function package sizes.

### 2. Environment Variables on Vercel
In your Vercel Project Dashboard under **Settings -> Environment Variables**, configure:
- `NODE_ENV`: `production`
- `API_PREFIX`: `/api/v1`
- `CORS_ORIGIN`: Comma-separated list of allowed frontend URLs (e.g., `https://canonic-pdc.vercel.app,http://localhost:5173`) or `*`.
- `LOG_LEVEL`: `info`

### 3. How to Deploy
1. **Via Vercel CLI**:
   ```bash
   npx vercel
   ```
2. **Via Git Integration**:
   Connect your GitHub/GitLab repository to Vercel and set the Root Directory to `Backend`. Vercel will automatically build and deploy every commit using the included `vercel.json` configuration.
