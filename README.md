# Invy - Headless Invoicing Engine

## Overview

Invy is a standalone, API-first invoicing microservice built with NestJS. Designed for backend-to-backend integration, it provides complete invoicing capabilities without the overhead of a full accounting system.

## Why Invy?

| Feature | Invy | Invoice Ninja | Stripe Invoicing |
|---------|------|---------------|------------------|
| Self-hosted | Yes | Yes | No |
| API-first design | Yes | Partial | Yes |
| No UI overhead | Yes | No | Yes |
| Quote/Estimate support | Yes | Yes | No |
| Custom branding | Yes | Yes | Limited |
| Simple auth (API tokens) | Yes | No (requires users) | No |
| Microservice-ready | Yes | No | No |

## Key Features

- **Companies** - Multi-tenant support with per-company settings
- **Clients** - Customer management with external ID sync
- **Products** - Product catalog with tax associations
- **Taxes** - Configurable tax rates per company
- **Invoices** - Full lifecycle (draft -> sent -> viewed -> partial -> paid)
- **Quotes & Estimates** - Fixed-price quotes and variable estimates with conversion to invoices
- **PDF Generation** - Professional documents with company branding (Phase 2)

## Project Structure

This is a pnpm monorepo with two applications:

```
/Invy
├── apps/
│   ├── api/      # NestJS backend (Lambda-deployable)
│   └── webapp/   # SvelteKit frontend (S3/CloudFront)
├── pnpm-workspace.yaml
└── package.json
```

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- pnpm 9+

### Installation

```bash
pnpm install
```

### Configuration

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### Database Setup

```bash
npm run migration:run
```

### Generate API Token

```bash
npm run generate-token "My API Token"
# Save the generated token - it cannot be retrieved later
```

### Start Server

```bash
npm run start:dev
```

### API Documentation

Once running, visit: http://localhost:3010/api/docs

## API Authentication

All endpoints require Bearer token authentication:

```
Authorization: Bearer invy_xxxxxxxxxxxx
```

Generate tokens using the CLI:

```bash
npm run generate-token "Production API"
npm run generate-token "Staging API"
```

Tokens are hashed before storage - save them immediately as they cannot be retrieved later.

## Scripts

### Development

```bash
pnpm dev              # Start API in dev mode
pnpm dev:api          # Start API in dev mode
pnpm dev:webapp       # Start webapp in dev mode
```

### Build

```bash
pnpm build            # Build all packages
pnpm build:api        # Build API only
pnpm build:webapp     # Build webapp only
```

### Deployment

```bash
pnpm deploy:api:dev      # Deploy API to Lambda (dev stage)
pnpm deploy:api:prod     # Deploy API to Lambda (prod stage)
pnpm deploy:webapp:dev   # Build and sync webapp to S3 (dev)
pnpm deploy:webapp:prod  # Build and sync webapp to S3 (prod)
pnpm deploy:all:dev      # Deploy both API and webapp (dev)
pnpm deploy:all:prod     # Deploy both API and webapp (prod)
```

**What the deploy commands do:**

- **API deployment** (`deploy:api:*`): Builds the NestJS app, bundles it with esbuild, and deploys to AWS Lambda using Serverless Framework. The API runs as a single Lambda function (mono-lambda pattern) with API Gateway routing all requests.

- **Webapp deployment** (`deploy:webapp:*`): Builds the SvelteKit app as a static site, then syncs the output to an S3 bucket. The `--delete` flag removes old files not in the new build. Serve via CloudFront for production.

### Other Commands

```bash
pnpm test             # Run API tests
pnpm lint             # Lint all packages
pnpm clean            # Remove node_modules and build artifacts
```

## Architecture

Invy is designed as a standalone microservice that can integrate with other services via:

- **REST API** - Primary interface for all operations
- **Webhooks** - Event notifications (Phase 4)
- **Message queues** - RabbitMQ integration for async operations (Phase 5)

## License

Proprietary - Nathan Floor
