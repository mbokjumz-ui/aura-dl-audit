<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep `/proyek` as an index leaf beneath an Outlet-rendering parent route; the detail path is nested and otherwise cannot render.
- Store Pelaporan and Closing documents in private audit-documents storage with stage_documents metadata; private access and cascade-linked records keep audit files associated with their project.
- Keep project assignments auditor-only with one assignment per auditor per project; groups were retired and existing group assignments converted to individual records to preserve project staffing.
- Store optional auditor WhatsApp numbers on auditors.whatsapp_number so contact details stay attached to each auditor record.
- Store archive findings independently of operational projects using a project identity and name snapshot; deleting a project must not erase retained audit results.
- Keep archive attachments in private archive-documents storage with archive_documents metadata linked to findings; authenticated internal users share archive access like existing audit records.
- Complete audit projects through the authenticated archive function: copy every stage attachment to independent private archive storage with source identities for retry deduplication, then validate all metadata before committing completed status; never move or delete originals during archival.
- Store ISO objects separately from audit findings, with cascade-linked iso_documents in private iso-documents storage; reuse ArchiveDocuments through explicit typed owner props to keep upload and access behavior consistent across archives.
- Store follow-up responsibility per completed project and executors per item; preserve project-name snapshots so retained follow-ups survive operational project deletion.
- Auditee access uses expiring, revocable capability links with only token hashes persisted and server-validated project/item scopes; keep privileged access resolution in a server-only module.
- Keep follow-up evidence private and submissions append-only; commit evidence metadata and submitted status atomically, requiring auditor review before approval.
- In shared follow-up recipient triggers, branch on the table before reading its specific fields; status updates must preserve access links and never read columns belonging to another table.
- Stock opname RAB items are two-level (parent_id, enforced by trigger); only leaf rows carry quantity/price so totals never double count.
- Store stock opname attachments in private stock-opname-documents storage with cascade-linked item metadata; reuse ArchiveDocuments via typed owner props so private file behavior remains consistent.
- Generate stock opname PDFs client-side from the same numbered rows and totals used on screen, including header snapshots, completion status, and attachment filenames; reports must not expose private storage URLs.
- Use shared AttachmentActions for private document previews: fetch short-lived signed files locally, sanitize Word content and render Excel as text, never send private URLs to external document viewers; preserve capability scope checks for auditee access.
- Store access roles in protected user_roles; existing accounts are backfilled as internal audit and new accounts receive no role automatically, preventing public signup privilege escalation.
- Guard audit pages by role beneath the managed authentication gate, enforce the same boundary with restrictive RLS on audit data/files, and protect actual opname values and completion through database triggers to prevent bypass via direct requests or cascades.
- Create purchasing accounts only through an internal-audit-authorized server function; admin-created purchasing accounts are confirmed immediately (internal audit vouches for them); keep profile names separate from roles.
