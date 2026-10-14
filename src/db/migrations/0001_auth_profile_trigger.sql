-- Every identity row gets its product profile in the same transaction, so a
-- registration can never leave an auth_user without users (or the reverse).
-- Better Auth only knows auth_user; the profile stays authoritative afterwards.
CREATE FUNCTION "public"."create_profile_for_auth_user"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  initial_name text;
BEGIN
  initial_name := left(btrim(coalesce(NEW.name, '')), 80);

  IF char_length(btrim(initial_name)) = 0 THEN
    initial_name := left(btrim(split_part(NEW.email, '@', 1)), 80);
  END IF;

  IF char_length(btrim(initial_name)) = 0 THEN
    initial_name := 'Film Match user';
  END IF;

  INSERT INTO "public"."users" ("id", "display_name")
  VALUES (NEW.id, btrim(initial_name))
  ON CONFLICT ("id") DO NOTHING;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "auth_user_create_profile"
AFTER INSERT ON "public"."auth_user"
FOR EACH ROW EXECUTE FUNCTION "public"."create_profile_for_auth_user"();
