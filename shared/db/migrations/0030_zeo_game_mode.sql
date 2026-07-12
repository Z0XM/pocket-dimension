CREATE TYPE "zeo"."game_type" AS ENUM('charades');--> statement-breakpoint
CREATE TYPE "zeo"."game_session_status" AS ENUM('setup', 'active', 'ended');--> statement-breakpoint
CREATE TYPE "zeo"."game_round_phase" AS ENUM('submission', 'passed_on', 'act', 'verdict', 'ready_check', 'completed');--> statement-breakpoint
CREATE TYPE "zeo"."game_verdict" AS ENUM('accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "zeo"."game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"room_id" uuid NOT NULL,
	"host_user_id" uuid NOT NULL,
	"game_type" "zeo"."game_type" NOT NULL,
	"status" "zeo"."game_session_status" DEFAULT 'setup' NOT NULL,
	"team_count" integer NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "zeo"."game_teams" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"session_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color_key" text NOT NULL,
	"sort_order" integer NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "game_teams_session_id_sort_order_unique" UNIQUE("session_id","sort_order")
);
--> statement-breakpoint
CREATE TABLE "zeo"."game_participants" (
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"team_id" uuid,
	"is_ready" boolean DEFAULT false NOT NULL,
	CONSTRAINT "game_participants_session_id_user_id_pk" PRIMARY KEY("session_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "zeo"."game_rounds" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"session_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"proposing_team_id" uuid NOT NULL,
	"guessing_team_id" uuid NOT NULL,
	"mime_user_id" uuid NOT NULL,
	"phase" "zeo"."game_round_phase" DEFAULT 'submission' NOT NULL,
	"locked_word" text,
	"locked_suggestion_id" uuid,
	"verdict" "zeo"."game_verdict",
	"resolved_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_rounds_session_id_round_number_unique" UNIQUE("session_id","round_number")
);
--> statement-breakpoint
CREATE TABLE "zeo"."game_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"round_id" uuid NOT NULL,
	"suggester_user_id" uuid NOT NULL,
	"word" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zeo"."game_suggestion_votes" (
	"suggestion_id" uuid NOT NULL,
	"voter_user_id" uuid NOT NULL,
	CONSTRAINT "game_suggestion_votes_suggestion_id_voter_user_id_pk" PRIMARY KEY("suggestion_id","voter_user_id")
);
--> statement-breakpoint
CREATE TABLE "zeo"."room_scores" (
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "room_scores_room_id_user_id_pk" PRIMARY KEY("room_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "zeo"."game_sessions" ADD CONSTRAINT "game_sessions_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "zeo"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."game_sessions" ADD CONSTRAINT "game_sessions_host_user_id_user_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."game_teams" ADD CONSTRAINT "game_teams_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "zeo"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."game_participants" ADD CONSTRAINT "game_participants_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "zeo"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."game_participants" ADD CONSTRAINT "game_participants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."game_participants" ADD CONSTRAINT "game_participants_team_id_game_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "zeo"."game_teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."game_rounds" ADD CONSTRAINT "game_rounds_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "zeo"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."game_rounds" ADD CONSTRAINT "game_rounds_proposing_team_id_game_teams_id_fk" FOREIGN KEY ("proposing_team_id") REFERENCES "zeo"."game_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."game_rounds" ADD CONSTRAINT "game_rounds_guessing_team_id_game_teams_id_fk" FOREIGN KEY ("guessing_team_id") REFERENCES "zeo"."game_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."game_rounds" ADD CONSTRAINT "game_rounds_mime_user_id_user_id_fk" FOREIGN KEY ("mime_user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."game_rounds" ADD CONSTRAINT "game_rounds_resolved_by_user_id_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."game_suggestions" ADD CONSTRAINT "game_suggestions_round_id_game_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "zeo"."game_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."game_suggestions" ADD CONSTRAINT "game_suggestions_suggester_user_id_user_id_fk" FOREIGN KEY ("suggester_user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."game_suggestion_votes" ADD CONSTRAINT "game_suggestion_votes_suggestion_id_game_suggestions_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "zeo"."game_suggestions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."game_suggestion_votes" ADD CONSTRAINT "game_suggestion_votes_voter_user_id_user_id_fk" FOREIGN KEY ("voter_user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."room_scores" ADD CONSTRAINT "room_scores_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "zeo"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."room_scores" ADD CONSTRAINT "room_scores_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_sessions_room_id_idx" ON "zeo"."game_sessions" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "game_sessions_status_idx" ON "zeo"."game_sessions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "game_sessions_one_active_per_room" ON "zeo"."game_sessions" USING btree ("room_id") WHERE "zeo"."game_sessions"."status" = 'active';--> statement-breakpoint
CREATE INDEX "game_teams_session_id_idx" ON "zeo"."game_teams" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "game_participants_session_id_idx" ON "zeo"."game_participants" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "game_participants_team_id_idx" ON "zeo"."game_participants" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "game_rounds_session_id_idx" ON "zeo"."game_rounds" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "game_suggestions_round_id_idx" ON "zeo"."game_suggestions" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "room_scores_room_id_idx" ON "zeo"."room_scores" USING btree ("room_id");
