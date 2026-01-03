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

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Installation

```bash
npm install
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

```bash
npm run start:dev       # Development with hot reload
npm run start:prod      # Production mode
npm run build           # Build for production
npm run lint            # Run ESLint
npm run test            # Unit tests
npm run test:e2e        # End-to-end tests
npm run generate-token  # Generate API token
npm run migration:run   # Run migrations
npm run migration:generate  # Generate migration
```

## Architecture

Invy is designed as a standalone microservice that can integrate with other services via:

- **REST API** - Primary interface for all operations
- **Webhooks** - Event notifications (Phase 4)
- **Message queues** - RabbitMQ integration for async operations (Phase 5)

## License

Proprietary - Nathan Floor
