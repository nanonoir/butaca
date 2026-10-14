CREATE TYPE "public"."movie_reaction" AS ENUM('LIKE', 'DISLIKE');--> statement-breakpoint
CREATE TYPE "public"."review_verdict" AS ENUM('RECOMMENDED', 'NOT_WORTH_IT');--> statement-breakpoint
CREATE TABLE "auth_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "auth_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movie_cache" (
	"movie_id" integer NOT NULL,
	"language" varchar(10) NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	CONSTRAINT "movie_cache_movie_id_language_pk" PRIMARY KEY("movie_id","language"),
	CONSTRAINT "movie_cache_movie_id_positive_check" CHECK ("movie_cache"."movie_id" > 0),
	CONSTRAINT "movie_cache_language_length_check" CHECK (char_length(btrim("movie_cache"."language")) between 2 and 10)
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"movie_id" integer NOT NULL,
	"verdict" "review_verdict" NOT NULL,
	"title" varchar(30) NOT NULL,
	"description" varchar(400) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_user_id_movie_id_unique" UNIQUE("user_id","movie_id"),
	CONSTRAINT "reviews_movie_id_positive_check" CHECK ("reviews"."movie_id" > 0),
	CONSTRAINT "reviews_title_length_check" CHECK (char_length(btrim("reviews"."title")) between 3 and 30),
	CONSTRAINT "reviews_description_length_check" CHECK (char_length(btrim("reviews"."description")) between 3 and 400)
);
--> statement-breakpoint
CREATE TABLE "user_movie_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"movie_id" integer NOT NULL,
	"reaction" "movie_reaction",
	"watched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_movie_interactions_user_id_movie_id_unique" UNIQUE("user_id","movie_id"),
	CONSTRAINT "user_movie_interactions_movie_id_positive_check" CHECK ("user_movie_interactions"."movie_id" > 0),
	CONSTRAINT "user_movie_interactions_meaningful_state_check" CHECK ("user_movie_interactions"."reaction" is not null or "user_movie_interactions"."watched_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"preferred_genre_ids" integer[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_minimum_genres_check" CHECK (cardinality("user_preferences"."preferred_genre_ids") >= 2),
	CONSTRAINT "user_preferences_positive_genres_check" CHECK (coalesce(0 < ALL("user_preferences"."preferred_genre_ids"), false))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" varchar(80) NOT NULL,
	"avatar_url" text,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_display_name_length_check" CHECK (char_length(btrim("users"."display_name")) between 1 and 80)
);
--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_movie_interactions" ADD CONSTRAINT "user_movie_interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_auth_user_id_fk" FOREIGN KEY ("id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_account_user_id_idx" ON "auth_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_session_user_id_idx" ON "auth_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_verification_identifier_idx" ON "auth_verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "movie_cache_fetched_at_idx" ON "movie_cache" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "reviews_movie_created_at_idx" ON "reviews" USING btree ("movie_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reviews_movie_verdict_idx" ON "reviews" USING btree ("movie_id","verdict");--> statement-breakpoint
CREATE INDEX "user_movie_interactions_user_updated_at_idx" ON "user_movie_interactions" USING btree ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_movie_interactions_user_reaction_updated_at_idx" ON "user_movie_interactions" USING btree ("user_id","reaction","updated_at" DESC NULLS LAST);