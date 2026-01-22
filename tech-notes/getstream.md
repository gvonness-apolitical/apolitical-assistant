# GetStream (Stream.io) Integration

*Last updated: 2026-01-22*

## Overview

Apolitical uses GetStream's **Activity Feeds API** (not Chat) to power all discussion and social features across the platform.

- SDK: `@getstream/nodejs` v8.x
- APIs used: Activity Feeds, Reactions, Collections, Users

---

## Service Integration

| Service | Role |
|---------|------|
| **socials-api** | Primary integration - creates communities, activities, reactions, users |
| **feeds-api** | Feed consumption - home feed, community feeds, profile feeds, comments |
| **mgmt-api** | User account lifecycle |
| **frontend v1/v2** | Discussion components, reaction UI, activity rendering |

---

## Feed Architecture

Stream feeds are organised hierarchically using the `FlatGroup` enum:

```
community                    ← Main feed where posts are created
├── community_user          ← Activities grouped by user
├── community_category      ← Activities grouped by category
├── community_user_anonymous ← Anonymous contributions
content_type                 ← Isolated storage (polls)
my_profile                   ← Personal profile feed
visible_profile              ← Public profile feed
user_private                 ← Private feed for digest emails
```

Activities are created in the main `community` feed and propagated to category/user feeds via follow relationships.

---

## Features Powered by Stream

### Content/Discussion System
- **Activities** - Posts, discussions, comments (primary content)
- **Reactions** - Likes, pins, replies, poll votes
- **Feeds** - User activity feeds, community feeds, profile feeds
- **Notifications** - Event-driven notifications on activity/reaction changes

### Reaction Types
- `like` - Standard like on activities
- `pin` - Pin activity (one per activity, not allowed on reactions)
- `reply` - Nested comments/replies
- `poll_vote` - Vote on a poll
- `poll_option` - Poll option selections

### Anonymity Support
- `is_anonymous` flag on activities
- `deanonymised_author_id` stored internally but hidden from API output
- Sanitization layer protects author identity from non-authors

---

## Custom Wrappers

Located in `/backend/v2/libs/externals/getstream/src/`:

| Service | Purpose |
|---------|---------|
| `ActivitiesService` | CRUD + auth checks + anonymity handling + category-based feed targeting |
| `ReactionsService` | Duplicate detection, cascading deletes, pin limits, poll vote validation |
| `FeedsService` | Follow/unfollow relationships between feeds |
| `UsersService` | User create/update/delete, profile sync |
| `CollectionsService` | `ActivityPayload` and `ReactionPayload` collections |

### Key Patterns

**Authorization**: Custom checks in services (Stream doesn't enforce ownership)
- Activity/reaction ownership validation before modifications
- Admin operations with `removeAsAdmin` bypass ownership checks

**Event-Driven Updates**: NestJS EventEmitter for reaction count updates
- Events: `Reaction.Create`, `Reaction.Remove`
- Prevents race conditions with single event per parent delete

**Data Consistency**:
- Recursive deletion for nested reactions
- Foreign ID generation for idempotency
- Sanitization to protect anonymity

---

## Configuration

- Environment variable: `GETSTREAM_CONFIGS` points to JSON config file
- Required credentials:
  - `apiKey` - API key for authentication
  - `apiSecret` - Secret key for generating tokens
  - `appId` - Stream app ID

Config loaded via `ConfigLoader.loadGetStreamConfig()` in:
- `/backend/v2/apps/socials-api/src/config/config.ts`
- `/backend/v2/apps/feeds-api/src/config/config.ts`

Health checks monitor Stream connectivity via `CustomHealthService`.

---

## Recent Development (as of Jan 2026)

- Migrating likes/reactions from socials-api → feeds-api
- AI moderation of posts
- Poll migration to feeds-api
- Content validation (block posts < 5 words)
- Backend-driven token generation

Migration tools: `/infrastructure/tools/migrations/getstream-migration/`

---

## Key Files

```
/backend/v2/libs/externals/getstream/
├── src/
│   ├── client.module.ts      # NestJS module, client initialization
│   ├── activities.service.ts # Activity CRUD
│   ├── reactions.service.ts  # Reaction CRUD
│   ├── feeds.service.ts      # Feed relationships
│   ├── users.service.ts      # User management
│   └── collections.service.ts # Collection items

/backend/v2/apps/socials-api/  # Primary Stream integration
/backend/v2/apps/feeds-api/    # Feed consumption
```

---

## Contract Considerations

For Enterprise discussions:
- Heavy usage of Activity Feeds (not Chat product)
- Custom auth/anonymity layers built on top
- Active development with ongoing migrations
- Need flexibility for scaling feeds usage
