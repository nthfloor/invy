# Code Style

## Language & Syntax

- Use ES modules (`import`/`export`) syntax, not CommonJS (`require`)
- Destructure imports when possible: `import { Injectable, Logger } from '@nestjs/common'`
- Prefer `const` over `let`; never use `var`
- Use template literals for string interpolation: `` `Hello ${name}` ``
- Use SOLID & CLEAN code principles 

## TypeScript

- Enable strict mode; avoid `any` types
- Define explicit return types for public methods
- Use interfaces for object shapes; use types for unions/intersections
- Prefer `unknown` over `any` when type is truly unknown
- Use branded types for domain IDs: `type ClientId = string & { readonly __brand: 'ClientId' }`

## Function Parameters

- Use destructured object parameters for all functions (see [ADR-002](../../docs/adr/002-named-parameters.md))
- Even single-parameter functions use this pattern for consistency
- NestJS decorator-driven methods are exempt (framework requirement)
- Extract named interfaces for complex or reused parameter sets

```typescript
// Correct
async findById({ id }: { id: string }): Promise<Client> { }

async create({
  dto,
  userId,
  companyId,
}: {
  dto: CreateClientDto;
  userId: string;
  companyId: string;
}): Promise<Client> { }

// Incorrect - positional parameters
async findById(id: string): Promise<Client> { }
async create(dto: CreateClientDto, userId: string, companyId: string): Promise<Client> { }
```

## NestJS Conventions

- One class per file; filename matches class name in kebab-case
- Module files: `{feature}.module.ts`
- Controllers: `{feature}.controller.ts` with `@Controller('{feature}')` decorator
- Services: `{feature}.service.ts` with `@Injectable()` decorator
- DTOs: `{action}-{feature}.dto.ts` (e.g., `create-client.dto.ts`)
- Use constructor injection for dependencies
- Prefer `private readonly` for injected dependencies

## Formatting

- Adhere to the Airbnb style guide for JavaScript/TypeScript
- Use Prettier with default settings (2 spaces, single quotes, trailing commas)
- Max line length: 100 characters
- Use meaningful variable names; avoid abbreviations except well-known ones (dto, id, url)

## Error Handling

- Throw NestJS HTTP exceptions (`NotFoundException`, `BadRequestException`, etc.) in controllers
- Use custom domain exceptions in services when appropriate
- Always include meaningful error messages
- Log errors with context (correlation ID, operation, relevant IDs)

## Comments & Documentation

- Use JSDoc for public APIs and complex functions
- Prefer self-documenting code over comments
- Add comments only for non-obvious logic or business rules
- Keep TODO comments actionable with context

## Testing

- Test files live in `tests/` directory, mirroring `src/` structure
- Name test files `{feature}.spec.ts`
- Use descriptive `describe` and `it` blocks
- Follow AAA pattern: Arrange, Act, Assert
- Mock external dependencies; don't mock internal implementation details
