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

> **TODO**: Fill in with actual Apolitical systems

### Languages & Frameworks

| Layer | Technology | Notes |
|-------|------------|-------|
| Backend | | |
| Frontend | | |
| Mobile | | |
| Infrastructure | | |

### Data Stores

| Store | Technology | Use Case |
|-------|------------|----------|
| Primary DB | | |
| Cache | | |
| Search | | |
| Queue/Events | | |

### Infrastructure

| Component | Technology |
|-----------|------------|
| Cloud Provider | |
| Orchestration | |
| CI/CD | |
| Monitoring | |
| Logging | |

### External Services

| Service | Purpose |
|---------|---------|
| | |

---

## Established Patterns

> **TODO**: Document patterns already in use at Apolitical

### API Design
- REST conventions used
- Versioning strategy
- Authentication/authorization patterns
- Error response format

### Event Patterns
- Event schema conventions
- Topic/queue naming
- Retry/DLQ handling

### Testing Patterns
- Unit test conventions
- Integration test approach
- E2E test strategy

### Deployment Patterns
- Blue-green / canary / rolling
- Feature flag usage
- Rollback procedures

---

## Architecture Decision Records

> **TODO**: Link to existing ADRs or document key decisions

| Decision | Date | Context | Outcome |
|----------|------|---------|---------|
| | | | |

---

## Service Inventory

> **TODO**: List of services with their responsibilities

| Service | Bounded Context | Team | Key APIs |
|---------|-----------------|------|----------|
| | | | |

---

## Cross-Cutting Concerns

### Observability
- Logging standards
- Metrics to capture
- Tracing approach
- Alerting philosophy

### Security
- AuthN/AuthZ patterns
- Data classification
- Secrets management
- API security standards

### Performance
- SLOs/SLAs by service
- Known bottlenecks
- Scaling strategies

---

## Resources

### Internal
- Architecture diagrams: [link]
- API documentation: [link]
- Runbooks: [link]

### External References
- [Clean Architecture - Robert Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design Reference](https://www.domainlanguage.com/ddd/reference/)
- [Microservices Patterns - Chris Richardson](https://microservices.io/patterns/)
- [Designing Data-Intensive Applications - Martin Kleppmann](https://dataintensive.net/)

---

*Last updated: 2026-01-23*
*This document should be updated as architecture evolves*
