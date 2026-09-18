# M2-7 — three-day real-device pilot

**Status (2026-09-18, ninth run):** **may start now** — production serves the cloud build `0cd3673`
(`PREFLIGHT PASS`, database verified). **Day 0** = `M1_RELEASE_ACCEPTANCE.md` §3a on both phones (≈10
minutes; its reply closes M1), then days 1–3 below.
**Who:** Ariel and Elena, each on their own phone, using the app normally. No artificial QA.
**Length:** three ordinary days (start date recorded below when it begins).

## The one rule

Use the app as you would anyway: log what you eat when you eat it, look at each other's day when you
are curious, fix mistakes when you notice them. The pilot is the normal use itself; the only extra
effort is one line in the log when something felt slow, confusing or wrong.

## Friction log (one line per observation, in any language)

Keep it wherever is easiest (a shared note on the phones, WhatsApp to yourselves, or the table below
copied into a note). A screenshot is welcome but optional.

| Date/time  | Who   | What I was trying to do          | What felt slow / confusing / wrong | Severity (blocker · annoying · minor) | Note / screenshot |
| ---------- | ----- | -------------------------------- | ---------------------------------- | ------------------------------------- | ----------------- |
| 19.9 08:10 | Elena | add coffee at the morning window | had to tap three times             | annoying                              | _(example row)_   |

Severity guide: **blocker** = could not log or saw wrong data; **annoying** = worked but cost effort or a
second look; **minor** = cosmetic / wording.

Also worth one line, if it happens: "the app said ממתין לסנכרון / לא מקוון / הסנכרון נכשל and I did not
expect it", "something I logged appeared on the other person", "something I logged disappeared".

## What the app already tells you (no extra tools)

- Sync state next to the brand mark: **מסונכרן** (all confirmed) · **מסנכרן…** / **ממתין לסנכרון** ·
  **לא מקוון — יסתנכרן אחר כך** · **הסנכרון נכשל** (with a retry).
- Build identity in the footer: `build <sha> · cloud` — if it ever says `· demo` or shows a red
  block page, stop and report; that is a release problem, not a usage one.
- Old data from the demo build stays on the phone untouched and is not shown (M1-R5 pending).

## Known non-blocking limitations going in

- Entering an amount for weight/volume foods (150 גרם) is typed, not tapped — by design (no guessed
  defaults).
- Calories / macros are intentionally absent (DEC-004).
- "היסטוריה" opens the calendar; a day's contents are in the Day Review (tap the today card).

## After the three days (Claude)

Read the log, count the lines by severity and by step of the loop (home → meal → find → add →
quantity → finish → review), and select **M2-8 from that evidence only**. Record the pilot's start
date, deployed SHA and deployment id here when it starts.

| Field            | Value                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Pilot start      | _day 0 = the §3a walk-through; days 1–3 = the first three ordinary days after it_                  |
| Deployed SHA     | `0cd3673` (built 2026-09-18T12:18Z)                                                                |
| Deployment id    | `psr2.4acecc14-952f-41f4-aec6-94b6a541e8d9.1790339021.pQYI2WgswgAdhO-NblQztghHe2aS6FoOf7juczbjFq4` |
| Supabase project | `rqgoiuztphkcvbwtbxbj`                                                                             |
| M1 acceptance    | §2 PASS · DB verified · §3 item 9 PASS · items 1–8, 10 via §3a on the phones                       |
