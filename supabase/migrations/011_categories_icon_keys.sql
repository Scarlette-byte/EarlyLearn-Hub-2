-- ============================================================================
-- EarlyLearn Hub (MSWDO Manolo Fortich, Bukidnon)
-- SQL Migration: 011_categories_icon_keys.sql
-- Purpose: Store clean, swappable ASCII icon keys in `public.categories.icon`
--          instead of raw emoji characters, with an automatic mapping for
--          existing rows and a safe fallback ('book') for unknown keys.
-- ============================================================================

-- 1. Ensure `public.categories` has a clean default icon key
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'categories'
  ) THEN
    ALTER TABLE public.categories
      ALTER COLUMN icon SET DEFAULT 'book';

    -- 2. Map existing rows by legacy Unicode codepoint (chr(...)) or category name
    UPDATE public.categories
    SET icon = CASE
      WHEN icon = chr(128292) OR lower(name) LIKE '%alphabet%' OR lower(name) LIKE '%letter%' OR lower(name) LIKE '%abc%' THEN 'alphabet'
      WHEN icon = chr(128290) OR lower(name) LIKE '%number%' OR lower(name) LIKE '%math%' OR lower(name) LIKE '%count%' THEN 'numbers'
      WHEN icon = chr(127912) OR lower(name) LIKE '%color%' OR lower(name) LIKE '%art%' OR lower(name) LIKE '%paint%' THEN 'colors'
      WHEN icon IN (chr(128314), chr(128310)) OR lower(name) LIKE '%shape%' THEN 'shapes'
      WHEN icon IN (chr(128054), chr(128049), chr(128003)) OR lower(name) LIKE '%animal%' OR lower(name) LIKE '%nature%' THEN 'animals'
      WHEN icon IN (chr(128214), chr(128218)) OR lower(name) LIKE '%stor%' OR lower(name) LIKE '%read%' THEN 'stories'
      WHEN icon = chr(127925) OR lower(name) LIKE '%music%' OR lower(name) LIKE '%song%' THEN 'music'
      WHEN icon = chr(127916) OR lower(name) LIKE '%video%' THEN 'video'
      WHEN icon = chr(129513) OR lower(name) LIKE '%puzzle%' OR lower(name) LIKE '%game%' THEN 'puzzle'
      WHEN icon = chr(127793) OR lower(name) LIKE '%value%' OR lower(name) LIKE '%growth%' THEN 'seedling'
      WHEN icon IN (chr(128663), chr(128665)) OR lower(name) LIKE '%car%' OR lower(name) LIKE '%transport%' THEN 'car'
      WHEN icon = chr(11088) OR lower(name) LIKE '%star%' OR lower(name) LIKE '%milestone%' THEN 'star'
      WHEN icon IS NULL OR btrim(icon) = '' THEN 'book'
      WHEN lower(btrim(icon)) ~ '^[a-z0-9_-]+$' THEN lower(btrim(icon))
      ELSE 'book'
    END
    WHERE icon IS NULL
       OR btrim(icon) = ''
       OR btrim(icon) !~ '^[a-z0-9_-]+$';

    -- 3. Enforce ASCII key format on `categories.icon` so emojis cannot be re-inserted
    ALTER TABLE public.categories
      DROP CONSTRAINT IF EXISTS categories_icon_key_format_chk;

    ALTER TABLE public.categories
      ADD CONSTRAINT categories_icon_key_format_chk
      CHECK (icon ~ '^[a-z0-9_-]+$');

    COMMENT ON COLUMN public.categories.icon IS
      'Canonical ASCII icon key rendered by <Icon name={icon} /> (e.g. alphabet, numbers, colors, shapes, animals, stories, music, video, puzzle, seedling, car, globe, star, book).';
  END IF;
END $$;
