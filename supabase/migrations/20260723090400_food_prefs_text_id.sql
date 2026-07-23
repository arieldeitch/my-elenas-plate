-- food_preferences.food_id becomes the app's food id (built-in catalog ids like
-- 'f_coffee', or custom-food UUIDs), decoupled from the foods table so BOTH
-- built-in and custom foods can be favorited / recented per profile without
-- requiring a foods row. Forward-only; safe on the (empty) preferences table.
-- Custom foods still live in `foods` for search/catalog + soft-delete.
alter table public.food_preferences
  drop constraint if exists food_preferences_food_id_fkey;

alter table public.food_preferences
  alter column food_id type text using food_id::text;
