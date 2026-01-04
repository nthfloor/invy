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
2. Start the development server: `npm run start:dev`
3. Make changes with hot reload enabled
4. Write tests based on expected input/output before feature exits
5. Write only enough code to pass the tests without modifying them

## Before confirming a feature is ready

1. Run linting: `npm run lint`
2. Run tests: `npm run test`
3. Ensure all tests pass: `npm run test`
4. Build to verify no TypeScript errors: `npm run build`
5. Run typecheck: `npm run build` (TypeScript compilation validates types)
6. Verify the service starts without errors
7. Test the feature manually if it involves API changes

## Adding New Dependencies

- Use `npm install <package>` to add dependencies
- Use `npm install -D <package>` for dev dependencies
- Run `npm install` after pulling changes

## Database Changes

For schema changes:

1. Modify the entity in `src/{module}/{entity}.entity.ts`
2. Generate migration: `npm run migration:generate -- src/migrations/DescriptiveName`
3. Review the generated migration
4. Run migration: `npm run migration:run`

## API Token Management

- Generate new tokens: `npm run generate-token "Token Description"`
- Tokens are stored hashed in the database
- Token format: `invy_xxxxxxxxxxxx`
