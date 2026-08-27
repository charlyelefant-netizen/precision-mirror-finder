"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordField() {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block space-y-2">
      <span className="field-label">Password</span>
      <span className="relative block">
        <input
          name="password"
          type={visible ? "text" : "password"}
          required
          className="field-input pr-12"
          autoComplete="current-password"
        />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((current) => !current)}
          className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted transition hover:bg-brand-soft hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </span>
    </label>
  );
}
