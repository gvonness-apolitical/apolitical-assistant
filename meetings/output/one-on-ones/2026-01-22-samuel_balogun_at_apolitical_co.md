# 1:1 with Samuel Balogun
**Date:** 2026-01-22 10:00 GMT
**Role:** Software Engineer
**Squad:** Platform
**Manager:** Greg von Nessi

---

## Summary

Greg noted good progress on Samuel's work, specifically the completion of the Secret Manager investigation and the comprehensive GKE Audit RFC. Samuel explained the status of blocked items and draft PRs, clarified reasons for delays, and raised a new security concern about pod security standards. They agreed on concrete next steps including closing completed tickets and creating new child tickets for follow-up work.

---

## Key Points

### Highlights & Progress
- **GKE Audit RFC** completed - comprehensive analysis of security pain points with acceptable incremental approach
- **Secret Manager investigation (PLA-220)** - investigation complete with spreadsheet categorising tokens by risk tier
- Increased PR activity and good quality reviews observed
- Demonstrates thoughtfulness in work (RFC documentation, review comments)

### Current Blockers
- **PLA-220 runbook generation blocked**: Waiting to finalise GSM audit to establish single source of truth before generating rotation runbooks
- Most secrets currently in 1Password, need to migrate to GSM first

### Draft PRs Discussed
- **PR #6068** - GSM Secrets Integration (still in draft)
- **PR #6130** - TanStack React Form vulnerability fix (ready for review pending Rehad's feedback)

### New Concern Raised
- **Pod Security Standards gap discovered** during node version upgrade
- Critical workload (reverse proxy) sharing node pool with other workloads and running as root
- Security risk that needs wider audit

---

## Technical Context

### PLA-220: Token Rotation Investigation
**Linear:** [PLA-220](https://linear.app/apolitical/issue/PLA-220/investigate-token-rotation-policy)
**Status:** Blocked
**Project:** Security Enhancements

**Background:** Following a Contentful email about token rotation, the team needs to establish a rotation policy for all third-party services. Current state:
- Secrets stored in two places: 1Password (beta-specific) and Google Secret Manager (all secrets)
- GitHub CI Variables used during Docker image builds

**Investigation outcomes completed:**
- Spreadsheet detailing all tokens needing rotation
- Tokens categorised by risk tiers
- Automation capabilities assessed

**Blocked because:** Need to finalise GSM audit first to establish single source of truth before generating runbooks

### PR #6068: GSM Secrets Integration
**GitHub:** [PR #6068](https://github.com/apolitical/platform-v2/pull/6068)
**Status:** Draft
**Created:** 2026-01-16

**What it does:**
- Adds Google Secret Manager integration to profiles-api
- Loads secrets via service account using Application Default Credentials (ADC)
- Creates `secret-manager.ts` module for secret loading
- Provides caching mechanism to avoid repeated API calls

**Technical changes:**
- New dependency: `@google-cloud/secret-manager`
- Maps GSM secrets to environment variables at startup
- Uses `GOOGLE_CLOUD_PROJECT` env var for project identification

**Related Linear:** [PLA-304](https://linear.app/apolitical/issue/PLA-304/spike-1-service-account-based-access-to-google-secret-manager-gsm) - SPIKE for service account-based GSM access

### PR #6130: TanStack React Form Vulnerability Fix
**GitHub:** [PR #6130](https://github.com/apolitical/platform-v2/pull/6130)
**Status:** Open (was draft, now ready for review)
**Created:** 2026-01-20

**What it does:**
- Upgrades `@tanstack/react-form` from v0.32.0 to v1.3.3
- Removes `@tanstack/zod-form-adapter` dependency
- Addresses high severity Snyk vulnerability

**Technical changes:**
- Major breaking changes due to v1 API changes
- Affects: futura-ui, admin-ui, next-ui
- Refactored validation from Zod adapter to direct validation functions
- Updated form field validation syntax
- Modified type assertions in cohort forms

**Why it took time:**
- Breaking change required significant refactoring across multiple UIs
- Component deprecations needed addressing
- Waiting for Rehad's review (closer to the application)

### GKE Audit RFC
**Notion:** [GKE Audit](https://www.notion.so/2c468a6e3b928022a6c0d5baa1279893)
**Status:** Draft
**Owner:** Samuel Balogun
**Contributors:** Borja Hidalgo, Khalifa Idris

**Key pain points identified:**
1. **Lack of foundational security controls** - NetworkPolicies, Kyverno policies, image signing not enabled
2. **Publicly exposed control plane** - API server reachable from all GCP public IPs
3. **Missing encryption governance** - etcd not encrypted with CMEK
4. **Inconsistent upgrade management** - Not enrolled in release channels, manual ad-hoc upgrades
5. **Overly permissive RBAC** - Misconfigurations amplify blast radius
6. **No image validation** - No signing, verification, or vulnerability-based admission control
7. **Limited network segmentation** - Flat network with large shared pod CIDR, no NetworkPolicy
8. **Single-zone architecture** - No failover capability

**Recommended approach:** Incremental hardening (Solution A) rather than full rebuild
- Phased rollout starting with staging
- Risk-based prioritisation of fixes
- Clear success criteria and rollback procedures for each phase

### Pod Security Standards Concern (New)
**Discovery:** During node version upgrade
**Issue:** Reverse proxy (critical workload) running as root and sharing node pool

**Risk:**
- Running containers as root is security anti-pattern
- Critical workloads should be isolated from other workloads
- No Pod Security Standards currently enforced

**Planned action:** Wider audit on pod security standards to be integrated into GKE audit

---

## Action Items

### For Samuel
- [ ] Address Rehad's feedback on PR #6130 and merge today
- [ ] Close PLA-220 ticket (investigation complete)
- [ ] Create child tickets for runbook generation and token rotation
- [ ] Conduct wider audit on pod security standards
- [ ] Add pod security findings to GKE audit RFC
- [ ] Send async updates on Slack about GKE audit progress and blockers
- [ ] Raise Linear tickets for GKE audit tasks after PR #6130 merges
- [ ] Maintain PR review activity
- [ ] Move draft PRs forward

### For Greg
- [ ] Available to help unblock if needed on GKE audit
- [ ] Follow up on async updates via Slack

---

## Success Criteria (Next Few Weeks)

1. Maintain PR review engagement
2. Close PLA-220 and create child runbook tickets
3. Move draft PRs forward (PR #6068, PR #6130)
4. Provide regular async updates on Slack
5. GKE audit tickets raised and work progressing

---

## Related Links

| Resource | Link |
|----------|------|
| PLA-220 Linear | https://linear.app/apolitical/issue/PLA-220/investigate-token-rotation-policy |
| PLA-222 (GKE Audit ticket) | https://linear.app/apolitical/issue/PLA-222/audit-our-gke-cluster-setup |
| PLA-304 (GSM Spike) | https://linear.app/apolitical/issue/PLA-304/spike-1-service-account-based-access-to-google-secret-manager-gsm |
| PLA-327 (Workload Identity) | https://linear.app/apolitical/issue/PLA-327/gke-audit-workload-identity-and-secret-access-validation |
| PR #6068 | https://github.com/apolitical/platform-v2/pull/6068 |
| PR #6130 | https://github.com/apolitical/platform-v2/pull/6130 |
| GKE Audit RFC | https://www.notion.so/2c468a6e3b928022a6c0d5baa1279893 |
| Gemini Meeting Notes | https://docs.google.com/document/d/10gB7WSCFY_zulUoRfo1Et0lVk3v0UAhSOCKh0TYQq6o |

---

*Generated from Gemini meeting notes with technical context enrichment on 2026-01-22*
