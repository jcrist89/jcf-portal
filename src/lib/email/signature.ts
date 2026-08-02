// Shared across every outbound email (welcome, and the Supabase Auth templates
// documented in supabase/email-templates/). Keep this in sync with those files
// if the signature ever changes.

export const SIGNATURE_HTML = `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:32px;padding-top:20px;border-top:1px solid #2a2a2a;width:100%;">
  <tr>
    <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#8A8A8A;">
      <div style="color:#D9A125;font-size:15px;font-weight:bold;">Jon Crist</div>
      <div>Owner | Jon Crist Fit LLC</div>
      <div>Strength Coach</div>
      <div>Custom Programming | Accountability | In-Person Mechanics Audits</div>
      <div style="margin-top:8px;">
        Email: <a href="mailto:jon@joncristfit.com" style="color:#F0C05A;text-decoration:none;">jon@joncristfit.com</a><br/>
        Phone: <a href="tel:+17403041338" style="color:#F0C05A;text-decoration:none;">(740) 304-1338</a><br/>
        Instagram: <a href="https://instagram.com/joncristfit" style="color:#F0C05A;text-decoration:none;">@joncristfit</a>
      </div>
    </td>
  </tr>
</table>`.trim();

export const SIGNATURE_TEXT = `
--
Jon Crist
Owner | Jon Crist Fit LLC
Strength Coach
Custom Programming | Accountability | In-Person Mechanics Audits
Email: jon@joncristfit.com
Phone: (740) 304-1338
Instagram: @joncristfit`;
