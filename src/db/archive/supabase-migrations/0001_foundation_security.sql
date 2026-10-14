ALTER TABLE "users"
  ADD CONSTRAINT "users_id_auth_users_id_fk"
  FOREIGN KEY ("id") REFERENCES "auth"."users"("id")
  ON DELETE CASCADE;

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_movie_interactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "movie_cache" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "users" FROM anon, authenticated;
REVOKE ALL ON TABLE "user_preferences" FROM anon, authenticated;
REVOKE ALL ON TABLE "user_movie_interactions" FROM anon, authenticated;
REVOKE ALL ON TABLE "reviews" FROM anon, authenticated;
REVOKE ALL ON TABLE "movie_cache" FROM anon, authenticated;
