-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('none', 'lifetime', 'monthly');

-- CreateEnum
CREATE TYPE "ToyStatus" AS ENUM ('draft', 'live', 'paused', 'killed');

-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('none', 'pending', 'verifying', 'verified', 'error');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'done', 'failed');

-- CreateEnum
CREATE TYPE "ModerationStage" AS ENUM ('input', 'output');

-- CreateEnum
CREATE TYPE "ModerationVerdict" AS ENUM ('pass', 'reject');

-- CreateTable
CREATE TABLE "owners" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'none',
    "stripe_customer_id" TEXT,
    "credit_balance_usd" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "auto_topup_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_topup_threshold_usd" DECIMAL(12,4),
    "auto_topup_amount_usd" DECIMAL(12,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "toys" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "status" "ToyStatus" NOT NULL DEFAULT 'draft',
    "brand_config" JSONB NOT NULL DEFAULT '{}',
    "per_visitor_quota" INTEGER NOT NULL DEFAULT 3,
    "spend_cap_usd" DECIMAL(12,4) NOT NULL,
    "spend_used_usd" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "spend_reserved_usd" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "watermark_enabled" BOOLEAN NOT NULL DEFAULT true,
    "custom_domain" TEXT,
    "domain_status" "DomainStatus" NOT NULL DEFAULT 'none',
    "domain_dns_target" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "toys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_jobs" (
    "id" TEXT NOT NULL,
    "toy_id" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "input_ref" TEXT,
    "result_url" TEXT,
    "model" TEXT,
    "cost_usd" DECIMAL(12,4),
    "charged_usd" DECIMAL(12,4),
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runs" (
    "id" TEXT NOT NULL,
    "toy_id" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "cost_usd" DECIMAL(12,4) NOT NULL,
    "charged_usd" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "was_free" BOOLEAN NOT NULL DEFAULT false,
    "result_url" TEXT,
    "share_card_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_ledger" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "delta_usd" DECIMAL(12,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "run_id" TEXT,
    "stripe_event_id" TEXT,
    "balance_after_usd" DECIMAL(12,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_events" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "toy_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_events" (
    "id" TEXT NOT NULL,
    "toy_id" TEXT NOT NULL,
    "utm_source" TEXT,
    "visitor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_quota" (
    "toy_id" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "runs_used" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "visitor_quota_pkey" PRIMARY KEY ("toy_id","visitor_id")
);

-- CreateTable
CREATE TABLE "moderation_logs" (
    "id" TEXT NOT NULL,
    "toy_id" TEXT NOT NULL,
    "stage" "ModerationStage" NOT NULL,
    "verdict" "ModerationVerdict" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "owners_email_key" ON "owners"("email");

-- CreateIndex
CREATE UNIQUE INDEX "owners_stripe_customer_id_key" ON "owners"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "toys_slug_key" ON "toys"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "toys_custom_domain_key" ON "toys"("custom_domain");

-- CreateIndex
CREATE INDEX "toys_owner_id_idx" ON "toys"("owner_id");

-- CreateIndex
CREATE INDEX "toys_status_idx" ON "toys"("status");

-- CreateIndex
CREATE INDEX "generation_jobs_toy_id_idx" ON "generation_jobs"("toy_id");

-- CreateIndex
CREATE INDEX "generation_jobs_visitor_id_idx" ON "generation_jobs"("visitor_id");

-- CreateIndex
CREATE INDEX "generation_jobs_status_idx" ON "generation_jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "runs_job_id_key" ON "runs"("job_id");

-- CreateIndex
CREATE INDEX "runs_toy_id_idx" ON "runs"("toy_id");

-- CreateIndex
CREATE INDEX "runs_visitor_id_idx" ON "runs"("visitor_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_ledger_stripe_event_id_key" ON "credit_ledger"("stripe_event_id");

-- CreateIndex
CREATE INDEX "credit_ledger_owner_id_idx" ON "credit_ledger"("owner_id");

-- CreateIndex
CREATE INDEX "credit_ledger_run_id_idx" ON "credit_ledger"("run_id");

-- CreateIndex
CREATE INDEX "share_events_toy_id_idx" ON "share_events"("toy_id");

-- CreateIndex
CREATE INDEX "share_events_run_id_idx" ON "share_events"("run_id");

-- CreateIndex
CREATE INDEX "return_events_toy_id_idx" ON "return_events"("toy_id");

-- CreateIndex
CREATE INDEX "moderation_logs_toy_id_idx" ON "moderation_logs"("toy_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_source_external_id_key" ON "webhook_events"("source", "external_id");

-- AddForeignKey
ALTER TABLE "toys" ADD CONSTRAINT "toys_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_toy_id_fkey" FOREIGN KEY ("toy_id") REFERENCES "toys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_toy_id_fkey" FOREIGN KEY ("toy_id") REFERENCES "toys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "generation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_events" ADD CONSTRAINT "share_events_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_events" ADD CONSTRAINT "share_events_toy_id_fkey" FOREIGN KEY ("toy_id") REFERENCES "toys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_events" ADD CONSTRAINT "return_events_toy_id_fkey" FOREIGN KEY ("toy_id") REFERENCES "toys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_quota" ADD CONSTRAINT "visitor_quota_toy_id_fkey" FOREIGN KEY ("toy_id") REFERENCES "toys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_logs" ADD CONSTRAINT "moderation_logs_toy_id_fkey" FOREIGN KEY ("toy_id") REFERENCES "toys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
