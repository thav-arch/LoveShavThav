"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/app/admin/actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="a-panel">
      <div>
        <h1>Sign in</h1>
        <p className="a-hint">Portfolio content manager</p>
      </div>
      <input type="hidden" name="next" value={next} />
      <label className="a-field">
        <span>Email</span>
        <input type="email" name="email" autoComplete="username" required autoFocus />
      </label>
      <label className="a-field">
        <span>Password</span>
        <input type="password" name="password" autoComplete="current-password" required />
      </label>
      {state?.error && (
        <p className="a-notice bad" role="alert">
          {state.error}
        </p>
      )}
      <button className="a-btn primary" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <Link href="/" className="a-crumb">
        ← Back to the site
      </Link>
    </form>
  );
}
