-- Public / landing-page product feedback (not tied to a match).
CREATE TABLE "site_feedbacks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT,
    "email" TEXT,
    "rating" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'landing',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_feedbacks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_site_feedbacks_created_at" ON "site_feedbacks"("created_at");
