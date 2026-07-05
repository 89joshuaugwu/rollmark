/**
 * Shared HTML email shell for every RollMark notification email.
 *
 * Deliberately table-based layout with inline styles on every element that
 * matters — this is NOT how you'd write normal HTML/CSS, but email clients
 * (Outlook desktop especially, which renders HTML via Word's engine, not a
 * browser engine) ignore or strip most modern CSS: flexbox/grid don't work,
 * external stylesheets get stripped, and `<style>` blocks are inconsistently
 * honored. Tables + inline styles are the only approach that renders
 * correctly everywhere. The `<style>` block below is progressive
 * enhancement only (mobile responsiveness, dark-mode meta hints) — clients
 * that ignore it still get a perfectly readable, correctly laid out email
 * from the inline styles and table structure alone.
 *
 * The logo is a PNG (`/public/logo-email.png`), not the app's SVG — SVG
 * images are blocked outright by Outlook and several webmail clients, so
 * this is a separate rasterized asset kept in sync with logo.svg by hand.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://rollmark.vercel.app";
const EMERALD = "#10B981";
const INK = "#0B0F0E";
const BODY_BG = "#F4F6F5";
const CARD_BG = "#FFFFFF";
const TEXT_MUTED = "#6B7280";

interface EmailButton {
  label: string;
  href: string;
}

export function renderEmail(opts: {
  previewText: string;
  heading: string;
  bodyHtml: string; // trusted server-generated HTML only, never raw user input
  button?: EmailButton;
}): string {
  const { previewText, heading, bodyHtml, button } = opts;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>RollMark</title>
<style>
  @media only screen and (max-width: 600px) {
    .rm-container { width: 100% !important; }
    .rm-padding { padding-left: 20px !important; padding-right: 20px !important; }
    .rm-heading { font-size: 20px !important; }
  }
  a.rm-button:hover { opacity: 0.92; }
</style>
</head>
<body style="margin:0; padding:0; background-color:${BODY_BG}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <!-- Preview text: shows in inbox list, hidden in the email body itself -->
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
    ${previewText}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BODY_BG};">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" class="rm-container" width="560" cellpadding="0" cellspacing="0" style="width:560px; max-width:100%;">

          <!-- Header / logo -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <a href="${APP_URL}" style="text-decoration:none;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right: 8px; vertical-align: middle;">
                      <img src="${APP_URL}/logo-email.png" width="28" height="28" alt="RollMark"
                           style="display:block; border-radius:6px;" />
                    </td>
                    <td style="vertical-align: middle;">
                      <span style="font-size:18px; font-weight:700; color:${INK};">RollMark</span>
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td class="rm-padding" style="background-color:${CARD_BG}; border-radius:16px; padding: 36px 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
              <h1 class="rm-heading" style="margin:0 0 16px; font-size:22px; line-height:1.3; color:${INK}; font-weight:700;">
                ${heading}
              </h1>
              <div style="font-size:15px; line-height:1.6; color:#374151;">
                ${bodyHtml}
              </div>
              ${
                button
                  ? `
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 28px;">
                <tr>
                  <td style="border-radius:10px; background-color:${EMERALD};">
                    <a href="${button.href}" class="rm-button"
                       style="display:inline-block; padding:12px 24px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:10px;">
                      ${button.label} &rarr;
                    </a>
                  </td>
                </tr>
              </table>`
                  : ""
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 16px 8px;">
              <p style="margin:0 0 6px; font-size:12px; color:${TEXT_MUTED};">
                <a href="${APP_URL}" style="color:${TEXT_MUTED}; text-decoration:underline;">rollmark.vercel.app</a>
                &nbsp;·&nbsp;
                <a href="${APP_URL}/dashboard/settings" style="color:${TEXT_MUTED}; text-decoration:underline;">
                  Notification settings
                </a>
              </p>
              <p style="margin:0; font-size:11px; color:#9CA3AF;">
                QR-code attendance tracking for Nigerian universities.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Small reusable "stat pill" block for numbers inside an email body. */
export function statRow(items: { label: string; value: string | number }[]): string {
  const cells = items
    .map(
      (item) => `
      <td align="center" style="padding: 16px 12px; background-color:#F8FAFC; border-radius:12px;">
        <div style="font-size:24px; font-weight:700; color:${INK};">${item.value}</div>
        <div style="font-size:12px; color:${TEXT_MUTED}; margin-top:2px;">${item.label}</div>
      </td>`
    )
    .join(`<td style="width:10px;"></td>`);

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>${cells}</tr>
    </table>`;
}
