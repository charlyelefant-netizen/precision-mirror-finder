import { LockKeyhole } from "lucide-react";
import { loginAdmin } from "@/app/actions";
import { PasswordField } from "@/components/PasswordField";

export function AdminLogin({ hasError, isConfigured }: { hasError: boolean; isConfigured: boolean }) {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-md place-items-center px-4 py-10">
      <form action={loginAdmin} className="w-full space-y-5 rounded-lg border border-line bg-panel p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-brand-soft text-brand">
            <LockKeyhole size={19} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-ink">Admin dashboard</h1>
            <p className="text-sm text-muted">Enter the admin password to continue.</p>
          </div>
        </div>
        {!isConfigured ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-warning">
            Admin access is not configured yet. Add ADMIN_PASSWORD to .env.local, then restart the dev server.
          </p>
        ) : null}
        {hasError ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-danger">Incorrect password.</p> : null}
        <PasswordField />
        <button className="h-11 w-full rounded-md bg-brand px-4 text-sm font-bold text-white transition hover:bg-blue-800">
          Sign in
        </button>
      </form>
    </main>
  );
}
