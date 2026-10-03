# Repository Instructions

These rules apply repository-wide to the Salon Booking and Appointment System.

## Project Stack

### Backend

- Node.js
- TypeScript
- Express.js
- PostgreSQL
- Prisma ORM
- Zod

### Frontend

- React
- TypeScript
- Vite

## Engineering Rules

- Do not modify established business rules without explicit instruction.
- Do not implement features outside the current task.
- Keep controllers thin.
- Put business logic in services.
- Validate external inputs.
- Use Prisma transactions for multi-record business operations.
- Use Decimal/Numeric values for persisted money.
- Preserve historical transactional data.
- Prefer deactivation instead of deleting referenced business records.
- Write tests for business-critical behavior.
- Run relevant validation and tests after implementation.
- Do not automatically proceed to another roadmap task.

## Document Authority

- `docs/SYSTEM_RULES.md` controls domain/business behavior.
- `docs/DATABASE_MODEL.md` controls database entities and relationships.
- `docs/ARCHITECTURE.md` controls architectural boundaries.
- `docs/ROADMAP.md` controls implementation sequence.
- `docs/DECISIONS.md` records important architectural decisions.

AppointmentService will eventually be the authoritative staff scheduling unit. Do not implement any models during this repository setup task.
