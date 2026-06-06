// Supabase Edge Function: report-error
//
// Receives a client-side error report (e.g. a failed registration submit),
// persists it to the public.error_logs table using the service role, and emails
// the organizer so failures are noticed in real time instead of going silent.
//
// Required secrets (set with `supabase secrets set ...`):
//   RESEND_API_KEY      - your Resend API key (already set for the confirmation fn)
//   FROM_EMAIL          - verified sender
//   ERROR_NOTIFY_EMAIL  - where error alerts should go (defaults to REPLY_TO_EMAIL)
//   REPLY_TO_EMAIL      - (optional) fallback recipient
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// Deploy:  supabase functions deploy report-error --no-verify-jwt
// Secrets: supabase secrets set ERROR_NOTIFY_EMAIL="you@example.com"

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";
const REPLY_TO_EMAIL = Deno.env.get("REPLY_TO_EMAIL") ?? "";
const ERROR_NOTIFY_EMAIL = Deno.env.get("ERROR_NOTIFY_EMAIL") ?? REPLY_TO_EMAIL;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const escapeHtml = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );

interface ErrorReport {
  referenceId?: string;
  context?: string;
  message?: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  stack?: string | null;
  payload?: unknown;
  userAgent?: string | null;
  url?: string | null;
}

async function notify(report: ErrorReport) {
  if (!RESEND_API_KEY || !ERROR_NOTIFY_EMAIL) return; // email is best-effort

  const row = (label: string, value: unknown) =>
    value
      ? `<tr><td style="padding:4px 10px;color:#666;vertical-align:top;white-space:nowrap;"><strong>${escapeHtml(label)}</strong></td><td style="padding:4px 10px;font-family:monospace;font-size:13px;">${escapeHtml(value)}</td></tr>`
      : "";

  const payloadStr =
    report.payload != null ? JSON.stringify(report.payload, null, 2) : "";

  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#222;background:#f4f6f6;padding:24px;">
    <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:10px;padding:24px;border:1px solid #e3e8e8;">
      <h1 style="font-size:18px;margin:0 0 12px;color:#b91c1c;">⚠️ Kathryn Classic site error</h1>
      <p style="font-size:14px;margin:0 0 16px;">A user hit an error. Reference code <strong>${escapeHtml(report.referenceId)}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${row("Context", report.context)}
        ${row("Message", report.message)}
        ${row("Code", report.code)}
        ${row("Details", report.details)}
        ${row("Hint", report.hint)}
        ${row("URL", report.url)}
        ${row("Browser", report.userAgent)}
      </table>
      ${payloadStr ? `<h2 style="font-size:14px;margin:18px 0 6px;">Context data</h2><pre style="background:#f6f8f8;padding:12px;border-radius:6px;font-size:12px;overflow:auto;">${escapeHtml(payloadStr)}</pre>` : ""}
      ${report.stack ? `<h2 style="font-size:14px;margin:18px 0 6px;">Stack</h2><pre style="background:#f6f8f8;padding:12px;border-radius:6px;font-size:12px;overflow:auto;">${escapeHtml(report.stack)}</pre>` : ""}
    </div></body></html>`;

  const body: Record<string, unknown> = {
    from: FROM_EMAIL,
    to: [ERROR_NOTIFY_EMAIL],
    subject: `⚠️ Registration error (${report.referenceId}) — ${report.context ?? "unknown"}`,
    html,
  };
  if (REPLY_TO_EMAIL) body.reply_to = REPLY_TO_EMAIL;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("report-error: Resend failed", res.status, await res.text());
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const report = (await req.json()) as ErrorReport;

    // 1) Persist to error_logs (service role bypasses RLS).
    if (SUPABASE_URL && SERVICE_ROLE_KEY) {
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      const { error } = await admin.from("error_logs").insert({
        reference_id: report.referenceId ?? "UNKNOWN",
        context: report.context ?? null,
        message: report.message ?? null,
        error_code: report.code ?? null,
        details: report.details ?? null,
        hint: report.hint ?? null,
        stack: report.stack ?? null,
        payload: report.payload ?? null,
        user_agent: report.userAgent ?? null,
        url: report.url ?? null,
      });
      if (error) console.error("report-error: insert failed", error);
    }

    // 2) Email the organizer (best-effort, never blocks the response).
    await notify(report);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("report-error function error:", err);
    return new Response(
      JSON.stringify({ error: String((err as Error)?.message ?? err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
