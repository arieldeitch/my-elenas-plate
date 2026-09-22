-- ============================================================================
-- Reference-only foods (DEC-036, 2026-09-22). Additive, forward-only, idempotent,
-- backward-compatible; rollback at the bottom. No row is deleted or rewritten.
--
-- WHY
--   The points reference is now the ONLY source of the active food list and of
--   every new points value. A legacy catalog food may appear only through a
--   verified link to an active reference food; a custom food is a PERSONAL
--   ALIAS of a reference food (its points come from there), never a value of
--   its own. Hidden/linked state is derived at runtime from the reference +
--   the aliases below — nothing needs a flag column, and history is untouched.
--
-- WHAT
--   1. foods.reference_group_key  — the explicit link of a personal alias to
--      its reference food (normalized reference name = group key). Nullable.
--   2. food_reference_aliases      — the verified aliases shipped with the app
--      (src/data/points-reference/aliases.v1.json), seeded idempotently
--      (upsert on normalized_alias + item_id). Read-only for the app (RLS from
--      20260921120000); the bundled JSON is what the client uses.
--   The DEC-035 custom-value columns (points_per_portion / points_status /
--   points_confirmed_at / portion_*) are no longer written; they stay for the
--   rows that already hold them (history).
-- ============================================================================

alter table public.foods add column if not exists reference_group_key text;
create index if not exists foods_reference_group_idx
  on public.foods (household_id, reference_group_key)
  where reference_group_key is not null;

-- >>> BEGIN GENERATED ALIAS SEED
-- 76 verified aliases (aliases-v1-2026-09-22) → anchor rows of reference v1-2026-09-21.
insert into public.food_reference_aliases (item_id, alias, normalized_alias, verified, origin)
values
  ('77ac37ce-7a76-537c-8dac-a22c80ce46a9'::uuid, 'תפוח', 'תפוח', true, 'aliases-v1-2026-09-22'),
  ('6d76b2a0-0928-5870-83e9-c8142ff93c9c'::uuid, 'עגבנייה', 'עגבניה', true, 'aliases-v1-2026-09-22'),
  ('6d76b2a0-0928-5870-83e9-c8142ff93c9c'::uuid, 'עגבניות שרי', 'עגבניות שרי', true, 'aliases-v1-2026-09-22'),
  ('6ea3914f-48d8-5e98-8e00-2d144ea3aa19'::uuid, 'פלפל אדום', 'פלפל אדום', true, 'aliases-v1-2026-09-22'),
  ('6ea3914f-48d8-5e98-8e00-2d144ea3aa19'::uuid, 'פלפל ירוק', 'פלפל ירוק', true, 'aliases-v1-2026-09-22'),
  ('6ea3914f-48d8-5e98-8e00-2d144ea3aa19'::uuid, 'פלפל צהוב', 'פלפל צהוב', true, 'aliases-v1-2026-09-22'),
  ('21644c05-b535-5705-8616-a9c5fe777707'::uuid, 'בצל', 'בצל', true, 'aliases-v1-2026-09-22'),
  ('1d659f80-f88d-58b7-879e-702eecfa3fe6'::uuid, 'כרוב סגול', 'כרוב סגול', true, 'aliases-v1-2026-09-22'),
  ('0ea380dc-86d9-5691-8931-ac30ed8fc8a1'::uuid, 'צנון', 'צנון', true, 'aliases-v1-2026-09-22'),
  ('925a747a-4cd3-57af-8087-d181b0021c49'::uuid, 'קולורבי', 'קולורבי', true, 'aliases-v1-2026-09-22'),
  ('72093cda-e1ac-548e-87c1-2a9861fb76e7'::uuid, 'תרד', 'תרד', true, 'aliases-v1-2026-09-22'),
  ('070fcf2f-c53e-524b-839d-843b0cf07647'::uuid, 'מנגולד', 'מנגולד', true, 'aliases-v1-2026-09-22'),
  ('4bab57f1-7873-5cfa-89b7-f12c7c9bdc8d'::uuid, 'מלפפון חמוץ', 'מלפפון חמוץ', true, 'aliases-v1-2026-09-22'),
  ('4bab57f1-7873-5cfa-89b7-f12c7c9bdc8d'::uuid, 'כרוב כבוש', 'כרוב כבוש', true, 'aliases-v1-2026-09-22'),
  ('38370693-79e8-51ed-871a-7211b77121fc'::uuid, 'לימון', 'לימון', true, 'aliases-v1-2026-09-22'),
  ('37e25c62-07a7-50c0-86f7-e09f76ce7989'::uuid, 'אשכולית', 'אשכולית', true, 'aliases-v1-2026-09-22'),
  ('6bca6cf9-8610-5553-859f-84dfe93a7ffe'::uuid, 'פומלה', 'פומלה', true, 'aliases-v1-2026-09-22'),
  ('8923f701-4f4f-53db-872e-d54f63f7763d'::uuid, 'גויאבה', 'גויאבה', true, 'aliases-v1-2026-09-22'),
  ('f2539049-89ca-507e-864e-2f7bdf720889'::uuid, 'אננס', 'אננס', true, 'aliases-v1-2026-09-22'),
  ('253fbc2a-9e79-5d36-8949-58cf71e097af'::uuid, 'תאנה', 'תאנה', true, 'aliases-v1-2026-09-22'),
  ('eab7bfb5-53b6-557f-834d-f3ddbea25767'::uuid, 'משמש', 'משמש', true, 'aliases-v1-2026-09-22'),
  ('a98ab844-02a8-5cb1-8789-06081c34ca83'::uuid, 'דובדבנים', 'דובדבנים', true, 'aliases-v1-2026-09-22'),
  ('590eaa86-fab9-5641-870a-910fd434ec20'::uuid, 'אפונה', 'אפונה', true, 'aliases-v1-2026-09-22'),
  ('496f6c33-6feb-5576-8ba8-326d6a36c7d1'::uuid, 'ביצה קשה', 'ביצה קשה', true, 'aliases-v1-2026-09-22'),
  ('496f6c33-6feb-5576-8ba8-326d6a36c7d1'::uuid, 'ביצה רכה', 'ביצה רכה', true, 'aliases-v1-2026-09-22'),
  ('d54f3d35-2e38-5619-872a-f98eccbb5c4a'::uuid, 'חלבון ביצה', 'חלבון ביצה', true, 'aliases-v1-2026-09-22'),
  ('75afc442-8bff-5084-8507-785be5017c3a'::uuid, 'לחם לבן', 'לחם לבן', true, 'aliases-v1-2026-09-22'),
  ('6bd0e7b8-0b1a-5895-88b6-fb220718589b'::uuid, 'לחם מחמצת', 'לחם מחמצת', true, 'aliases-v1-2026-09-22'),
  ('e3187466-5aa6-5916-8ae8-0e789030de2c'::uuid, 'פיתה', 'פיתה', true, 'aliases-v1-2026-09-22'),
  ('622d1311-9288-5376-8630-bf4d53160d9d'::uuid, 'פיתה מלאה', 'פיתה מלאה', true, 'aliases-v1-2026-09-22'),
  ('e1c06159-20e9-51c1-85a4-4f81fc80a2fd'::uuid, 'לאפה', 'לאפה', true, 'aliases-v1-2026-09-22'),
  ('175c8092-421d-5a85-8f61-9b09cc869917'::uuid, 'ג׳חנון', 'גחנון', true, 'aliases-v1-2026-09-22'),
  ('f5a6b1f9-170e-5e70-8da5-34c3e72e9715'::uuid, 'בורקס גבינה', 'בורקס גבינה', true, 'aliases-v1-2026-09-22'),
  ('f5a6b1f9-170e-5e70-8da5-34c3e72e9715'::uuid, 'בורקס תפוח אדמה', 'בורקס תפוח אדמה', true, 'aliases-v1-2026-09-22'),
  ('475a9cb4-67e9-5222-8b3c-9bc21a0abac8'::uuid, 'פריכית אורז', 'פריכית אורז', true, 'aliases-v1-2026-09-22'),
  ('07f1599f-b177-52b9-8d85-6ffe38160ae3'::uuid, 'שיבולת שועל', 'שיבולת שועל', true, 'aliases-v1-2026-09-22'),
  ('4be19e20-2dd4-580a-8662-f8eeb34e1dd8'::uuid, 'גרנולה', 'גרנולה', true, 'aliases-v1-2026-09-22'),
  ('cccd8425-f4c5-5077-826a-332ebc04372d'::uuid, 'חומוס מבושל', 'חומוס מבושל', true, 'aliases-v1-2026-09-22'),
  ('ea1917e3-d5f3-5526-8cae-3735b66bc0f8'::uuid, 'אדממה', 'אדממה', true, 'aliases-v1-2026-09-22'),
  ('7b0a6ccc-0c80-578b-85b9-099d66cace06'::uuid, 'חזה עוף מבושל', 'חזה עוף מבושל', true, 'aliases-v1-2026-09-22'),
  ('7b0a6ccc-0c80-578b-85b9-099d66cace06'::uuid, 'חזה עוף בגריל', 'חזה עוף בגריל', true, 'aliases-v1-2026-09-22'),
  ('52ff1d6e-30a9-530c-883c-cec874a5dd45'::uuid, 'שוק עוף', 'שוק עוף', true, 'aliases-v1-2026-09-22'),
  ('3f90163d-cca3-5e4a-8cfd-89f315af1920'::uuid, 'כרע עוף', 'כרע עוף', true, 'aliases-v1-2026-09-22'),
  ('59ac6a41-8899-5209-8d10-b22bae01b820'::uuid, 'שניצל מטוגן', 'שניצל מטוגן', true, 'aliases-v1-2026-09-22'),
  ('35ec0cef-5045-5f14-8c50-97f4de07260d'::uuid, 'קציצות בקר', 'קציצות בקר', true, 'aliases-v1-2026-09-22'),
  ('cd028dd9-c823-5c9a-8d51-cddda18ea25e'::uuid, 'פילה בקר', 'פילה בקר', true, 'aliases-v1-2026-09-22'),
  ('997c9ef7-ad5a-54de-8592-756c9baf8b95'::uuid, 'המבורגר', 'המבורגר', true, 'aliases-v1-2026-09-22'),
  ('938578af-6951-5280-8966-667f2dc8f68a'::uuid, 'שווארמה הודו', 'שוארמה הודו', true, 'aliases-v1-2026-09-22'),
  ('965bab05-d785-5606-856d-7800f8478bbb'::uuid, 'סלמי', 'סלמי', true, 'aliases-v1-2026-09-22'),
  ('9234c4de-847e-5dcb-85ca-b440fc15a974'::uuid, 'לברק', 'לברק', true, 'aliases-v1-2026-09-22'),
  ('88a066a2-eb47-5b7e-85a7-6b66d54fd7ed'::uuid, 'טונה במים', 'טונה במים', true, 'aliases-v1-2026-09-22'),
  ('6eac1822-69da-58da-8ad1-df1671764ad5'::uuid, 'סלט ירקות', 'סלט ירקות', true, 'aliases-v1-2026-09-22'),
  ('a142f0d7-0e22-5ce4-8a06-238aacabf840'::uuid, 'סלט חסה', 'סלט חסה', true, 'aliases-v1-2026-09-22'),
  ('1d659f80-f88d-58b7-879e-702eecfa3fe6'::uuid, 'סלט כרוב', 'סלט כרוב', true, 'aliases-v1-2026-09-22'),
  ('6a60c385-cc56-5169-8acc-a6f531d307be'::uuid, 'מרק ירקות', 'מרק ירקות', true, 'aliases-v1-2026-09-22'),
  ('14efd02e-2ab0-59af-80b0-f3017e41e833'::uuid, 'אגוזי מלך', 'אגוזי מלך', true, 'aliases-v1-2026-09-22'),
  ('0c53e1e3-a102-5778-866a-b0a5707a6b90'::uuid, 'צ׳יה', 'ציה', true, 'aliases-v1-2026-09-22'),
  ('fe9af1b5-18a8-5d3a-82cf-83b6e523b350'::uuid, 'פסטו', 'פסטו', true, 'aliases-v1-2026-09-22'),
  ('f9083a04-2f3d-5982-86e8-7106415b2cf0'::uuid, 'שוקולד חלב', 'שוקולד חלב', true, 'aliases-v1-2026-09-22'),
  ('f9083a04-2f3d-5982-86e8-7106415b2cf0'::uuid, 'שוקולד מריר', 'שוקולד מריר', true, 'aliases-v1-2026-09-22'),
  ('438f3893-62f0-56dd-8efc-064bf0b9a906'::uuid, 'בייגלה', 'ביגלה', true, 'aliases-v1-2026-09-22'),
  ('bc888a26-db39-562e-8b38-5314bccd5d13'::uuid, 'מיץ ענבים', 'מיץ ענבים', true, 'aliases-v1-2026-09-22'),
  ('2a30c2b6-9749-5b00-8db3-308501a3cf9e'::uuid, 'משקה אנרגיה', 'משקה אנרגיה', true, 'aliases-v1-2026-09-22'),
  ('57207830-8e92-5158-8d48-ea2cb5bf184e'::uuid, 'יין אדום', 'ין אדום', true, 'aliases-v1-2026-09-22'),
  ('57207830-8e92-5158-8d48-ea2cb5bf184e'::uuid, 'יין לבן', 'ין לבן', true, 'aliases-v1-2026-09-22'),
  ('bb9a27e8-495b-56c8-832a-ce6408573928'::uuid, 'וודקה', 'ודקה', true, 'aliases-v1-2026-09-22'),
  ('bb9a27e8-495b-56c8-832a-ce6408573928'::uuid, 'ויסקי', 'ויסקי', true, 'aliases-v1-2026-09-22'),
  ('7244518a-1135-55b5-8b69-c2f944be7968'::uuid, 'חלב עיזים', 'חלב עיזים', true, 'aliases-v1-2026-09-22'),
  ('a6dcd5df-1c42-5fa0-8b0a-ce145b6fdb0e'::uuid, 'חלב קוקוס', 'חלב קוקוס', true, 'aliases-v1-2026-09-22'),
  ('6a5e52ac-a2e4-5fb2-8783-c51fda184420'::uuid, 'חרדל', 'חרדל', true, 'aliases-v1-2026-09-22'),
  ('572a380a-6457-543a-83e5-cb6905c9fff6'::uuid, 'תה', 'תה', true, 'aliases-v1-2026-09-22'),
  ('572a380a-6457-543a-83e5-cb6905c9fff6'::uuid, 'תה ירוק', 'תה ירוק', true, 'aliases-v1-2026-09-22'),
  ('572a380a-6457-543a-83e5-cb6905c9fff6'::uuid, 'תה צמחים', 'תה צמחים', true, 'aliases-v1-2026-09-22'),
  ('099e303a-04dd-5f14-8af6-6736fe95db46'::uuid, 'קפה שחור', 'קפה שחור', true, 'aliases-v1-2026-09-22'),
  ('099e303a-04dd-5f14-8af6-6736fe95db46'::uuid, 'אמריקנו', 'אמריקנו', true, 'aliases-v1-2026-09-22'),
  ('099e303a-04dd-5f14-8af6-6736fe95db46'::uuid, 'קפה נמס', 'קפה נמס', true, 'aliases-v1-2026-09-22')
on conflict (normalized_alias, item_id) do update
  set alias = excluded.alias, verified = excluded.verified, origin = excluded.origin;
-- <<< END GENERATED ALIAS SEED

-- ROLLBACK (manual; not part of the migration):
--   delete from public.food_reference_aliases where origin = 'aliases-v1-2026-09-22';
--   drop index if exists public.foods_reference_group_idx;
--   alter table public.foods drop column if exists reference_group_key;
