// Runs the real migrations in an in-process Postgres (PGlite) with a stubbed
// Supabase auth/storage schema, and exercises the step 5 RPCs end to end.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const STUBS = `
  create role anon; create role authenticated; create role service_role;
  create schema auth; create schema storage;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
  create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
`;

let db: PGlite;
const STAFF = "staff@example.com";
let n = 0;

async function seedOrder(status: string, businessDate = "2026-10-05") {
  const id = crypto.randomUUID();
  n++;
  await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `s${n}@example.com`]);
  const order = await db.query<{ id: string }>(
    `insert into public.orders (user_id, business_date, amount_satang, status, expires_at)
     values ($1, $2, 2000, $3, now()) returning id`,
    [id, businessDate, status],
  );
  return { userId: id, orderId: order.rows[0].id };
}

const call = (sql: string, params: unknown[]) => db.query(sql, params);
const review = (orderId: string, approve: boolean, refund: boolean, note = "ok") =>
  call("select public.staff_review_order($1, $2, $3, $4, $5)", [orderId, approve, refund, note, STAFF]);

async function rowOf(orderId: string) {
  return (await db.query<{ status: string; refund_required: boolean; refunded_at: string | null }>(
    "select status, refund_required, refunded_at from public.orders where id = $1", [orderId])).rows[0];
}
const ticketOf = async (orderId: string) =>
  (await db.query<{ status: string }>("select status from public.tickets where order_id = $1", [orderId])).rows[0];
const auditOf = async (orderId: string) =>
  (await db.query<{ action: string; staff_email: string; note: string }>(
    "select action, staff_email, note from public.staff_actions where order_id = $1 order by id", [orderId])).rows;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  const dir = join(process.cwd(), "supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
}, 60_000);

describe("staff_review_order", () => {
  it("approve issues a ticket, marks paid, logs the action", async () => {
    const { orderId } = await seedOrder("needs_review");
    await review(orderId, true, false, "slip checked");
    expect(await rowOf(orderId)).toMatchObject({ status: "paid", refund_required: false });
    expect(await ticketOf(orderId)).toMatchObject({ status: "active" });
    expect(await auditOf(orderId)).toEqual([{ action: "approve_order", staff_email: STAFF, note: "slip checked" }]);
  });

  it("approve with refund flag keeps the flag", async () => {
    const { orderId } = await seedOrder("needs_review");
    await review(orderId, true, true);
    expect(await rowOf(orderId)).toMatchObject({ status: "paid", refund_required: true });
  });

  it("reject gives no ticket and honours the refund flag", async () => {
    const a = await seedOrder("needs_review");
    await review(a.orderId, false, true, "fake slip");
    expect(await rowOf(a.orderId)).toMatchObject({ status: "rejected", refund_required: true });
    expect(await ticketOf(a.orderId)).toBeUndefined();

    const b = await seedOrder("needs_review");
    await review(b.orderId, false, false);
    expect(await rowOf(b.orderId)).toMatchObject({ status: "rejected", refund_required: false });
  });

  it("requires a note and a needs_review order, and rolls back on failure", async () => {
    const { orderId } = await seedOrder("needs_review");
    await expect(review(orderId, true, false, "   ")).rejects.toThrow("note_required");
    expect((await rowOf(orderId)).status).toBe("needs_review");

    await review(orderId, true, false);
    await expect(review(orderId, false, false)).rejects.toThrow("order_not_reviewable");

    const pending = await seedOrder("pending_payment");
    await expect(review(pending.orderId, true, false)).rejects.toThrow("order_not_reviewable");
    expect(await auditOf(pending.orderId)).toEqual([]);
  });
});

describe("staff_cancel_ticket", () => {
  it("cancels once, flags refund, logs", async () => {
    const { orderId } = await seedOrder("needs_review");
    await review(orderId, true, false);
    await call("select public.staff_cancel_ticket($1, $2, $3, $4)", [orderId, true, "abuse", STAFF]);
    expect(await ticketOf(orderId)).toMatchObject({ status: "cancelled" });
    expect((await rowOf(orderId)).refund_required).toBe(true);
    expect((await auditOf(orderId)).map((a) => a.action)).toEqual(["approve_order", "cancel_ticket"]);

    await expect(
      call("select public.staff_cancel_ticket($1, $2, $3, $4)", [orderId, true, "again", STAFF]),
    ).rejects.toThrow("ticket_not_active");
  });

  it("fails without a ticket or note", async () => {
    const { orderId } = await seedOrder("needs_review");
    await expect(call("select public.staff_cancel_ticket($1, $2, $3, $4)", [orderId, false, "x", STAFF])).rejects.toThrow("ticket_not_found");
    await expect(call("select public.staff_cancel_ticket($1, $2, $3, $4)", [orderId, false, "", STAFF])).rejects.toThrow("note_required");
  });
});

describe("staff_mark_refunded", () => {
  it("only works when a refund is due, and only once", async () => {
    const { orderId } = await seedOrder("needs_review");
    await review(orderId, false, true);
    await call("select public.staff_mark_refunded($1, $2, $3)", [orderId, "transferred back", STAFF]);
    expect((await rowOf(orderId)).refunded_at).not.toBeNull();
    await expect(call("select public.staff_mark_refunded($1, $2, $3)", [orderId, "again", STAFF])).rejects.toThrow("no_refund_due");

    const clean = await seedOrder("needs_review");
    await review(clean.orderId, false, false);
    await expect(call("select public.staff_mark_refunded($1, $2, $3)", [clean.orderId, "x", STAFF])).rejects.toThrow("no_refund_due");
  });
});

describe("privileges", () => {
  it("staff RPCs are not callable by authenticated users", async () => {
    const { rows } = await db.query<{ ok: boolean }>(
      "select has_function_privilege('authenticated', 'public.staff_review_order(uuid,boolean,boolean,text,text)', 'execute') as ok",
    );
    expect(rows[0].ok).toBe(false);
  });
});
