// Supabase Edge Function: send-bulk-email
//
// Sends a rich HTML email to a filtered audience via Resend. Each recipient
// gets their OWN email (To: their address), with {{variables}} substituted from
// their contact record — so the body/subject can be personalized and recipients
// never see each other. Messages are sent in batches via Resend's batch API.
//
// Invoked from the admin portal's Communications page. Unlike the public
// `send-registration-confirmation` function, this one is deployed WITH JWT
// verification so only authenticated admins can call it.
//
// The caller creates the `email_campaigns` row (status 'sending') and passes its
// id. This function sends the emails, writes one `email_campaign_recipients` row
// per address, and updates the campaign's final status — all via the service
// role so RLS doesn't block the writes.
//
// Required secrets (already set for the other email functions):
//   RESEND_API_KEY   - your Resend API key
//   FROM_EMAIL       - verified sender, e.g. "The Kathryn Classic <info@kathrynclassic.com>"
//   REPLY_TO_EMAIL   - where replies should land
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// Deploy (note: NO --no-verify-jwt, so it stays admin-only):
//   supabase functions deploy send-bulk-email

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";
const REPLY_TO_EMAIL = Deno.env.get("REPLY_TO_EMAIL") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Resend's batch endpoint accepts up to 100 messages per request.
const BATCH_SIZE = 100;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Recipient {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
}

interface Payload {
  campaignId?: string;
  subject: string;
  bodyHtml: string;
  recipients: Recipient[];
  cc?: string[];
  bcc?: string[];
}

// Email-safe wrapper so the visual-editor HTML renders consistently across
// clients. Mirrors emailShell.js on the client.
const shell = (inner: string) => `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f6;font-family:Arial,Helvetica,sans-serif;color:#222;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:10px;padding:28px;border:1px solid #e3e8e8;">
      ${inner}
    </div>
    <p style="text-align:center;font-size:12px;color:#999;margin:16px 0 0;">
      The Kathryn Classic
    </p>
  </div>
</body>
</html>`;

// Replace {{variable}} tokens. Known variables resolve to the contact's value
// (blank if empty); unknown tokens are left untouched so typos are visible.
function render(template: string, vars: Record<string, string>) {
  return String(template ?? "").replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (m, key) => {
    const k = String(key).toLowerCase();
    if (k in vars) return vars[k] ?? "";
    return m;
  });
}

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const cleanList = (list?: string[]) =>
  (list ?? []).map((s) => String(s).trim()).filter(Boolean);

async function sendBatch(messages: Record<string, unknown>[]) {
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error (${res.status}): ${text}`);
  }
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const admin =
    SUPABASE_URL && SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
      : null;

  let campaignId: string | undefined;

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const payload = (await req.json()) as Payload;
    campaignId = payload.campaignId;

    const subjectTmpl = (payload.subject ?? "").trim();
    const bodyTmpl = payload.bodyHtml ?? "";
    const cc = cleanList(payload.cc);
    const bcc = cleanList(payload.bcc);

    // De-duplicate recipients by lowercased email, keeping the first seen.
    const seen = new Map<string, Recipient>();
    for (const r of payload.recipients ?? []) {
      const email = String(r?.email ?? "").trim();
      if (!email) continue;
      const key = email.toLowerCase();
      if (!seen.has(key)) {
        const name =
          (r?.name ?? `${r?.firstName ?? ""} ${r?.lastName ?? ""}`).trim();
        seen.set(key, { email, firstName: r?.firstName ?? "", lastName: r?.lastName ?? "", name });
      }
    }
    const recipients = [...seen.values()];

    if (!subjectTmpl) throw new Error("A subject is required.");
    if (recipients.length === 0) {
      throw new Error("No recipients with a valid email address.");
    }

    // Build one personalized message per recipient. Fixed cc/bcc are attached to
    // the first message only, so those addresses get a single copy (not one per
    // recipient).
    const messages = recipients.map((r, i) => {
      const vars: Record<string, string> = {
        first_name: r.firstName ?? "",
        last_name: r.lastName ?? "",
        name: r.name ?? "",
        full_name: r.name ?? "",
        email: r.email,
      };
      const msg: Record<string, unknown> = {
        from: FROM_EMAIL,
        to: [r.email],
        subject: render(subjectTmpl, vars),
        html: shell(render(bodyTmpl, vars)),
      };
      if (REPLY_TO_EMAIL) msg.reply_to = REPLY_TO_EMAIL;
      if (i === 0) {
        if (cc.length) msg.cc = cc;
        if (bcc.length) msg.bcc = bcc;
      }
      return msg;
    });

    // Send in batches; track outcome per chunk and map back to recipients.
    const msgChunks = chunk(messages, BATCH_SIZE);
    const recipChunks = chunk(recipients, BATCH_SIZE);
    const results = await Promise.allSettled(msgChunks.map(sendBatch));

    const recipientRows: {
      email: string;
      name: string | null;
      status: string;
      error: string | null;
    }[] = [];
    let sentCount = 0;
    const failed: { email: string; error: string }[] = [];

    recipChunks.forEach((rc, i) => {
      const result = results[i];
      const ok = result.status === "fulfilled";
      const errMsg = ok
        ? null
        : (result as PromiseRejectedResult).reason?.message ?? "unknown error";
      for (const r of rc) {
        if (ok) sentCount++;
        else failed.push({ email: r.email, error: errMsg! });
        recipientRows.push({
          email: r.email,
          name: r.name ?? null,
          status: ok ? "sent" : "failed",
          error: errMsg,
        });
      }
    });

    const status =
      failed.length === 0 ? "sent" : sentCount === 0 ? "failed" : "partial";

    // Persist the log (best-effort; never fail the send because logging broke).
    if (admin && campaignId) {
      const { error: recErr } = await admin
        .from("email_campaign_recipients")
        .insert(recipientRows.map((r) => ({ ...r, campaign_id: campaignId })));
      if (recErr) console.error("send-bulk-email: recipient log failed", recErr);

      const { error: campErr } = await admin
        .from("email_campaigns")
        .update({
          status,
          recipient_count: recipients.length,
          sent_at: new Date().toISOString(),
          error: failed.length > 0 ? `${failed.length} recipient(s) failed` : null,
        })
        .eq("id", campaignId);
      if (campErr) console.error("send-bulk-email: campaign update failed", campErr);
    }

    // Always 200 so the client receives this body (with per-recipient failures).
    return new Response(
      JSON.stringify({ sent: sentCount, recipientCount: recipients.length, failed, status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = String((err as Error)?.message ?? err);
    console.error("send-bulk-email error:", message);

    if (admin && campaignId) {
      await admin
        .from("email_campaigns")
        .update({ status: "failed", error: message, sent_at: new Date().toISOString() })
        .eq("id", campaignId);
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
