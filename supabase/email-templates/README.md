# Supabase Auth email templates

Supabase Auth sends its own emails (invite, password reset) directly — there's no
code path in this app that builds them, so they can't be wired up like the welcome
email. They're edited by hand in the Supabase Dashboard instead:

**Dashboard → Authentication → Email Templates**

There are two templates this app actually triggers:

| Template | Where it fires | File here |
|---|---|---|
| Invite user | Coach adds a client from `/coach` (`admin.auth.admin.inviteUserByEmail`) | `invite.html` |
| Reset Password | `/forgot-password`, and the coach's "Reset Password" action on a client | `reset-password.html` |

The other built-in templates (Confirm signup, Magic Link, Change Email Address,
Reauthentication) aren't used by this app today — self-signup auto-confirms the
account (`email_confirm: true`), and there's no magic-link or email-change flow —
so there's nothing to update there unless that changes later.

## To apply

For each template above:

1. Open the matching `.html` file in this folder.
2. In the Supabase Dashboard, go to the matching template under Authentication →
   Email Templates.
3. Set the **Subject** field (see the comment at the top of each `.html` file for
   the subject to use).
4. Paste the full HTML into the template body editor and save.

Both templates use `{{ .ConfirmationURL }}`, which Supabase fills in automatically —
don't edit that part.

## Notes

- The logo is referenced as `https://joncristfit.com/logo-wordmark.png` — an absolute
  production URL, since email clients can't reach `localhost`. If the production
  domain ever changes, update the `<img src>` in both files.
- Both templates end in the same signature block used by the app's own welcome
  email (`src/lib/email/signature.ts`). If the signature ever changes, update it
  in three places: both files here, and that one.
