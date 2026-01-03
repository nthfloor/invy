# Workflow

## Before Making Changes

1. Understand the existing patterns in the codebase before implementing
2. Check if similar functionality exists that can be extended
3. For new features, consider which service owns the responsibility
4. Always present me with a plan for creating or editing files in this repo
5. While planning always review the plan and assess if there are simpler or better ways of achieving the same result 
6. Less code is more, the simpler the solution generally the better

## Development Flow

1. Start infrastructure: `docker compose up -d`
2. Build shared libs: `pnpm build:libs`
3. Start the service you're working on: `pnpm start:{service-name}`
4. Make changes with hot reload enabled
5. Write tests based on expected input/output before feature exits
6. Write only enough code to pass the tests without modifying them

## Before confirming a feature is ready

1. Run linting: `pnpm lint`
2. Run tests: `pnpm test`
3. Ensure all tests pass: `pnpm test`
4. Build to verify no TypeScript errors: `pnpm build`
5. Run typecheck: `pnpm build` (TypeScript compilation validates types)
6. Verify the service starts without errors
7. Test the feature manually if it involves API changes

## Adding New Dependencies

- Add to the specific app/lib that needs it, not the root
- Use workspace protocol for internal deps: `"@revenue-management/shared-types": "workspace:*"`
- Run `pnpm install` from the monorepo root

## Database Changes

For client-service schema changes:

1. Modify the entity in `src/client/client.entity.ts`
2. Generate migration: `pnpm --filter @revenue-management/client-service migration:generate src/migrations/DescriptiveName`
3. Review the generated migration
4. Run migration: `pnpm --filter @revenue-management/client-service migration:run`

## RabbitMQ Message Patterns

- Add new routing keys/queues to `libs/messaging/src/constants.ts`
- Define event schemas in `libs/shared-types/src/events/`
- Rebuild messaging lib after changes
