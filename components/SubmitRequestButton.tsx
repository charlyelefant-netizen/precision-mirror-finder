"use client";

import { Send } from "lucide-react";

export function SubmitRequestButton() {
  return (
    <button
      type="submit"
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-bold text-white transition hover:bg-blue-800 sm:w-auto"
    >
      <Send size={17} aria-hidden="true" />
      Submit request
    </button>
  );
}
