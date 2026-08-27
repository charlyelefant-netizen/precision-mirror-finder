import { AdminDashboard } from "@/components/AdminDashboard";
import { AdminLogin } from "@/components/AdminLogin";
import { TopBar } from "@/components/TopBar";
import { hasAdminPasswordConfigured, hasAdminSession } from "@/lib/auth";
import { listSubmissions } from "@/lib/db";

export const maxDuration = 60;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const authed = await hasAdminSession();

  return (
    <>
      <TopBar />
      {authed ? (
        <AdminDashboard submissions={await listSubmissions()} taxRate={Number(process.env.SALES_TAX_RATE || "0.06625")} />
      ) : (
        <AdminLogin hasError={params.error === "1"} isConfigured={hasAdminPasswordConfigured()} />
      )}
    </>
  );
}
