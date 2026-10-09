/**
 * First-run seed:  npm run db:seed
 *
 * - creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD (.env.local)
 * - imports the original hard-coded portfolio (data/seed-projects.ts)
 * - writes default site / profile / theme settings
 * - adds one DRAFT example per modular collection
 *
 * Safe to re-run: each step only runs when its table is empty.
 */
import { count, eq } from "drizzle-orm";
import { seedProjects } from "../data/seed-projects";
import { hashPassword, PASSWORD_MIN } from "../lib/cms/auth/password";
import type { PgTable } from "drizzle-orm/pg-core";
import { createDb, runMigrations, schema, type Db } from "../lib/cms/db/client";
import { defaultProfile, defaultSite, defaultTheme } from "../lib/cms/settings-schema";
import { slugify } from "../lib/cms/validation";

const empty = async (db: Db, table: PgTable) => Number((await db.select({ n: count() }).from(table))[0].n) === 0;

type Handle = ReturnType<typeof createDb>;

/** idempotent: also called by the build (scripts/db-snapshot.ts) on a hosted database */
export async function seed(h: Handle) {
  const { db } = h;
  await runMigrations(h);

  /* admin */
  if (await empty(db, schema.users)) {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD ?? "";
    if (!email || password.length < PASSWORD_MIN)
      throw new Error(`Set ADMIN_EMAIL and ADMIN_PASSWORD (≥ ${PASSWORD_MIN} chars) in .env.local before seeding.`);
    await db.insert(schema.users).values({ email, name: process.env.ADMIN_NAME ?? "Admin", role: "admin", passwordHash: await hashPassword(password) });
    console.log(`[seed] admin user created (${email})`);
  }
  const admin = (await db.select().from(schema.users).where(eq(schema.users.role, "admin")).limit(1))[0];

  /* settings */
  for (const [key, value] of [
    ["site", defaultSite],
    ["profile", defaultProfile],
    ["theme", defaultTheme],
  ] as const) {
    await db.insert(schema.settings).values({ key, value }).onConflictDoNothing();
  }

  /* projects */
  if (await empty(db, schema.projects)) {
    const cats = new Map<string, string>();
    const categoryFor = async (name: string) => {
      if (!cats.has(name)) {
        const [c] = await db.insert(schema.categories).values({ name, slug: slugify(name), scope: "project" }).returning();
        cats.set(name, c.id);
      }
      return cats.get(name)!;
    };
    const tagIds = new Map<string, string>();
    const tagFor = async (name: string) => {
      const slug = slugify(name);
      if (!tagIds.has(slug)) {
        const [t] = await db.insert(schema.tags).values({ name, slug }).onConflictDoNothing().returning();
        tagIds.set(slug, t?.id ?? (await db.select().from(schema.tags).where(eq(schema.tags.slug, slug)))[0].id);
      }
      return tagIds.get(slug)!;
    };
    const mediaRow = async (url: string, alt: string, sm?: string) => {
      const mime = url.endsWith(".mp4") ? "video/mp4" : "image/jpeg";
      const [m] = await db
        .insert(schema.media)
        .values({ url, filename: url.split("/").pop()!, mimeType: mime, alt, variants: sm ? { sm } : {}, uploadedBy: admin.id })
        .returning();
      return m.id;
    };

    for (const [i, p] of seedProjects.entries()) {
      const coverId = await mediaRow(p.thumbnail, `${p.title} cover`, p.thumbnailSmall);
      const heroId = await mediaRow(p.hero, `${p.title} hero`);
      for (const s of p.sections) if (s.media) await mediaRow(s.media.src, s.media.alt);
      const [row] = await db
        .insert(schema.projects)
        .values({
          slug: p.slug,
          title: p.title,
          subtitle: p.subtitle,
          summary: p.description,
          year: p.year,
          role: p.role,
          tools: p.tools,
          accent: p.accent,
          categoryId: await categoryFor(p.slug.startsWith("farmville") ? "Live Ops" : "Games"),
          coverId,
          heroId,
          videoUrl: p.video ?? null,
          sections: p.sections.map((s) => ({
            id: s.id,
            title: s.title,
            body: s.body,
            mediaUrl: s.media?.src ?? null,
            mediaType: s.media?.type,
            caption: s.media?.caption,
          })),
          status: "published",
          featured: true,
          sortOrder: i + 1,
          authorId: admin.id,
          publishedAt: new Date(),
        })
        .returning({ id: schema.projects.id });
      const ids = await Promise.all(p.tags.filter((t) => !p.tools.includes(t)).map(tagFor));
      if (ids.length) await db.insert(schema.projectTags).values(ids.map((tagId) => ({ projectId: row.id, tagId })));
    }
    await db.insert(schema.categories).values({ name: "Notes", slug: "notes", scope: "post" }).onConflictDoNothing();
    console.log(`[seed] imported ${seedProjects.length} projects`);
  }

  /* modular collections: one draft example each (drafts are never public) */
  if (await empty(db, schema.entries)) {
    await db.insert(schema.entries).values([
      {
        collection: "testimonials",
        status: "draft",
        sortOrder: 1,
        authorId: admin.id,
        data: { quote: "EXAMPLE — replace with a real quote, then publish.", author: "Name Surname", role: "Role", company: "Studio", avatar: "", url: "" },
      },
      {
        collection: "achievements",
        status: "draft",
        sortOrder: 1,
        authorId: admin.id,
        data: { title: "EXAMPLE — your award or exhibition", kind: "Award", issuer: "", date: "", description: "", url: "", image: "" },
      },
    ]);
    console.log("[seed] added draft examples for testimonials and achievements");
  }

  console.log("[seed] done");
}

// run directly: npm run db:seed
if (/seed\.ts$/.test(process.argv[1] ?? "")) {
  const h = createDb();
  seed(h)
    .then(() => h.close())
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
