"use client";

import { useState } from "react";
import { createUserAction, deleteUserAction, resetPasswordAction, setUserRoleAction } from "@/app/admin/actions";
import { Field, Notice, useSaver } from "./ui";

type Role = "admin" | "editor" | "author";
type UserRow = { id: string; email: string; name: string; role: Role; lastLoginAt: string | null };

const ROLE_HELP: Record<Role, string> = {
  admin: "Everything, including users and site settings",
  editor: "Create, edit, publish and delete all content",
  author: "Write drafts and edit their own; can't publish",
};

export function UserManager({ users, me }: { users: UserRow[]; me: string }) {
  const saver = useSaver();
  const [form, setForm] = useState({ name: "", email: "", role: "author" as Role, password: "" });

  return (
    <>
      <div className="a-table-wrap">
        <table className="a-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Last sign-in</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <b>{u.name}</b>
                  {u.id === me && " (you)"}
                  <small>{u.email}</small>
                </td>
                <td>
                  <select
                    value={u.role}
                    aria-label={`Role for ${u.name}`}
                    disabled={saver.pending}
                    onChange={(e) => saver.run(() => setUserRoleAction(u.id, e.target.value as Role))}
                  >
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                    <option value="author">Author</option>
                  </select>
                </td>
                <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("en-GB") : "never"}</td>
                <td>
                  <div className="a-actions" style={{ justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="a-btn small"
                      onClick={() => {
                        const pw = prompt(`New password for ${u.name} (at least 10 characters):`);
                        if (pw) saver.run(() => resetPasswordAction(u.id, pw));
                      }}
                    >
                      Reset password
                    </button>
                    {u.id !== me && (
                      <button
                        type="button"
                        className="a-btn small danger"
                        onClick={() => confirm(`Delete ${u.name}? Their content stays, without an author.`) && saver.run(() => deleteUserAction(u.id))}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12 }}>
        <Notice result={saver.result} />
      </div>

      <form
        className="a-panel"
        style={{ marginTop: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          saver.run(() => createUserAction(form), () => setForm({ name: "", email: "", role: "author", password: "" }));
        }}
      >
        <h2>Add a user</h2>
        <p className="a-hint">Share the password with them privately; they can change it under “My account”.</p>
        <div className="a-grid cols-4">
          <Field label="Name" error={saver.fields.name}>
            <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email" error={saver.fields.email}>
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Role" hint={ROLE_HELP[form.role]}>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              <option value="author">Author</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <Field label="Temporary password" error={saver.fields._}>
            <input type="password" required minLength={10} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
        </div>
        <div className="a-actions" style={{ marginTop: 12 }}>
          <button className="a-btn primary" disabled={saver.pending}>
            Add user
          </button>
        </div>
      </form>
    </>
  );
}
