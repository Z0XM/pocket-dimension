CREATE TABLE IF NOT EXISTS "rhymes"."piece_revisions" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "piece_id" uuid NOT NULL,
  "actor_id" uuid NOT NULL,
  "snapshot_json" jsonb NOT NULL,
  "label" text,
  CONSTRAINT "rhymes_piece_revisions_piece_id_pieces_id_fk" FOREIGN KEY ("piece_id") REFERENCES "rhymes"."pieces"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "rhymes_piece_revisions_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "rhymes_piece_revisions_piece_id_idx" ON "rhymes"."piece_revisions" USING btree ("piece_id");
