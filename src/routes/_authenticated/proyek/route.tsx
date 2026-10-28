import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireAuditPage } from "@/lib/access-client";

export const Route = createFileRoute("/_authenticated/proyek")({
  beforeLoad: requireAuditPage,
  component: () => <Outlet />,
});