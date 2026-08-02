import { SIGNATURE_HTML } from "./signature";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://joncristfit.com";

/** Wraps a content fragment in the branded JCF email shell (dark panel, gold
 * accent, wordmark header) and appends the standard signature. */
export function renderEmail(bodyHtml: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0;padding:0;background-color:#0a0a0a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:520px;background-color:#1c1c1c;border:1px solid #2a2a2a;border-radius:4px;">
            <tr>
              <td style="padding:28px 32px 4px;text-align:center;">
                <img src="${SITE_URL}/logo-wordmark.png" alt="Jon Crist Fit" height="34" style="height:34px;width:auto;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 32px;font-family:Arial,Helvetica,sans-serif;color:#F5F5F5;font-size:15px;line-height:1.6;">
                ${bodyHtml}
                ${SIGNATURE_HTML}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
