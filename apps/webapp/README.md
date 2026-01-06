# Invy Webapp

Invoice management web application built with SvelteKit 2 and Svelte 5.

## Tech Stack

- SvelteKit 2 with Svelte 5 (runes)
- TailwindCSS 4
- TypeScript

## Development

```bash
pnpm dev
```

## Environment

Requires `.env` file at monorepo root with:
- `VITE_API_URL` - API base URL (default: http://localhost:3000)

## Structure

- `src/routes/(app)/` - Authenticated app routes
- `src/routes/(auth)/` - Login/signup routes
- `src/lib/api/` - API client
- `src/lib/components/` - Shared components
- `src/lib/stores/` - Svelte stores

## Deployment

The webapp is built as a static site and deployed to S3/CloudFront.

### Build for Production

```bash
pnpm build:webapp
```

### Deploy to AWS

```bash
# Development environment
pnpm deploy:webapp:dev

# Production environment
pnpm deploy:webapp:prod
```

This will:
1. Build the SvelteKit app as a static site
2. Sync the output to an S3 bucket
3. The `--delete` flag removes old files not in the new build

For production, serve via CloudFront for caching and HTTPS.
