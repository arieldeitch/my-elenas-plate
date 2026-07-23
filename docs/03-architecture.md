# Architecture

## 1. מטרת הארכיטקטורה

הארכיטקטורה צריכה לתמוך ב:

- פיתוח מהיר באמצעות Lovable ו-Claude Code
- תחזוקה פשוטה
- Supabase כמקור האמת
- Real-time Sync
- שני משתמשים תחת Household משותף
- הרחבת Analytics ו-Dashboard בעתיד
- שמירת נתונים אמינה
- מינימום פעולות ידניות מצד המשתמש

אין לבנות תשתיות מורכבות שאינן נדרשות ל-MVP.

---

## 2. Tech Stack מועדף

יש להעדיף את ה-Stack שנוצר בפועל על ידי Lovable, כל עוד הוא מודרני ומתאים לדרישות.

Stack טיפוסי מועדף:

- React
- TypeScript
- Vite
- Tailwind CSS
- Component Library עקבית
- Supabase
- GitHub
- Claude Code

אין להחליף Framework ללא צורך מהותי.

---

## 3. מבנה לוגי

המערכת מורכבת מהתחומים הבאים:

- Household
- Profiles
- Daily Logs
- Meal Slots
- Food Catalog
- Food Entries
- Fasting Logs
- Workout Logs
- Weigh-ins
- Sync State
- Application Settings

יש לשמור הפרדה בין:

- UI Components
- Domain Logic
- Data Access
- Validation
- Formatting
- Sync Logic

---

## 4. Household ומודל גישה

יש ליצור Household אחד עבור שני המשתמשים.

ה-Household כולל שני Profiles:

- המשתמש
- אלנה

הגישה לנתונים תהיה משותפת לשניהם.

גם כאשר משתמשים ב-URL משותף:

- אין לאפשר גישה ציבורית אנונימית למסד הנתונים
- יש להשתמש ב-Supabase Auth או Session מאובטח
- יש להגן על הנתונים באמצעות Row Level Security
- כל רשומה צריכה להיות משויכת ל-Household ול-Profile המתאים

מימוש ה-Login יכול להיות מינימלי ואינו צריך להוסיף חיכוך יומיומי.

---

## 5. ישויות מרכזיות

### households

שדות מוצעים:

- `id`
- `name`
- `created_at`
- `updated_at`

### profiles

שדות מוצעים:

- `id`
- `household_id`
- `display_name`
- `avatar_key`
- `sort_order`
- `is_active`
- `created_at`
- `updated_at`

### meal_slots

רשימת סוגי הארוחות.

שדות מוצעים:

- `id`
- `key`
- `display_name`
- `icon_key`
- `sort_order`
- `is_active`

ערכים ראשוניים:

- `breakfast`
- `morning_snack`
- `lunch`
- `afternoon_snack`
- `dinner`
- `late_meal`

### daily_meal_statuses

נועד להבדיל בין ארוחה ריקה לבין ארוחה שלא נאכלה.

שדות מוצעים:

- `id`
- `household_id`
- `profile_id`
- `log_date`
- `meal_slot_id`
- `status`

ערכי `status`:

- `unmarked`
- `logged`
- `skipped`

Constraint מומלץ:

- רשומה ייחודית לכל `profile_id + log_date + meal_slot_id`

### foods

שדות מוצעים:

- `id`
- `household_id`
- `name`
- `normalized_name`
- `category`
- `default_unit`
- `allowed_units`
- `is_active`
- `created_by_profile_id`
- `created_at`
- `updated_at`

### food_entries

שדות מוצעים:

- `id`
- `household_id`
- `profile_id`
- `log_date`
- `meal_slot_id`
- `food_id`
- `quantity_mode`
- `numeric_amount`
- `unit`
- `subjective_amount`
- `notes`
- `created_at`
- `updated_at`
- `deleted_at`

ערכי `quantity_mode`:

- `measured`
- `subjective`

ערכי `subjective_amount`:

- `little`
- `moderate`
- `a_lot`
- `excessive`

### profile_food_preferences

שדות מוצעים:

- `id`
- `profile_id`
- `food_id`
- `is_favorite`
- `use_count`
- `last_used_at`
- `created_at`
- `updated_at`

Constraint:

- רשומה ייחודית לכל `profile_id + food_id`

### fasting_logs

שדות מוצעים:

- `id`
- `household_id`
- `profile_id`
- `start_at`
- `end_at`
- `duration_minutes`
- `created_at`
- `updated_at`

יש לתמוך בחלון שעובר בין תאריכים.

### workout_logs

שדות מוצעים:

- `id`
- `household_id`
- `profile_id`
- `log_date`
- `performed`
- `workout_type`
- `feeling`
- `notes`
- `created_at`
- `updated_at`

Constraint:

- לכל היותר רשומה יומית אחת לכל Profile ב-MVP

### weigh_ins

שדות מוצעים:

- `id`
- `household_id`
- `profile_id`
- `measured_at`
- `weight_kg`
- `body_fat_percentage`
- `fat_mass_kg`
- `created_at`
- `updated_at`

יש להשתמש ב-Decimal מתאים ולא ב-Floating Point לא מדויק.

---

## 6. שלמות תיעוד יומי

יש לחשב את סטטוס היום מתוך `daily_meal_statuses`.

### Full

כל ששת חלונות האכילה הם:

- `logged`
- או `skipped`

### Partial

לפחות חלון אחד הוא:

- `logged`
- או `skipped`

ולפחות חלון אחד הוא:

- `unmarked`
- או חסר

### Empty

כל החלונות הם:

- `unmarked`
- או חסרים

צום, אימון ושקילה אינם חלק מהחישוב ב-MVP.

ניתן לחשב את הסטטוס:

- באמצעות Query
- באמצעות Database View
- באמצעות RPC
- בשכבת ה-Application

יש להעדיף פתרון עקבי שאינו משכפל Logic בכמה מקומות.

---

## 7. Supabase

Supabase משמש עבור:

- PostgreSQL Database
- Authentication
- Row Level Security
- Realtime
- Migrations
- Generated Types, כאשר מתאים

כל שינוי Schema צריך להתבצע באמצעות Migration.

אין לבצע שינוי ידני ב-Production שאינו מתועד ב-repository.

---

## 8. Row Level Security

RLS הוא חובה לכל טבלה בעלת נתוני משתמש.

Policy בסיסית:

- משתמש מחובר יכול לקרוא ולשנות רק נתונים של Household שאליו הוא משויך.

אין להשתמש ב-Service Role בצד ה-Client.

Secrets לא יישמרו ב-Git.

---

## 9. Real-time Sync

יש להאזין לשינויים הרלוונטיים ל:

- Food Entries
- Daily Meal Statuses
- Fasting Logs
- Workout Logs
- Weigh-ins
- Foods
- Profile Food Preferences

יש לסנן subscriptions לפי Household ו-Profile כאשר ניתן.

יש למנוע:

- כפילות אירועים
- Loop של עדכונים
- Over-fetching
- רינדורים מיותרים

כאשר מתקבל שינוי מה-Realtime:

- יש לעדכן Cache מקומי
- אין לבצע Reload מלא של המסך ללא צורך

---

## 10. Auto Save

Auto Save הוא ברירת המחדל.

עבור פעולות פשוטות:

- ביצוע mutation מיידי
- Optimistic Update
- Rollback במקרה של כשל

עבור הקלדה חופשית:

- שימוש ב-Debounce
- שמירה לאחר הפסקת הקלדה
- שמירה נוספת ב-Blur כאשר נדרש

יש להציג חיווי שמירה רק כאשר הוא מוסיף מידע אמיתי.

---

## 11. Offline Queue

יש לשמור פעולות שלא סונכרנו כאשר אין חיבור.

כל פעולה בתור צריכה לכלול:

- מזהה ייחודי
- סוג הפעולה
- Entity
- Payload
- זמן יצירה
- מספר ניסיונות
- סטטוס
- מזהה Idempotency כאשר נדרש

עם חזרת החיבור:

1. יש לבדוק Session.
2. יש לשלוח פעולות לפי סדר בטוח.
3. יש למנוע יצירת רשומות כפולות.
4. יש לעדכן את ה-UI.
5. יש להסיר פעולות שאושרו.
6. יש להשאיר פעולות שנכשלו עם חיווי ברור.

Local Storage או IndexedDB יכולים לשמש לתור זמני בלבד.

הם אינם מקור האמת.

---

## 12. Conflict Resolution

במקרה של עריכה משני מכשירים:

- יש להשתמש ב-`updated_at`
- יש לשקול Last Write Wins עבור שדות פשוטים
- יש להימנע מדריסת רשומה שלמה כאשר משתנה שדה בודד
- יש לבצע mutations ממוקדים
- יש להציג Conflict רק כאשר קיים סיכון ממשי לאובדן מידע

לפריטי מזון נפרדים יש להשתמש ברשומות נפרדות במקום Array אחד גדול.

---

## 13. Validation

יש לבצע Validation ב:

- Client
- Database Constraints

כללים לדוגמה:

- משקל חייב להיות חיובי.
- אחוז שומן בין 0 ל-100.
- כמות מספרית חייבת להיות חיובית.
- במצב מדיד נדרשים Amount ו-Unit.
- במצב תחושתי נדרש Subjective Amount.
- שם מאכל אינו יכול להיות ריק.
- תאריך הרשומה חייב להיות תקין.

יש להשתמש ב-Schema Validation עקבי.

---

## 14. חישובים

### Fat Mass

`fat_mass_kg = weight_kg × body_fat_percentage / 100`

יש לעגל לתצוגה בלבד.

אין לפגוע בדיוק הערך הנשמר.

### Weight Delta

`weight_delta = latest_weight - previous_weight`

### Fasting Duration

`duration = end_at - start_at`

יש להתמודד עם:

- מעבר חצות
- Time Zone
- Daylight Saving כאשר רלוונטי

---

## 15. Time Zone

יש לשמור Timestamps ב-UTC.

תאריכים יומיים יוצגו ויחושבו לפי Time Zone של ה-Household.

אין להסיק תאריך יומי ישירות מ-UTC ללא המרה.

יש לשמור `log_date` כשדה Date עבור נתונים השייכים ליום מקומי.

---

## 16. Cache ו-State

יש להעדיף Server State Library עקבית כאשר היא קיימת בפרויקט.

יש להפריד בין:

- Server State
- Local UI State
- Form State
- Offline Queue

אין לשכפל את אותו מידע במספר Stores ללא צורך.

---

## 17. Component Architecture

רכיבים אפשריים:

- `ProfileSwitcher`
- `DateNavigator`
- `DailyCompletionIndicator`
- `MealCard`
- `MealEditor`
- `FoodSearch`
- `FoodPicker`
- `QuantitySelector`
- `FastingCard`
- `WorkoutCard`
- `CalendarView`
- `WeightBanner`
- `WeighInForm`
- `SyncStatus`

יש להימנע מרכיבים גדולים מדי.

יש לשמור Domain Logic מחוץ לרכיבי תצוגה כאשר הוא מורכב.

---

## 18. Testing

בדיקות חשובות:

- חישוב שלמות יום
- חישוב Fat Mass
- חישוב Weight Delta
- צום שעובר חצות
- מעבר בין Profiles
- Realtime update
- Offline Queue
- Retry ללא כפילות
- Food quantity validation
- RLS Policies
- Mobile interaction

אין צורך להגיע ל-100% Coverage.

יש להתמקד בזרימות קריטיות ובחישובים.

---

## 19. Observability

ב-MVP יש לכלול Logging בסיסי עבור:

- שגיאות שמירה
- שגיאות Sync
- שגיאות Auth
- Migration failures
- Exceptions בלתי צפויים

אין לרשום מידע בריאותי רגיש ל-Console או לכלי Analytics ללא צורך.

---

## 20. הרחבה עתידית

הארכיטקטורה צריכה לאפשר בעתיד:

- Dashboard
- Aggregations
- Nutrition Metadata
- Goals
- Recommendations
- Agents
- Image Input
- Voice Input

אין לממש יכולות אלה לפני שהן מאושרות ל-Scope.

---

## עדכון 2026-07-23 — מצב בפועל ומודל הקפה

### מצב בפועל

- Framework בפועל: **TanStack Start (SSR) + React 19**, Vite 8, Tailwind 4, shadcn/ui. אין Supabase.
- שכבות הקוד קיימות ומופרדות: טיפוסים (`src/lib/domain.ts`), לוגיקה טהורה ונבדקת
  (`completion.ts`, `coffee.ts`, `fasting.ts`, `weight.ts`, `quantity.ts`), State
  (`src/lib/store.tsx`), Persistence זמני (`src/lib/persistence.ts`), UI (`src/components/nutrition/*`).
- ה-Store חושף API בסגנון Repository כדי ש-Supabase יחליף את המימוש הפנימי בעתיד בלי לגעת ב-UI.

### מודל הקפה

- `Food.kind?: "generic" | "coffee"`. פריט הקפה (`f_coffee`) מסומן `kind: "coffee"`.
- `FoodEntry.coffee?: CoffeeMeta` כאשר `CoffeeMeta = { type, milk, milkType?, note? }`.
- אילוצים (נאכפים ב-`coffee.ts`, ונבדקים): נדרש `type` תקין; `milk` ∈ {ללא חלב, עם חלב};
  `milkType` תקף רק עם "עם חלב" ומתאפס אחרת.
- מיפוי עתידי ל-Supabase: לשמור את `coffee` כ-JSONB עם CHECK/validation, או כטבלת
  `food_entry_attributes`. הכמות נשמרת במודל measured הקיים.

### Persistence זמני

- `src/lib/persistence.ts` שומר/טוען את מפות הנתונים ב-localStorage (מפתח `elenas-plate:v1`),
  SSR-safe. זהו Cache זמני בלבד — Supabase יישאר מקור האמת (DEC-001) ויחליף שכבה זו.

---

## עדכון 2026-07-23 — מימוש Supabase (חשבון משותף, ראו DEC-017)

### סכימה (supabase/migrations/)

- טבלאות: households, household_users, profiles, foods, food_preferences, meal_statuses,
  food_entries, fasting_logs, workout_logs, weigh_ins. UUID PK, timestamptz, טריגר `updated_at`.
- Meal slot slugs: `opening_window / first_snack / main_meal / afternoon_snack / dinner / extra_meal`.
  סטטוסים: `unmarked / logged / skipped`. Quantity: `measured / subjective`.
  קפה נשמר ב-`food_entries.coffee` (JSONB) עם CHECK: `type` חובה, `milkType` רק כש-milk="עם חלב".
- אילוצים: משקל חיובי, אחוז שומן 0–100, measured דורש amount+unit, subjective דורש ערך.

### RLS + Bootstrap

- `public.is_household_member(hid uuid)` — SECURITY DEFINER, `search_path=public` (מונע רקורסיה).
- על כל 10 הטבלאות RLS מופעל; policies ל-select/insert/update/delete לפי `is_household_member(household_id)`.
- `public.bootstrap_household()` — RPC idempotent, SECURITY DEFINER: יוצר household + חברות + שני פרופילים
  (ariel/alena) אם אינם קיימים; מחזיר את ה-household הקיים אחרת.

### Realtime + שכבות אפליקציה

- Publication `supabase_realtime` כולל 8 טבלאות נתונים.
- `src/lib/supabase/*` (client SSR-safe, generated types, mappers טהורים, repositories, auth),
  `src/lib/sync/*` (offline queue, migrate-local, supabase-sync, use-supabase-sync),
  `src/components/auth/*` (SignIn, AuthGate). האינטגרציה ב-Store מגודרת ב-`isSupabaseConfigured()`.

### Optimistic + Offline + Migration

- עדכון אופטימי = עדכון ה-state המקומי הסינכרוני הקיים; דחיפה ל-Supabase מגובה ב-offline queue
  (`elenas-plate:queue:v1`, dedupe לפי client mutation id, quarantine אחרי כשלים).
- Migration חד-פעמי מ-localStorage (טרנספורם טהור ונבדק) עם marker; אינו מוחק נתונים מקומיים.
- מיפוי slot/status/subjective/coffee מרוכז ב-`mappers.ts` ונבדק ביחידה.

### עדכון T-027 — מאכלים מותאמים + מועדפים + אחרונים (DEC-018)

- `useSupabaseSync` מסנכרן גם `foods` (מאכלים מותאמים, household-scoped, soft-delete ב-`is_active`) וגם
  `food_preferences` (מועדפים/אחרונים לפי פרופיל). Hydrate ממזג קטלוג מובנה + מותאם; `deriveFavoritesRecents`
  גוזר את הרשימות. Push עם dirty-tracking נפרד ל-foods/prefs; realtime מנוי גם ל-`foods`+`food_preferences`.
- Migration `20260723090400`: `food_preferences.food_id` → `text` (ללא FK) כדי לתמוך במזהי מאכל מובנים ומותאמים.
- Migration מקומי→ענן הורחב (marker נפרד `foods:v1`) לייבוא מאכלים מותאמים + מועדפים + אחרונים.
