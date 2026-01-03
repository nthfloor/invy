# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Invy is a headless, multi-tenant invoicing engine built with NestJS. It provides REST APIs for managing companies, clients, products, quotes, invoices, taxes, credit notes, and statements.

## Architecture

### Multi-Tenant Design
- All entities are scoped by `company_id` foreign key
- JWT tokens contain `company_id` for automatic request scoping
- Guards/middleware inject `company_id` into service queries to prevent cross-company data access

### Module Structure
Each domain is a separate NestJS module following Controllers → Services → Repositories pattern:
- **Company**: Multi-tenant foundation, all child entities reference this
- **Client**: Customer records per company
- **Product**: Products/services with pricing and tax references
- **Quote**: Estimates with quote_items, can convert to invoices
- **Invoice**: Core billing with invoice_items, lifecycle (Draft → Sent → Paid → Overdue)
- **Tax**: VAT/GST rates, applied per product or invoice
- **Credit Notes**: Linked to invoices for refunds/adjustments
- **Statements**: Account statements for clients

### Data Layer
- TypeORM or Prisma with PostgreSQL/MySQL
- Index `company_id` in all tables for multi-tenant query performance

### PDF Generation
- Puppeteer or pdfmake for invoices, quotes, and statements
- Templates per company for branding

## Tech Stack

- NestJS (API framework)
- TypeORM/Prisma (ORM)
- PostgreSQL/MySQL (Database)
- JWT (Authentication)
- Puppeteer/pdfmake (PDF generation)
- Docker (Deployment)
- Optional: RabbitMQ/Kafka for async PDF generation and email

## Development Commands

Once the project is scaffolded with NestJS CLI:

```bash
# Install dependencies
npm install

# Run in development mode
npm run start:dev

# Run tests
npm run test

# Run single test file
npm run test -- --testPathPattern=<pattern>

# Run e2e tests
npm run test:e2e

# Build for production
npm run build

# Lint
npm run lint
```
