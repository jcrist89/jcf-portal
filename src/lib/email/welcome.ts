import { renderEmail } from "./layout";
import { SIGNATURE_TEXT } from "./signature";
import type { Tier } from "@/lib/types";

function firstName(fullName: string | null): string {
  if (!fullName) return "there";
  return fullName.trim().split(/\s+/)[0] || "there";
}

interface TierCopy {
  subject: string;
  intro: string;
  access: string[];
  setup: string[];
  closing: string;
}

function copyFor(tier: Tier): TierCopy {
  switch (tier) {
    case "paid_programming":
      return {
        subject: "Welcome to Programming — let's get to work",
        intro:
          "You're on Programming. On top of everything the Free plan gets you, you now have full control of your own program.",
        access: [
          "Full workout logging — sets, reps, weight, RPE, every session",
          "Progress tracking — bodyweight, measurements, and PR history with charts",
          "Edit your own program any time — sets, reps, RPE, structure, all of it",
          "Achievement badges as you hit milestones",
        ],
        setup: [
          "Log in and finish your quick onboarding (birthday, height, starting weight, a couple of measurements)",
          "Review the program I built for your goal under My Program, then tweak anything that doesn't fit your schedule or equipment",
          "Log every workout — that's your record and mine of what's actually working",
        ],
        closing:
          "Questions on programming, form, or anything else — email or call me, details below. Let's get to work.",
      };
    case "paid_coaching":
      return {
        subject: "Welcome to Coaching — I've got you",
        intro: "You're on Coaching. Full access, no gaps — I'm working this one with you directly.",
        access: [
          "A program I build and personally adjust for you",
          "Direct messaging with me, right in the app",
          "Priority feedback on your lifts and your log",
          "Full workout logging, progress tracking, and achievement badges",
        ],
        setup: [
          "Log in and finish your quick onboarding (birthday, height, starting weight, a couple of measurements)",
          "Send me a message from the Messages tab — tell me where you're starting and what you're chasing",
          "Log every workout so I can see what's happening and adjust in real time",
        ],
        closing: "I'm in your corner on this one. Let's get to work.",
      };
    case "free":
    default:
      return {
        subject: "Welcome to Jon Crist Fit — you're in",
        intro: "You're on the Free plan — here's what that gets you.",
        access: [
          "Your training program, built around the goal you picked at signup",
          "Full workout logging — sets, reps, weight, RPE, every session",
          "Progress tracking — bodyweight, measurements, and PR history with charts",
          "Achievement badges as you hit milestones",
        ],
        setup: [
          "Log in and finish your quick onboarding (birthday, height, starting weight, a couple of measurements)",
          "Head to My Program to see your first session",
          "Log every workout as you go — that's what turns this into a real record of your progress",
        ],
        closing:
          "Want more hands-on programming or direct access to me? Upgrade to Programming or Coaching any time from Billing. Let's get to work.",
      };
  }
}

export function buildWelcomeEmail(tier: Tier, fullName: string | null) {
  const name = firstName(fullName);
  const c = copyFor(tier);

  const accessHtml = c.access.map((item) => `<li style="margin-bottom:4px;">${item}</li>`).join("");
  const setupHtml = c.setup.map((item) => `<li style="margin-bottom:6px;">${item}</li>`).join("");

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hey ${name},</p>
    <p style="margin:0 0 16px;">${c.intro}</p>
    <ul style="margin:0 0 20px;padding-left:20px;">${accessHtml}</ul>
    <p style="margin:0 0 8px;color:#D9A125;font-weight:bold;text-transform:uppercase;font-size:12px;letter-spacing:0.05em;">Get set up</p>
    <ol style="margin:0 0 20px;padding-left:20px;">${setupHtml}</ol>
    <p style="margin:0;">${c.closing}</p>
  `.trim();

  const accessText = c.access.map((item) => `  - ${item}`).join("\n");
  const setupText = c.setup.map((item, i) => `  ${i + 1}. ${item}`).join("\n");
  const text = `Hey ${name},

${c.intro}

${accessText}

Get set up:
${setupText}

${c.closing}
${SIGNATURE_TEXT}`;

  return {
    subject: c.subject,
    html: renderEmail(bodyHtml),
    text,
  };
}
