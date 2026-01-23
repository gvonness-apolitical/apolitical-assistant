# Email Triage

Review inbox and categorise emails for action.

## Usage
- `/triage-inbox` - triage unread emails
- `/triage-inbox [count]` - triage specific number of emails

## Process

1. **Fetch emails**: Search Gmail for unread or recent emails (default: 30)
2. **Categorise each** into:
   - **Respond** - Needs a reply from me (draft if straightforward)
   - **Review** - Needs attention but no reply (PR reviews, doc comments)
   - **Delegate** - Should be handled by someone else (suggest who)
   - **Archive** - No action needed, keep for reference
   - **Delete** - No value (marketing, spam, automated alerts I don't need)

3. **Present summary** grouped by category with:
   - Sender, subject, brief context
   - Suggested action or draft response
   - Priority (P1/P2/P3)

## Actions

After presenting triage:
- **Archive**: Use `gmail_archive` for emails marked archive
- **Delete**: Use `gmail_trash` for emails marked delete (confirm first)
- **Keep**: Leave respond/review items in inbox

## Automated Deletes (No Confirmation Needed)

- npm publish notifications (`Successfully published @apolitical/*`)
- Snyk vulnerability alerts (unless critical/high severity on main)
- Contentful incident updates (unless ongoing incident)
- Google Cloud alerts that show RESOLVED in subject
- Marketing emails from vendors

## Always Keep

- Emails from exec team (Joel, Joe, Robyn, Lauren)
- Gemini meeting notes
- Google Doc comments/mentions
- Anything with my name or @greg in body

## Output

Summary table followed by recommended actions. Ask before bulk operations.
