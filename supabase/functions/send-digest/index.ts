// Supabase Edge Function: send-digest
// Called by pull-permits with contractor + matched permits.
// Sends an HTML email digest via Resend.

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
  const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "noreply@permitearly.com";
  const APP_URL = Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "https://permitearly.com";

  interface Permit {
    id: string;
    permit_address: string | null;
    worktype: string | null;
    estimated_cost: number | null;
    contractor_name: string | null;
    neighborhood: string | null;
    zip_code: string | null;
  }

  interface Contractor {
    id: string;
    email: string;
    company_name: string | null;
  }

  const { contractor, permits, date } = (await req.json()) as {
    contractor: Contractor;
    permits: Permit[];
    date: string;
  };

  const subject = `🔨 ${permits.length} new permit${permits.length === 1 ? "" : "s"} in your area — ${date}`;

  // Build permit rows HTML
  const permitRowsHtml = permits
    .map((p) => {
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        (p.permit_address ?? "") + " Orlando FL"
      )}`;
      const costStr =
        p.estimated_cost != null
          ? `$${p.estimated_cost.toLocaleString()}`
          : "Not listed";
      return `
      <tr>
        <td style="padding:16px 0; border-bottom:1px solid #e5e7eb;">
          <p style="margin:0 0 4px; font-size:16px; font-weight:700; color:#111827;">
            ${p.permit_address ?? "Address unavailable"}
          </p>
          <p style="margin:0 0 4px; font-size:14px; color:#374151;">
            ${p.worktype ?? "Work type not specified"}
          </p>
          <p style="margin:0 0 4px; font-size:13px; color:#6b7280;">
            💰 Estimated value: <strong>${costStr}</strong>
          </p>
          ${
            p.contractor_name
              ? `<p style="margin:0 0 4px; font-size:13px; color:#6b7280;">🏗️ Contractor on file: ${p.contractor_name}</p>`
              : ""
          }
          <a href="${mapsUrl}" style="display:inline-block; margin-top:8px; font-size:13px; color:#2563eb; text-decoration:none;">
            📍 View on Google Maps →
          </a>
        </td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background:#f9fafb; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb; padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background:#1d4ed8; padding:24px 32px; text-align:center;">
              <h1 style="margin:0; font-size:28px; font-weight:800; color:#ffffff; letter-spacing:-0.5px;">
                Permit<span style="color:#93c5fd;">Early</span>
              </h1>
              <p style="margin:6px 0 0; font-size:14px; color:#bfdbfe; font-style:italic;">
                Get there first.
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 8px; font-size:16px; color:#374151;">
                Hey${contractor.company_name ? ` ${contractor.company_name}` : ""},
              </p>
              <p style="margin:0 0 24px; font-size:15px; color:#374151;">
                Here are <strong>${permits.length} new permit${permits.length === 1 ? "" : "s"}</strong> pulled today that match your trade and service area:
              </p>

              <table width="100%" cellpadding="0" cellspacing="0">
                ${permitRowsHtml}
              </table>

              <div style="margin-top:32px; padding:16px; background:#eff6ff; border-radius:8px; border-left:4px solid #2563eb;">
                <p style="margin:0; font-size:13px; color:#1e40af;">
                  💡 <strong>Pro tip:</strong> These homeowners just pulled a permit — they're likely shopping for contractors right now. Reach out fast!
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px; background:#f3f4f6; border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 8px; font-size:12px; color:#9ca3af; text-align:center;">
                You're receiving this because you have an active PermitEarly subscription.
              </p>
              <p style="margin:0; font-size:12px; color:#9ca3af; text-align:center;">
                <a href="${APP_URL}/account" style="color:#6b7280; text-decoration:underline;">Manage account</a>
                &nbsp;·&nbsp;
                <a href="${APP_URL}/api/unsubscribe?email=${encodeURIComponent(contractor.email)}" style="color:#6b7280; text-decoration:underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const resendResp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `PermitEarly <${FROM_EMAIL}>`,
      to: [contractor.email],
      subject,
      html,
    }),
  });

  if (!resendResp.ok) {
    const errBody = await resendResp.text();
    console.error("Resend error:", resendResp.status, errBody);
    return new Response(JSON.stringify({ error: "Email send failed", detail: errBody }), {
      status: 502,
    });
  }

  const resendData = await resendResp.json();
  console.log(`Digest sent to ${contractor.email} | permits: ${permits.length} | resend_id: ${resendData.id}`);

  return new Response(JSON.stringify({ ok: true, resend_id: resendData.id }), {
    headers: { "Content-Type": "application/json" },
  });
});
