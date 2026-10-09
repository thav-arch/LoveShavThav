"use client";

import { useState } from "react";
import { changePasswordAction } from "@/app/admin/actions";
import { Field, Notice, useSaver } from "./ui";

export function PasswordForm() {
  const saver = useSaver();
  const [v, setV] = useState({ current: "", next: "", confirm: "" });
  const mismatch = v.confirm.length > 0 && v.next !== v.confirm;
  return (
    <form
      className="a-panel"
      style={{ maxWidth: 460 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!mismatch) saver.run(() => changePasswordAction(v.current, v.next), () => setV({ current: "", next: "", confirm: "" }));
      }}
    >
      <h2>Change password</h2>
      <div className="a-grid" style={{ marginTop: 10 }}>
        <Field label="Current password" error={saver.fields.current}>
          <input type="password" required autoComplete="current-password" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} />
        </Field>
        <Field label="New password" hint="At least 10 characters" error={saver.fields._}>
          <input type="password" required minLength={10} autoComplete="new-password" value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} />
        </Field>
        <Field label="Confirm new password" error={mismatch ? "Passwords don't match" : undefined}>
          <input type="password" required autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} />
        </Field>
        <Notice result={saver.result} />
        <div className="a-actions">
          <button className="a-btn primary" disabled={saver.pending || mismatch}>
            Update password
          </button>
        </div>
      </div>
    </form>
  );
}
