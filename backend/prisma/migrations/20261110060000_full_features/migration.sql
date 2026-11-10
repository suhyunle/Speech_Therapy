-- AlterEnum
ALTER TYPE "AttemptContext" ADD VALUE 'REVIEW';
ALTER TYPE "AttemptContext" ADD VALUE 'EXERCISE';

-- CreateEnum
CREATE TYPE "ScriptStatus" AS ENUM ('EXTRACTING', 'READY', 'FAILED');
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'PROCESSING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "calibration" JSONB;
ALTER TABLE "Settings" ADD COLUMN "personalModel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "researchMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "researchAudio" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "irbNumber" VARCHAR(60);
ALTER TABLE "LessonItem" ADD COLUMN "exercise" VARCHAR(20);
ALTER TABLE "Attempt" ADD COLUMN "clientId" VARCHAR(64);
ALTER TABLE "SoundProgress" ADD COLUMN "baselineDoneAt" TIMESTAMP(3),
ADD COLUMN "weeklyDoneAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "lastSent" VARCHAR(10),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NewsletterSignup" (
    "id" UUID NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterSignup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScriptDoc" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "sourceType" VARCHAR(10) NOT NULL,
    "storageKey" TEXT,
    "status" "ScriptStatus" NOT NULL DEFAULT 'EXTRACTING',
    "slides" JSONB,
    "charCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScriptDoc_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScriptRun" (
    "id" UUID NOT NULL,
    "docId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "slideFrom" INTEGER NOT NULL,
    "slideTo" INTEGER NOT NULL,
    "freeSpeech" BOOLEAN NOT NULL DEFAULT true,
    "storageKey" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analyzedAt" TIMESTAMP(3),

    CONSTRAINT "ScriptRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_userId_clientId_key" ON "Attempt"("userId", "clientId");
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE UNIQUE INDEX "NewsletterSignup_email_key" ON "NewsletterSignup"("email");
CREATE INDEX "ScriptDoc_userId_idx" ON "ScriptDoc"("userId");
CREATE INDEX "ScriptRun_userId_idx" ON "ScriptRun"("userId");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScriptDoc" ADD CONSTRAINT "ScriptDoc_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScriptRun" ADD CONSTRAINT "ScriptRun_docId_fkey" FOREIGN KEY ("docId") REFERENCES "ScriptDoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScriptRun" ADD CONSTRAINT "ScriptRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
