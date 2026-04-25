-- F10-A: Airtable-style field types. TableColumn.options stores
-- type-specific config: select option list with colors, number format,
-- rating max, date format. Defaults to NULL — old TEXT columns work
-- unchanged.

ALTER TABLE "TableColumn"
  ADD COLUMN IF NOT EXISTS "options" JSONB;
