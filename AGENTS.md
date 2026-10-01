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
