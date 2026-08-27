"use client";

import type { FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { deleteAdminSubmission } from "@/app/actions";

export function DeleteRequestButton({ id }: { id: number }) {
  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm("Delete this request permanently?")) {
      event.preventDefault();
    }
  }

  return (
    <form action={deleteAdminSubmission} onSubmit={confirmDelete} className="flex justify-end border-t border-line pt-4">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 text-sm font-bold text-danger transition hover:bg-red-50"
      >
        <Trash2 size={16} aria-hidden="true" />
        Delete
      </button>
    </form>
  );
}
