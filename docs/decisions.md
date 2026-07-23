# Decisions

## מטרת המסמך

מסמך זה מרכז החלטות מוצר וארכיטקטורה פעילות.

החלטה חדשה גוברת על החלטה ישנה רק כאשר היא מסומנת במפורש כ-Superseded.

---

## DEC-001 — Supabase הוא מקור האמת

- תאריך: 2026-07-23
- סטטוס: Accepted

### הקשר

האפליקציה משותפת לשני משתמשים וצריכה להסתנכרן בין מכשירים ודפדפנים.

### החלטה

Supabase ישמש כמקור האמת עבור נתוני האפליקציה.

Local Storage או IndexedDB ישמשו רק ל-Cache או Offline Queue.

### השלכות

- כל שינוי Schema יתבצע באמצעות Migration.
- RLS הוא חובה.
- יש לתמוך ב-Realtime.
- אין להסתמך על State מקומי כנתון סופי.

---

## DEC-002 — Household משותף עם שני Profiles

- תאריך: 2026-07-23
- סטטוס: Accepted

### הקשר

האפליקציה משמשת את המשתמש ואת אלנה, וכל אחד יכול לצפות ולעדכן את שני האזורים.

### החלטה

יוגדר Household אחד ובתוכו שני Profiles נפרדים.

### השלכות

- הנתונים נשמרים לפי `household_id` ו-`profile_id`.
- המבנה והיכולות זהים לשני Profiles.
- אין Roles שונים ב-MVP.
- מעבר Profile מתבצע בלחיצה אחת.

---

## DEC-003 — יום מלא נקבע רק לפי Meal Slots

- תאריך: 2026-07-23
- סטטוס: Accepted

### הקשר

Calendar צריך להציג שלמות תיעוד ולא איכות תזונה.

### החלטה

יום מלא, חלקי או ריק יחושב רק לפי ששת חלונות האכילה.

צום, אימון ושקילה אינם משפיעים על סטטוס היום ב-MVP.

### השלכות

- כל Meal Slot צריך להיות `logged`, `skipped` או `unmarked`.
- יש לממש Logic מרכזי אחד.
- אין להציג את הצבע כמדד בריאותי.

---

## DEC-004 — אין ספירת קלוריות ב-MVP

- תאריך: 2026-07-23
- סטטוס: Accepted

### הקשר

המוצר מיועד קודם כל לתיעוד עקבי ופשוט.

### החלטה

לא יישמרו ולא יוצגו קלוריות, Macros או ציוני איכות מזון ב-MVP.

### השלכות

- Food catalog נשאר פשוט.
- הוספת מזון מהירה יותר.
- Nutrition metadata נשמר ל-Roadmap עתידי בלבד.

---

## DEC-005 — Auto Save ללא כפתור Save מרכזי

- תאריך: 2026-07-23
- סטטוס: Accepted

### הקשר

המוצר צריך לצמצם חיכוך והקלדה.

### החלטה

כל שינוי יישמר אוטומטית.

### השלכות

- פעולות פשוטות ישתמשו ב-mutation מיידי.
- טקסט חופשי ישתמש ב-Debounce ו-Blur לפי הצורך.
- ה-UI יציג Saving, Saved, Offline ו-Sync failed כאשר רלוונטי.

---

## DEC-006 — שתי שיטות כמות נשמרות כפי שהוזנו

- תאריך: 2026-07-23
- סטטוס: Accepted

### הקשר

לא תמיד ניתן או רצוי למדוד מזון במספרים.

### החלטה

Food entry יתמוך ב:

- `measured`
- `subjective`

אין להמיר כמות תחושתית לערך מספרי.

### השלכות

- המודל שומר `quantity_mode`.
- Validation שונה לכל מצב.
- Analytics עתידי חייב להבחין בין הסוגים.

---

## DEC-007 — Meal Slot יכול להיות מסומן כ-Skipped

- תאריך: 2026-07-23
- סטטוס: Accepted

### הקשר

יש להבחין בין ארוחה שלא נאכלה לבין ארוחה שלא תועדה.

### החלטה

כל Meal Slot יכול להיות מסומן במפורש כ-`skipped`.

### השלכות

- `skipped` נחשב מלא לצורך שלמות תיעוד.
- ניתן לבטל את הסימון ולהוסיף מזון.
- הסימון אינו מוצג כהצלחה או ככישלון.

---

## DEC-008 — Mobile First

- תאריך: 2026-07-23
- סטטוס: Accepted

### הקשר

רוב פעולות התיעוד צפויות להתבצע בטלפון.

### החלטה

כל מסך יתוכנן קודם ל-Mobile ורק לאחר מכן ל-Tablet ו-Desktop.

### השלכות

- Touch targets גדולים.
- אין תלות ב-Hover.
- Bottom Sheets מותרים כאשר מתאימים.
- Banner תחתון חייב לשמור Safe Area ולא להסתיר תוכן.

---

## DEC-009 — טון לא שיפוטי

- תאריך: 2026-07-23
- סטטוס: Accepted

### הקשר

האפליקציה עוסקת בתזונה ומשקל ועלולה ליצור לחץ או אשמה.

### החלטה

הטון יהיה ענייני, נעים, תומך ומאופק.

אין להשתמש בציונים, Shame או מחמאות מוגזמות.

### השלכות

- צבעים מציינים מצב או כיוון בלבד.
- אין ניסוחים כמו `נכשלת` או `יום מושלם`.
- Empty ו-Error states נשארים ניטרליים.

---

## DEC-010 — Offline Queue היא דרישת אמינות

- תאריך: 2026-07-23
- סטטוס: Accepted

### הקשר

אין לאבד נתונים עקב Refresh, סגירת Tab או ניתוק זמני.

### החלטה

יש לממש Offline Queue עם Retry ו-Idempotency.

### השלכות

- לכל פעולה יהיה מזהה ייחודי.
- יש למנוע כפילויות.
- יש להציג חיווי מקומי ברור.
- Supabase נשאר מקור האמת לאחר סנכרון.

---

## DEC-011 — Stack בפועל ייקבע לפי Repository

- תאריך: 2026-07-23
- סטטוס: Accepted

### הקשר

מסמך הארכיטקטורה מציע React, TypeScript, Vite ו-Tailwind, אך לא סופק Repository לבדיקה.

### החלטה

אין להחליף Framework או Stack לפני בדיקת הקוד הקיים.

### השלכות

- יש לבצע Repository audit.
- יש לשמור על Stack מודרני שנוצר בפועל ב-Lovable, אם הוא מתאים.
- שינוי Framework דורש צורך מהותי ומתועד.

---

## DEC-012 — שמות ה-Profiles: אריאל ואלנה

- תאריך: 2026-07-23
- סטטוס: Accepted

### החלטה

ה-Profiles מוצגים כ-`אריאל` ו-`אלנה`. אין להציג את המילה "אני" בשום מקום ב-UI.

### השלכות

- מזהי הפנים נשארים `me` / `elena` בקוד; רק שם התצוגה השתנה (`PROFILES` ב-`store.tsx`).
- הבדיקה `store.test.tsx` מוודאת הפרדת נתונים בין ה-Profiles.

---

## DEC-013 — שמות ששת חלונות האכילה עודכנו; "ארוחת לילה" הוסרה

- תאריך: 2026-07-23
- סטטוס: Accepted (מעדכן ניסוח ב-DEC-003, לא את הלוגיקה)

### החלטה

שמות ששת החלונות: פתיחת חלון אכילה, נשנוש ראשון, ארוחה מרכזית, נשנוש אחר הצהריים, ארוחת ערב,
ארוחה נוספת. השם "ארוחת לילה" אינו בשימוש.

### השלכות

- מזהה החלון השישי נשאר `late` בקוד; רק ה-label ב-`meal-slots.ts` השתנה ל"ארוחה נוספת".
- שלמות היום עדיין נקבעת רק לפי ששת החלונות (DEC-003 בתוקף).
- מכוסה ב-`meal-slots.test.ts` (כולל ווידוא שאין "ארוחת לילה").

---

## DEC-014 — קפה כמאפייני Food-Entry מובנים

- תאריך: 2026-07-23
- סטטוס: Accepted

### הקשר

תיעוד קפה הוא דרישת MVP מאושרת, ונדרש מודל עתידי-בטוח שאינו טקסט חופשי.

### החלטה

קפה הוא Food entry רגיל (`foodId: "f_coffee"`, `Food.kind: "coffee"`) עם אובייקט מובנה
`FoodEntry.coffee: CoffeeMeta = { type, milk, milkType?, note? }`. הכמות במודל `measured`
עם יחידות קפה (כוס / ספל / יחידה / מ״ל).

### השלכות

- `milkType` תקף רק עם "עם חלב" ומתאפס במעבר ל"ללא חלב" (`normalizeCoffee`).
- לוגיקה ב-`src/lib/coffee.ts`, בדיקות ב-`coffee.test.ts` ו-`CoffeeSelector.test.tsx`.
- מיפוי עתידי ל-Supabase יכול לשמור את `coffee` כ-JSONB עם Validation, או כטבלת attributes.

---

## DEC-015 — Persistence ביניים ב-localStorage

- תאריך: 2026-07-23
- סטטוס: Accepted (זמני; אינו מבטל את DEC-001)

### הקשר

אין עדיין Supabase, אך נדרש שלא לאבד נתונים ב-Refresh / מעבר תאריך / מעבר Profile.

### החלטה

Persistence זמני ב-localStorage דרך `src/lib/persistence.ts` (SSR-safe), מאחורי אותו API של ה-Store.

### השלכות

- זהו Cache/Persistence זמני בלבד — Supabase יישאר מקור האמת (DEC-001) ויחליף שכבה זו.
- Hydration מתרחש ב-mount בצד הלקוח; ה-seed מוצג תחילה ואז מוחלף בנתונים השמורים.
- מכוסה ב-`store.test.tsx` (ווידוא שרידות לאחר mount מחדש).

---

## DEC-016 — Testing Stack: Vitest + Testing Library

- תאריך: 2026-07-23
- סטטוס: Accepted

### הקשר

ה-Repository לא כלל כלי בדיקות; נדרש כיסוי לוגיקה קריטית.

### החלטה

נוספו Vitest, jsdom ו-Testing Library עם `vitest.config.ts` נפרד (ללא ה-SSR plugin).
Scripts: `npm test`, `npm run test:watch`, `npm run typecheck`.

### השלכות

- 54 בדיקות: completion, coffee, fasting, weight, quantity, meal-slots, store integration, CoffeeSelector.
- הרצה מהירה ומבודדת מ-SSR/nitro.

---

## DEC-017 — חשבון Auth משותף אחד + שני פרופילים פנימיים (Supabase כמקור אמת)

- תאריך: 2026-07-23
- סטטוס: Accepted (מממש את DEC-001 ו-DEC-002)

### הקשר

נדרש Backend אמיתי לסנכרון בין מכשירים, אך ללא ניהול שני משתמשי Auth נפרדים לאריאל ולאלנה.

### החלטה

חשבון Supabase Auth **משותף אחד** למשק הבית, ותחתיו **שני פרופילים פנימיים** (אריאל/אלנה).
שני הפרופילים נגישים מאותו Session; ההפרדה היא לפי `profile_id`. אין למפות את אריאל/אלנה ל-`auth.users`.

### מימוש

- Migrations: schema (10 טבלאות, UUID, timestamptz, constraints), RLS (פונקציית `is_household_member`
  SECURITY DEFINER, 35 policies), `bootstrap_household()` idempotent, ו-Realtime ל-8 טבלאות.
- שכבות: client + generated types + repositories + auth + sync (offline queue, migration, realtime),
  משולבות ב-Store מאחורי דגל `isSupabaseConfigured()`; במצב דמו הכל אינרטי.
- `localStorage` יורד מלהיות מקור אמת — משמש רק ל-offline queue / cache / migration marker (מעדכן DEC-015).

### אימות

מול Supabase מקומי (CLI + Docker): כל ה-migrations הוחלו; בדיקת אינטגרציה חיה (5/5) אימתה bootstrap,
כתיבה/קריאה של שני הפרופילים מהחשבון המשותף, אילוץ הקפה, בידוד בין משקי בית (RLS) ודחיית קריאה אנונימית.

### השלכות / פתוח

- נדרשים `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (anon בלבד; לעולם לא service_role).
- אימות end-to-end בדפדפן (התחברות + realtime בין שני sessions) טרם בוצע אוטומטית — דורש credentials אמיתיים או הרצה מקומית.
