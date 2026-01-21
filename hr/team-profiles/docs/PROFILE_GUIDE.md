# Profile Interpretation Guide

This guide explains how to read and interpret team member profiles, including what good and concerning patterns look like.

## Profile Structure Overview

Each profile contains 13 sections:

| Section | Purpose | Data Source |
|---------|---------|-------------|
| 1. Profile Overview | Basic info and data freshness | Config + auto-generated |
| 2. Leadership Values | Assessment against company values | Manual observation |
| 3. Engineering Values | Assessment against eng values | Manual observation |
| 4. Technical Progression | Competency framework assessment | Manual + data |
| 5. Hard Skills | Technical capability inventory | Manual observation |
| 6. Soft Skills | Interpersonal skill assessment | Manual observation |
| 7. Delivery Performance | DORA and contribution metrics | dev-analytics |
| 8. Communication Style | Slack analysis insights | Slack data |
| 9. Strengths Summary | Top strengths with evidence | Manual synthesis |
| 10. Development Areas | Growth plan and actions | 1:1 discussions |
| 11. Goals & Aspirations | Career direction | 1:1 discussions |
| 12. Management Notes | Coaching approaches | Personal notes |
| 13. Evidence Log | Specific examples | Various sources |

## Reading Each Section

### 1. Profile Overview

**Check for:**
- Data freshness (when was this last updated?)
- Coverage periods (is the data representative?)
- Missing data sources (what's not captured?)

**Red flags:**
- Data older than 3 months
- Missing Slack or analytics data
- TBD in critical fields (level, squad)

### 2. Leadership Values Assessment

Rating scale for company leadership values (5 levels):

| Rating | Meaning | What it looks like |
|--------|---------|-------------------|
| ☐☐☐☐☐ | Not observed | No evidence either way |
| ★☐☐☐☐ | Developing | Shows occasional flashes |
| ★★☐☐☐ | Meets expectations | Consistent demonstration |
| ★★★☐☐ | Exceeds | Goes beyond requirements |
| ★★★★☐ | Role model | Others look to them |
| ★★★★★ | Exceptional | Top 5% of the org |

**Using in 1:1s:**
- Share the rating and evidence
- Ask for their perspective
- Discuss specific examples
- Set improvement targets

### 3. Engineering Values Assessment

Rating scale (3 levels, reflecting technical focus):

| Rating | Meaning |
|--------|---------|
| ☐☐☐ | Not observed |
| ★☐☐ | Developing |
| ★★☐ | Proficient |
| ★★★ | Expert |

**Key values to watch:**
- **Sustainable delivery** - Are they finishing what they start?
- **Clear accountability** - Do they own their bugs?
- **Thoughtful AI use** - Are they validating AI output?

### 4. Technical Progression Framework

This maps to the company's leveling framework. Each area has skills rated against expected level.

**Gap column meanings:**
- Empty/0: At level
- Positive number: Above level (strength)
- Negative number: Below level (development area)

**Using for promotion readiness:**
1. Check all areas for gaps
2. Look for consistent above-level performance
3. Identify any blocking gaps
4. Document evidence for each skill

### 5. Hard Skills Inventory

Technical capabilities with proficiency levels:

| Proficiency | Years of experience typically |
|-------------|------------------------------|
| Beginner | 0-1 |
| Intermediate | 1-2 |
| Proficient | 2-4 |
| Advanced | 4-7 |
| Expert | 7+ or deep specialization |

**Using for project staffing:**
- Check relevant skills for upcoming work
- Identify skill gaps needing growth
- Find experts for mentoring others

### 6. Soft Skills Assessment

Same 5-level scale as Leadership Values.

**Key skills for engineering:**
- **Written communication** - Critical for remote work
- **Giving feedback** - Essential for code review quality
- **Initiative** - Indicator of senior-level readiness

### 7. Delivery Performance

#### DORA Metrics

| Metric | Elite | High | Medium | Low |
|--------|-------|------|--------|-----|
| Deployment Frequency | Multiple/day | Daily-weekly | Weekly-monthly | Monthly+ |
| Lead Time | <1 hour | <1 day | <1 week | >1 week |
| Change Failure Rate | <5% | 5-10% | 10-15% | >15% |
| MTTR | <1 hour | <1 day | <1 week | >1 week |

**What good looks like:**
- Consistent "High" or "Elite" ratings
- Improving trends over time
- Low change failure rate

**What concerning looks like:**
- "Low" in multiple metrics
- Declining trends
- High failure rate with high deployment frequency

#### Contribution Metrics

**Healthy ranges:**
- PRs merged: 8-20/month (depends on role)
- Reviews: Should roughly match PRs authored
- Lines changed: Context-dependent (quality > quantity)

**Red flags:**
- Very few PRs (blocked? struggling?)
- No reviews (not collaborating?)
- Massive line changes without reviews

### 8. Communication Style

#### What to look for

**Healthy patterns:**
- Consistent activity (not all-or-nothing)
- Active in relevant channels
- Balanced message length (not all one-liners, not essays)
- Engagement during working hours

**Concerning patterns:**
- Very low activity (disengaged? struggling?)
- Only reactive communication (never proactive)
- All activity in private channels (avoiding transparency?)
- Significant out-of-hours activity (burnout risk?)

#### Using the data

**For introverts:**
- Low message counts may be normal
- Focus on quality over quantity
- Check DM patterns for alternative communication style

**For communication issues:**
- Compare public vs. private patterns
- Look at response times and engagement
- Check if they're active where expected (team channels)

### 9. Strengths Summary

This is a synthesized view. Use it to:
- Recognize contributions
- Assign work that leverages strengths
- Identify mentoring opportunities
- Support promotion cases

### 10. Development Areas & Growth Plan

Track progress against agreed development goals:

| Status | Meaning |
|--------|---------|
| Not Started | Agreed but no action yet |
| In Progress | Actively working on it |
| Blocked | Needs support to proceed |
| Completed | Goal achieved |

**1:1 usage:**
- Review progress each session
- Adjust timelines as needed
- Celebrate completions
- Address blockers

### 11. Goals & Aspirations

Understanding what they want helps with:
- Aligning work assignments
- Identifying growth opportunities
- Anticipating retention risks
- Planning team evolution

**Check alignment:**
- Do their goals match available opportunities?
- Is their timeline realistic?
- Are they making progress toward goals?

### 12. Management Notes

Private notes for your reference:

**What to record:**
- Effective coaching approaches
- Things to avoid
- Context others might not know
- Performance conversation outcomes

**What NOT to record:**
- Hearsay or gossip
- Personal matters unrelated to work
- Anything you wouldn't want them to see

### 13. Evidence Log

Specific, dated examples that support assessments. Use for:
- Performance reviews
- Promotion cases
- Difficult conversations
- Recognition

## Using Profiles in 1:1s

### Preparation (5 min before)

1. Check recent metrics changes
2. Review open development areas
3. Note items to discuss
4. Check evidence log for recent additions

### During the 1:1

1. Share relevant metrics (delivery, communication)
2. Discuss progress on development areas
3. Capture new information
4. Update goals if needed

### After the 1:1

1. Update Management Notes with highlights
2. Add any new evidence
3. Adjust development area status
4. Note follow-up items

## Using Profiles for Performance Reviews

### Preparation

1. Review all 12 months of data
2. Synthesize trends (improving, stable, declining)
3. Gather specific evidence for each rating
4. Compare against expectations for level

### Key Sections

- **Leadership Values** - Company-wide assessment
- **Engineering Values** - Technical assessment
- **Technical Progression** - Level-specific assessment
- **Delivery Performance** - Objective metrics
- **Evidence Log** - Specific examples

### Calibration

When comparing team members:
1. Use COMPARISON_MATRIX.md
2. Ensure consistent rating standards
3. Document reasoning for each rating
4. Check for bias (recency, similarity, etc.)

## Privacy Reminder

**These profiles are management tools, not team documents.**

- Never share one person's profile with another
- Don't use profiles in team meetings
- Be thoughtful about what you write down
- Treat HR-related notes with extra care
