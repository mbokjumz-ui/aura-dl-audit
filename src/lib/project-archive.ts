export async function copyMissingProjectDocuments<T extends { id: string }>(
  documents: T[], archivedIds: Set<string>, copy: (document: T) => Promise<void>,
) {
  for (const document of documents) {
    if (!archivedIds.has(document.id)) await copy(document);
  }
}

export function automaticArchiveHeader(project: { id: string; name: string }, now = new Date()) {
  return {
    archive_year: now.getUTCFullYear(), archive_month: now.getUTCMonth() + 1,
    project_key: project.id, project_name: project.name, source_project_id: project.id,
    finding_number: "DOK-PROJECT", title: `Dokumen Project — ${project.name}`,
    description: "Lampiran Project audit yang disalin otomatis saat Project selesai.",
  };
}