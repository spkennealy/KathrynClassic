// Supabase Edge Function: send-registration-confirmation
//
// Sends a registration confirmation email to each registrant via Resend, plus a
// follow-up tournament-rules email (one per unique address) when the year has
// rules in `tournament_rules`.
//
// Email prose lives in `email_templates` rows keyed by `template_key`
// (registration_confirmation / registration_group_summary / registration_rules)
// and is editable in Admin → Communications → Templates. Dynamic blocks
// ({{events_table}}, {{payment_section}}, {{group_table}}, ...) are generated
// here and substituted into the template. If a row is missing or blanked, the
// matching entry in DEFAULT_TEMPLATES below is used, so sends never depend on
// the templates table being reachable.
//
// Invoked from the public registration form after a successful submission, and
// from the admin portal after group edits (src/utils/registrationEmail.js).
//
// Required secrets (set with `supabase secrets set ...`):
//   RESEND_API_KEY     - your Resend API key
//   FROM_EMAIL         - verified sender, e.g. "The Kathryn Classic <registration@yourdomain.com>"
//   REPLY_TO_EMAIL     - where replies should land (your Namecheap forwarding address)
//   ORGANIZER_BCC      - (optional) comma-separated addresses to BCC on every email
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// Deploy:  supabase functions deploy send-registration-confirmation --no-verify-jwt
// Secrets: supabase secrets set RESEND_API_KEY=... FROM_EMAIL="..." REPLY_TO_EMAIL=... ORGANIZER_BCC=...

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---- Payment instructions shown in every email. EDIT THESE with real details. ----
const PAYMENT_METHODS = [
  { label: "Venmo", value: "@Sean-Kennealy" },
  { label: "Zelle", value: "spkennealy@gmail.com" },
  {
    label: "Check by mail",
    value: "Make checks payable to “Sean Kennealy” and mail to: 3001 Santa Clara Ave, Alameda, CA 94501",
  },
];

// Clickable payment links shown as buttons in the email.
const PAYMENT_LINKS = [
  { label: "Pay with Venmo", url: "https://venmo.com/u/Sean-Kennealy", color: "#008CFF" },
  { label: "Pay with Zelle", url: "https://enroll.zellepay.com/qr-codes?data=spkennealy@gmail.com", color: "#6D1ED4" },
];
// ------------------------------------------------------------------------------------

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";
const REPLY_TO_EMAIL = Deno.env.get("REPLY_TO_EMAIL") ?? "";
const ORGANIZER_BCC = (Deno.env.get("ORGANIZER_BCC") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
// Supabase injects SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY automatically, but
// fall back to custom-named secrets (PROJECT_URL / SERVICE_ROLE_KEY) in case the
// auto-injected ones aren't present in this deployment.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL") ?? "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface EventLine {
  name: string;
  adults: number;
  children: number;
  amount: number; // confirmed amount for this line (0 if TBD)
  tbd?: boolean;
}

interface Registrant {
  firstName: string;
  lastName: string;
  email: string;
  events: EventLine[];
  total: number; // confirmed total owed
  hasTbd?: boolean; // some selected event has TBD pricing
  estimatedMin?: number;
  estimatedMax?: number;
}

interface Payload {
  tournamentYear?: number | string;
  registrants: Registrant[];
}

const fmt = (n: number) =>
  `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const escapeHtml = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );

// Templates -------------------------------------------------------------------

type TemplateKey =
  | "registration_confirmation"
  | "registration_group_summary"
  | "registration_rules";

const TEMPLATE_KEYS: TemplateKey[] = [
  "registration_confirmation",
  "registration_group_summary",
  "registration_rules",
];

// Fallbacks when the email_templates row is missing or blanked. These are the
// same strings seeded by migration 20260713000000_add_registration_email_templates.sql —
// keep them in sync.
const DEFAULT_TEMPLATES: Record<TemplateKey, { subject: string; body: string }> = {
  registration_confirmation: {
    subject: "Your Kathryn Classic {{year}} registration — {{total}} due",
    body: `<h1 style="color:#0d9488;font-size:24px;margin:0 0 8px;">You're registered!</h1>
<p style="font-size:16px;margin:0 0 20px;">
  Hi {{first_name}}, thank you for registering for
  <strong>The Kathryn Classic {{year}}</strong>.
</p>
{{group_note}}

<h2 style="font-size:16px;margin:24px 0 8px;">What you registered for</h2>
{{events_table}}

{{tbd_note}}

{{payment_section}}

<p style="font-size:13px;color:#777;margin:24px 0 0;">
  Questions? Just reply to this email. We can't wait to see you at the tournament!
</p>`,
  },
  registration_group_summary: {
    subject: "Your Kathryn Classic {{year}} group registration — {{group_total}} total",
    body: `<h1 style="color:#0d9488;font-size:24px;margin:0 0 8px;">You're all registered!</h1>
<p style="font-size:16px;margin:0 0 20px;">
  Hi {{first_name}}, thanks for registering your group for
  <strong>The Kathryn Classic {{year}}</strong>.
  Here's a summary for everyone you signed up.
</p>

<h2 style="font-size:16px;margin:24px 0 8px;">Your group</h2>
{{group_table}}

{{payment_section}}

<p style="font-size:13px;color:#777;margin:24px 0 0;">
  Questions? Just reply to this email. We can't wait to see you all at the tournament!
</p>`,
  },
  registration_rules: {
    subject: "Tournament rules — The Kathryn Classic {{year}}",
    body: `<h1 style="color:#0d9488;font-size:24px;margin:0 0 8px;">Tournament rules</h1>
<p style="font-size:16px;margin:0 0 20px;">
  Hi {{first_name}}, here are the rules for
  <strong>The Kathryn Classic {{year}}</strong>. Give them a quick read before tournament day.
</p>
{{rules_body}}
<p style="font-size:13px;color:#777;margin:24px 0 0;">
  Questions? Just reply to this email. See you out there!
</p>`,
  },
};

// Replace {{variable}} tokens. Known variables resolve to their value (blank if
// empty); unknown tokens are left untouched so typos are visible. Mirrors
// send-bulk-email's render().
function render(template: string, vars: Record<string, string>) {
  return String(template ?? "").replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (m, key) => {
    const k = String(key).toLowerCase();
    if (k in vars) return vars[k] ?? "";
    return m;
  });
}

// Fetch the admin-edited templates by key. Any failure just means the code
// defaults get used — template lookup must never break a send.
async function fetchTemplates(
  admin: ReturnType<typeof createClient> | null
): Promise<Map<string, { subject: string; body_html: string }>> {
  const map = new Map<string, { subject: string; body_html: string }>();
  if (!admin) return map;
  try {
    const { data, error } = await admin
      .from("email_templates")
      .select("template_key, subject, body_html")
      .in("template_key", TEMPLATE_KEYS)
      .is("deleted_at", null);
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.template_key) {
        map.set(row.template_key, {
          subject: row.subject ?? "",
          body_html: row.body_html ?? "",
        });
      }
    }
  } catch (err) {
    console.error("Template lookup failed; using built-in defaults:", err);
  }
  return map;
}

const pickTemplate = (
  templates: Map<string, { subject: string; body_html: string }>,
  key: TemplateKey
): { subject: string; body: string } => {
  const db = templates.get(key);
  return {
    subject: db?.subject?.trim() ? db.subject : DEFAULT_TEMPLATES[key].subject,
    body: db?.body_html?.trim() ? db.body_html : DEFAULT_TEMPLATES[key].body,
  };
};

// Render subject + full HTML for one email. Scalar tokens (names, totals, year)
// go into the subject raw and into the body HTML-escaped; block tokens are
// pre-built HTML and only valid in the body.
function renderEmail(
  tpl: { subject: string; body: string },
  year: number | string,
  scalars: Record<string, string>,
  blocks: Record<string, string>
): { subject: string; html: string } {
  const escaped: Record<string, string> = {};
  for (const [k, v] of Object.entries(scalars)) escaped[k] = escapeHtml(v);
  return {
    subject: render(tpl.subject, scalars),
    html: shell(year, render(tpl.body, { ...escaped, ...blocks })),
  };
}

// Shared snippets ------------------------------------------------------------

const paymentMethodsBox = () => {
  const rows = PAYMENT_METHODS.map(
    (m) =>
      `<p style="margin:4px 0;font-size:14px;"><strong>${escapeHtml(m.label)}:</strong> ${escapeHtml(m.value)}</p>`
  ).join("");
  return `<div style="background:#f0fdfa;border-radius:6px;padding:12px 16px;">${rows}</div>`;
};

const paymentButtonsRow = () => {
  const buttons = PAYMENT_LINKS.map(
    (p) =>
      `<a href="${p.url}" target="_blank" style="display:inline-block;margin:4px 6px;padding:12px 24px;background:${p.color};color:#fff;font-size:14px;font-weight:bold;text-decoration:none;border-radius:8px;">${escapeHtml(p.label)}</a>`
  ).join("");
  return `<div style="text-align:center;margin-top:16px;">${buttons}</div>`;
};

const tbdNoteFor = (r: Registrant) =>
  r.hasTbd
    ? `<p style="font-size:14px;color:#926b00;background:#fff8e1;padding:10px 12px;border-radius:6px;">
         Some selected event pricing is still being finalized${
           r.estimatedMin != null && r.estimatedMax != null && r.estimatedMax > 0
             ? ` (estimated ${fmt(r.estimatedMin)}–${fmt(r.estimatedMax)})`
             : ""
         }. We'll email you the final amount.
       </p>`
    : "";

const attendingLabel = (e: EventLine) =>
  e.children > 0
    ? `${e.adults} adult${e.adults === 1 ? "" : "s"}, ${e.children} child${e.children === 1 ? "" : "ren"}`
    : `${e.adults} adult${e.adults === 1 ? "" : "s"}`;

const shell = (year: number | string, inner: string) => `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f6;font-family:Arial,Helvetica,sans-serif;color:#222;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:10px;padding:28px;border:1px solid #e3e8e8;">
      ${inner}
    </div>
    <p style="text-align:center;font-size:12px;color:#999;margin:16px 0 0;">
      The Kathryn Classic ${escapeHtml(String(year))}
    </p>
  </div>
</body>
</html>`;

// Token blocks: individual email (solo registrant or secondary group member) ---

const eventsTable = (r: Registrant, totalLabel: string) => {
  const eventRows = r.events
    .map(
      (e) => `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(e.name)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">${attendingLabel(e)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${e.tbd ? "TBD" : fmt(e.amount)}</td>
      </tr>`
    )
    .join("");

  return `<table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f0fdfa;">
            <th style="padding:8px 12px;text-align:left;">Event</th>
            <th style="padding:8px 12px;text-align:left;">Attending</th>
            <th style="padding:8px 12px;text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${eventRows}
          <tr>
            <td colspan="2" style="padding:12px;text-align:right;font-weight:bold;">${escapeHtml(totalLabel)}</td>
            <td style="padding:12px;text-align:right;font-weight:bold;color:#0d9488;">${fmt(r.total)}</td>
          </tr>
        </tbody>
      </table>`;
};

function individualVars(r: Registrant, year: number | string, organizerName?: string) {
  const isSecondary = !!organizerName;

  const groupNote = isSecondary
    ? `<p style="font-size:14px;color:#444;margin:0 0 16px;">
         You were registered as part of <strong>${escapeHtml(organizerName!)}</strong>'s group.
         The amount below is your share.
       </p>`
    : "";

  const paymentSection = isSecondary
    ? `<h2 style="font-size:16px;margin:24px 0 8px;">Payment</h2>
      <p style="font-size:14px;color:#444;margin:0 0 8px;">
        Your share is <strong>${fmt(r.total)}</strong>.
        <strong>${escapeHtml(organizerName!)}</strong> may be covering the group's payment —
        please check with them first. If you're paying your own share, you can use any of the
        methods below (due within <strong>2 weeks</strong>); include your name in the payment note.
      </p>
      ${paymentMethodsBox()}
      ${paymentButtonsRow()}`
    : `<h2 style="font-size:16px;margin:24px 0 8px;">How to pay</h2>
      <p style="font-size:14px;color:#444;margin:0 0 8px;">
        Please submit your payment of <strong>${fmt(r.total)}</strong> within <strong>2 weeks</strong>
        using one of the methods below. Include your name in the payment note so we can match it to your registration.
      </p>
      ${paymentMethodsBox()}
      ${paymentButtonsRow()}`;

  return {
    scalars: {
      first_name: r.firstName ?? "",
      last_name: r.lastName ?? "",
      year: String(year),
      total: fmt(r.total),
    },
    blocks: {
      group_note: groupNote,
      events_table: eventsTable(r, isSecondary ? "Your share" : "Total due"),
      tbd_note: tbdNoteFor(r),
      payment_section: paymentSection,
    },
  };
}

// Token blocks: group summary sent to the primary (first attendee) of a group --

function groupSummaryVars(
  primary: Registrant,
  group: Registrant[],
  grandTotal: number,
  year: number | string
) {
  const personRows = group
    .map((r) => {
      const events = r.events.map((e) => e.name).join(", ") || "—";
      const isYou = r.email === primary.email;
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">
          ${escapeHtml(r.firstName)} ${escapeHtml(r.lastName)}${isYou ? ' <span style="color:#0d9488;font-size:12px;">(you)</span>' : ""}
          <div style="color:#888;font-size:12px;">${escapeHtml(events)}</div>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">${r.hasTbd && r.total === 0 ? "TBD" : fmt(r.total)}</td>
      </tr>`;
    })
    .join("");

  const groupTable = `<table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f0fdfa;">
            <th style="padding:8px 12px;text-align:left;">Registrant</th>
            <th style="padding:8px 12px;text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${personRows}
          <tr>
            <td style="padding:12px;text-align:right;font-weight:bold;">Group total</td>
            <td style="padding:12px;text-align:right;font-weight:bold;color:#0d9488;">${fmt(grandTotal)}</td>
          </tr>
        </tbody>
      </table>`;

  const paymentSection = `<h2 style="font-size:16px;margin:24px 0 8px;">How to pay</h2>
      <p style="font-size:14px;color:#444;margin:0 0 8px;">
        As the organizer, you have two options — either works for us:
      </p>
      <ul style="font-size:14px;color:#444;margin:0 0 12px;padding-left:20px;">
        <li style="margin-bottom:6px;">Pay the <strong>full group total of ${fmt(grandTotal)}</strong> yourself, or</li>
        <li>Pay just <strong>your own ${fmt(primary.total)}</strong> and ask each person above to pay their share using the same methods below.</li>
      </ul>
      <p style="font-size:14px;color:#444;margin:0 0 8px;">
        Payment is due within <strong>2 weeks</strong>. Please include names in the payment note so we can match it up.
      </p>
      ${paymentMethodsBox()}
      ${paymentButtonsRow()}`;

  return {
    scalars: {
      first_name: primary.firstName ?? "",
      last_name: primary.lastName ?? "",
      year: String(year),
      group_total: fmt(grandTotal),
      your_total: fmt(primary.total),
      total: fmt(grandTotal),
    },
    blocks: {
      group_table: groupTable,
      payment_section: paymentSection,
    },
  };
}

async function sendEmail(to: string, subject: string, html: string) {
  const body: Record<string, unknown> = { from: FROM_EMAIL, to: [to], subject, html };
  if (REPLY_TO_EMAIL) body.reply_to = REPLY_TO_EMAIL;
  if (ORGANIZER_BCC.length > 0) body.bcc = ORGANIZER_BCC;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error (${res.status}) for ${to}: ${text}`);
  }
  return res.json();
}

// Rules email ------------------------------------------------------------------

// Fetch the year's rules HTML (tournament_rules is keyed by tournament_id).
// Returns null when the year has no rules yet — the caller skips silently.
async function fetchRulesHtml(
  admin: ReturnType<typeof createClient> | null,
  year: number | string
): Promise<string | null> {
  if (!admin) return null;
  const yearNum = parseInt(String(year), 10);
  if (!Number.isFinite(yearNum)) return null;

  const { data: tournament, error: tErr } = await admin
    .from("tournaments")
    .select("id")
    .eq("year", yearNum)
    .maybeSingle();
  if (tErr) throw tErr;
  if (!tournament) return null;

  const { data: rules, error: rErr } = await admin
    .from("tournament_rules")
    .select("body_html")
    .eq("tournament_id", tournament.id)
    .maybeSingle();
  if (rErr) throw rErr;

  const body = (rules?.body_html ?? "").trim();
  return body || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const admin =
      SUPABASE_URL && SERVICE_ROLE_KEY
        ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
        : null;

    const payload = (await req.json()) as Payload;
    const registrants = (payload.registrants || []).filter((r) => r && r.email);
    const year = payload.tournamentYear ?? "";

    if (registrants.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No registrants with an email address." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const templates = await fetchTemplates(admin);

    // A group is more than one person registered together. The first attendee is
    // treated as the primary/organizer.
    const isGroup = registrants.length > 1;
    const primary = registrants[0];
    const primaryName = `${primary.firstName} ${primary.lastName}`.trim();
    const grandTotal = registrants.reduce((sum, r) => sum + (Number(r.total) || 0), 0);

    const sends = registrants.map((r, i) => {
      let rendered: { subject: string; html: string };
      if (isGroup && i === 0) {
        // Primary: full group summary with per-person costs + pay-options.
        const tpl = pickTemplate(templates, "registration_group_summary");
        const vars = groupSummaryVars(primary, registrants, grandTotal, year);
        rendered = renderEmail(tpl, year, vars.scalars, vars.blocks);
      } else {
        // Solo registrant, or a secondary group member (their own costs; the
        // primary may be covering payment).
        const tpl = pickTemplate(templates, "registration_confirmation");
        const vars = individualVars(r, year, isGroup ? primaryName : undefined);
        rendered = renderEmail(tpl, year, vars.scalars, vars.blocks);
      }
      return sendEmail(r.email, rendered.subject, rendered.html);
    });

    const results = await Promise.allSettled(sends);

    const sent = results.filter((x) => x.status === "fulfilled").length;
    const failed = results
      .map((x, i) => ({ x, email: registrants[i].email }))
      .filter(({ x }) => x.status === "rejected")
      .map(({ x, email }) => ({
        email,
        error: (x as PromiseRejectedResult).reason?.message ?? "unknown",
      }));

    if (failed.length > 0) {
      console.error("Some confirmation emails failed:", failed);
    }

    // Follow-up rules email: one per unique address, best-effort — a problem
    // here must never fail the confirmations that already went out.
    let rulesSent = 0;
    let rulesSkipped = false;
    const rulesFailed: { email: string; error: string }[] = [];
    try {
      const rulesHtml = await fetchRulesHtml(admin, year);
      if (!rulesHtml) {
        rulesSkipped = true;
        console.log(`No rules found for year "${year}"; skipping rules emails.`);
      } else {
        const tpl = pickTemplate(templates, "registration_rules");
        const unique = new Map<string, Registrant>();
        for (const r of registrants) {
          const key = r.email.trim().toLowerCase();
          if (key && !unique.has(key)) unique.set(key, r);
        }
        const rulesResults = await Promise.allSettled(
          [...unique.values()].map((r) => {
            const rendered = renderEmail(
              tpl,
              year,
              {
                first_name: r.firstName ?? "",
                last_name: r.lastName ?? "",
                year: String(year),
              },
              { rules_body: rulesHtml }
            );
            return sendEmail(r.email, rendered.subject, rendered.html);
          })
        );
        const uniqueList = [...unique.values()];
        rulesResults.forEach((x, i) => {
          if (x.status === "fulfilled") rulesSent++;
          else {
            rulesFailed.push({
              email: uniqueList[i].email,
              error: (x as PromiseRejectedResult).reason?.message ?? "unknown",
            });
          }
        });
        if (rulesFailed.length > 0) {
          console.error("Some rules emails failed:", rulesFailed);
        }
      }
    } catch (rulesErr) {
      rulesSkipped = true;
      console.error("Rules email step failed:", rulesErr);
    }

    return new Response(
      JSON.stringify({ sent, failed, rulesSent, rulesFailed, rulesSkipped }),
      {
        status: failed.length > 0 && sent === 0 ? 502 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("send-registration-confirmation error:", err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
