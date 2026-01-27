---
type: reference
tags: [architecture, tech-stack, patterns]
---

# Apolitical Architecture Reference

This document serves as the technical context for RFC reviews. It captures architectural principles, the tech stack, established patterns, and anti-patterns to avoid.

---

## Core Principles

### Architectural Philosophy

**Functional Programming Approach (Haskell-flavoured)**
- Prefer immutability - avoid mutable state where possible
- Use pure functions - same input always produces same output, no side effects
- Leverage algebraic data types - model domain with sum and product types
- Composition over inheritance - build complex behaviour from simple functions
- Make illegal states unrepresentable through types

**Microservice Design**
- **Minimise coupling**: Services should be independently deployable
- **Maximise cohesion**: Related functionality belongs together
- **Clear boundaries**: Well-defined APIs between services
- **Single responsibility**: Each service owns one bounded context

**Clean Architecture**
- Dependencies point inward (domain at centre)
- Domain logic independent of frameworks, UI, database
- Use cases orchestrate domain objects
- Infrastructure adapts to domain interfaces

**Domain-Driven Design (DDD)**
- Ubiquitous language shared between code and business
- Bounded contexts with explicit boundaries
- Aggregates for transactional consistency
- Domain events for cross-context communication

### Code Quality Standards

**Readability Over Cleverness**
- Code is read far more than it's written
- Explicit is better than implicit
- Self-documenting code with clear names
- Comments explain "why", code explains "what"

**Strong Typing**
- Leverage the type system to catch errors at compile time
- Branded/newtype patterns for domain primitives (UserId, Email, etc.)
- Discriminated unions for state machines
- Avoid stringly-typed APIs
- Validate at boundaries, trust internally

**Data Modelling**
- Normalise data appropriately (but pragmatically)
- Schema evolution strategy for each data store
- Explicit handling of optional/nullable fields
- Consistent naming conventions across systems

### Communication Patterns

**Sync vs Async Decision Framework**
- **Sync (HTTP/gRPC)**: When caller needs immediate response, low latency required
- **Async (Events/Queues)**: When eventual consistency acceptable, decoupling needed, or fire-and-forget

**Eventual Consistency**
- Design for idempotency - operations safe to retry
- Implement compensation/saga patterns for distributed transactions
- Use outbox pattern for reliable event publishing
- Consider read-your-writes consistency where needed

**Causal Consistency**
- Track causality with vector clocks or version vectors where needed
- Ensure operations that depend on each other maintain order
- Document consistency guarantees for each API

---

## Anti-Patterns to Flag

### Design Anti-Patterns

| Anti-Pattern | Description | What to Look For |
|--------------|-------------|------------------|
| **Over-engineering** | Building for hypothetical future requirements | Excessive abstraction, "just in case" features, configurable everything |
| **Premature Optimisation** | Optimising before measuring | Complex caching without benchmarks, denormalisation without load testing |
| **Impractical Design** | Theoretically elegant but operationally painful | Requires perfect conditions, no failure handling, complex deployment |
| **Large Unknowns** | Too many unvalidated assumptions | No spike/POC for novel tech, hand-wavy performance claims |
| **Bleeding Edge Dependencies** | Relying on immature technology | <1 year old, <100 GitHub stars, single maintainer, no production users |
| **Distributed Monolith** | Microservices without the benefits | Synchronous call chains, shared databases, coordinated deployments |
| **God Service** | One service doing too much | >10 endpoints, multiple bounded contexts, frequent changes |
| **Chatty Communication** | Excessive inter-service calls | N+1 API calls, high fan-out, latency accumulation |

### Code Anti-Patterns

| Anti-Pattern | Description |
|--------------|-------------|
| **Primitive Obsession** | Using strings/ints for domain concepts instead of types |
| **Stringly Typed** | Magic strings for state, config, or routing |
| **Mutable Shared State** | Global variables, singletons with state |
| **Exception-Driven Flow** | Using exceptions for control flow |
| **Implicit Dependencies** | Hidden dependencies not in function signatures |
| **Anemic Domain Model** | Data structures with no behaviour |

---

## Tech Stack

### Languages & Frameworks

| Layer | Technology | Status | Notes |
|-------|------------|--------|-------|
| **Backend** | TypeScript, NestJS 10 | Adopt | Sequelize 6 ORM for PostgreSQL |
| **Frontend** | TypeScript, Next.js 14, React 18 | Adopt | App Router, Server Components |
| **UI Components** | Radix UI | Adopt | Mantine on Hold |
| **Data Platform** | Python 3.12+, dbt Core 1.9 | Adopt | BigQuery transformations |
| **Validation** | Zod, class-validator | Adopt | Zod for frontend, class-validator for NestJS |
| **API Contracts** | ts-rest | Trial | Contract-first API design |
| **Events** | NestJS EventEmitter | Trial | In-process event-driven patterns |
| **Monorepo** | Nx (platform), uv (data) | Adopt | Shared code and tooling |

### Data Stores

| Store | Technology | Status | Use Case |
|-------|------------|--------|----------|
| **Primary DB** | PostgreSQL (Cloud SQL) | Adopt | Application data via Sequelize |
| **Analytics** | BigQuery | Adopt | Data warehouse, dbt transformations |
| **Cache** | Redis 7 | Adopt | Session, caching |
| **Search** | Apache SolrCloud | Adopt | Full-text search |
| **Graph** | Neo4j | Assess | Relationship data |
| **Vector** | Pinecone | Assess | AI/ML embeddings |

### Data Platform Architecture

```
Raw Sources → Base Layer → Intermediate Layer → Marts/OBT/Metrics
```

- **Sources**: GA4, CloudSQL, Contentful, HubSpot, Google Sheets
- **Base Layer**: Close-to-raw with basic transformations (`dbt_base`)
- **Intermediate**: Staged transformations, often ephemeral (`dbt_intm`)
- **Marts**: Business-ready fact/dimension tables (`dbt_marts`)
- **OBT**: "One Big Table" for complex analysis (`dbt_obt`)
- **Metrics**: Derived metrics from marts/obt (`dbt_metrics`)

### Infrastructure

| Component | Technology | Notes |
|-----------|------------|-------|
| **Cloud Provider** | Google Cloud Platform (GCP) | |
| **Orchestration** | GKE (Google Kubernetes Engine) | |
| **IaC** | Terraform, Helm/Helmfile | |
| **CI/CD** | GitHub Actions | |
| **Ingress** | Traefik | |
| **Logging** | Winston + Google Cloud Logging | |
| **Tracing** | OpenTelemetry | Assess |
| **Secrets** | 1Password, GCP Secret Manager | |
| **Data Pipelines** | Cloud Composer (Airflow) | |

### External Services

| Service | Status | Purpose |
|---------|--------|---------|
| **Auth0** | Adopt | Authentication |
| **OpenFGA** | Adopt | Fine-grained authorization (Zanzibar-style) |
| **Contentful** | Adopt | Headless CMS |
| **HubSpot** | Adopt | CRM and marketing |
| **Stripe** | Trial | Payments |
| **GetStream** | Hold | Activity feeds |

---

## Established Patterns

### API Design
- **REST APIs** with NestJS controllers
- **Contract-first** approach with ts-rest (Trial) - shared types between frontend/backend
- **Authentication**: Auth0 JWT tokens
- **Authorization**: OpenFGA for fine-grained permissions (Zanzibar model)
- **Validation**: class-validator decorators on DTOs (backend), Zod schemas (frontend)

### Event Patterns
- **In-process events**: NestJS EventEmitter for decoupled service communication
- **Data events**: Changes flow through to BigQuery via scheduled syncs
- **Idempotency**: Design for safe retries, especially in data pipelines

### Testing Patterns
- **Unit tests**: Jest for TypeScript, pytest for Python
- **E2E tests**: Playwright (Adopt)
- **SQL linting**: SQLFluff for dbt models
- **Data tests**: dbt_utils, dbt_expectations for data quality

### Deployment Patterns
- **Containerized**: All services run in GKE
- **GitOps**: Helm/Helmfile for Kubernetes manifests
- **CI/CD**: GitHub Actions for build, test, deploy
- **Environments**: dev (suffix `_dev` for dbt datasets), staging, production

### Code Style Patterns

**TypeScript/JavaScript**
- ESLint + Prettier for formatting
- Strict TypeScript configuration
- Prefer functional patterns, avoid mutation

**SQL (dbt)**
- Vertical, readable formatting
- Right-justified keywords (SELECT, FROM, WHERE)
- Snake_case column names
- Explicit column selection (no `SELECT *`)
- Trailing commas
- Explicit `AS` aliases
- Table aliases required for joins

---

## Architecture Decision Records

Key architectural decisions are tracked in Notion. Notable decisions include:

| Decision | Context | Outcome |
|----------|---------|---------|
| Nx Monorepo | Manage platform-v2 complexity | Shared code, consistent tooling |
| ts-rest | Type-safe API contracts | Trial - evaluating for broader adoption |
| OpenFGA | Fine-grained authorization | Zanzibar-style permissions model |
| dbt for transformations | SQL-based data transformations | Layered architecture (base → marts) |
| BigQuery as warehouse | Analytics and reporting | All data flows to BQ for analysis |

---

## Service Inventory

### Platform (platform-v2)

| App | Purpose | Technology |
|-----|---------|------------|
| **web** | Main web application | Next.js 14, React 18 |
| **people-api** | User management, courses, communities | NestJS, Sequelize |
| **content** | Content delivery | Contentful integration |
| **search** | Search functionality | SolrCloud |

### Data Platform (data-v2)

| Component | Purpose | Technology |
|-----------|---------|------------|
| **dbt** | Data transformations | dbt-core, dbt-bigquery |
| **airflow** | Pipeline orchestration | Cloud Composer |
| **containers** | Custom ETL jobs | Python |

---

## Cross-Cutting Concerns

### Observability
- **Logging**: Winston logger → Google Cloud Logging
- **Tracing**: OpenTelemetry (Assess) for distributed tracing
- **Metrics**: GCP Monitoring
- **Alerting**: GCP alerting policies

### Security
- **Authentication**: Auth0 (JWT tokens)
- **Authorization**: OpenFGA for fine-grained access control
- **Secrets**: 1Password for team, GCP Secret Manager for runtime
- **API Security**: HTTPS, rate limiting via Traefik

### Performance
- **Caching**: Redis for session and application cache
- **Search**: SolrCloud for full-text search
- **CDN**: Content delivery for static assets
- **Database**: Cloud SQL with read replicas where needed

---

## Resources

### Internal (Notion)
- [Technology Radar](https://www.notion.so/apolitical/Technology-Radar-1e468a6e3b9280e08b01c1c1826ec562) - Adopt/Trial/Assess/Hold ratings
- [DevOps Handover](https://www.notion.so/apolitical/DevOps-Handover-2cc68a6e3b92804ea6d4cdc3352a3bef) - Infrastructure overview
- [Software Architecture](https://www.notion.so/apolitical/Software-Architecture-0afa8a6e3b9280fa83bffcd0a14ab5b8)

### GitHub Repositories
- [platform-v2](https://github.com/apolitical/platform-v2) - Main application monorepo (Nx)
- [data-v2](https://github.com/apolitical/data-v2) - Data platform (dbt, Airflow)

### External References
- [Clean Architecture - Robert Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design Reference](https://www.domainlanguage.com/ddd/reference/)
- [Microservices Patterns - Chris Richardson](https://microservices.io/patterns/)
- [Designing Data-Intensive Applications - Martin Kleppmann](https://dataintensive.net/)
- [dbt Best Practices](https://docs.getdbt.com/docs/guides/best-practices)
- [OpenFGA Documentation](https://openfga.dev/docs)

---

*Last updated: 2026-01-23*
*This document should be updated as architecture evolves*
