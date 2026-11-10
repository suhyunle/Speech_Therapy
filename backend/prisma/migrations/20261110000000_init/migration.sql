-- CreateEnum
CREATE TYPE "Role" AS ENUM ('LEARNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('KAKAO', 'GOOGLE');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS', 'PRIVACY', 'VOICE_RECORDING', 'MODEL_TRAINING', 'RESEARCH', 'GUARDIAN');

-- CreateEnum
CREATE TYPE "SoundKind" AS ENUM ('CONSONANT', 'VOWEL', 'DIPHTHONG');

-- CreateEnum
CREATE TYPE "ItemKind" AS ENUM ('SYLLABLE', 'WORD', 'SENTENCE', 'PARAGRAPH');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('DRAFT', 'REVIEWED');

-- CreateEnum
CREATE TYPE "AttemptContext" AS ENUM ('MIC_CHECK', 'PLACEMENT', 'PRACTICE', 'BASELINE', 'WEEKLY');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('QUEUED', 'PROCESSING', 'DONE', 'ISSUE', 'FAILED');

-- CreateEnum
CREATE TYPE "SoundState" AS ENUM ('LOCKED', 'LEARNING', 'LEARNED', 'ALREADY_GOOD');

-- CreateEnum
CREATE TYPE "FontSize" AS ENUM ('NORMAL', 'LARGE');

-- CreateEnum
CREATE TYPE "ListenerGroup" AS ENUM ('FAMILY', 'FRIEND', 'TEACHER', 'STRANGER');

-- CreateEnum
CREATE TYPE "Familiarity" AS ENUM ('FIRST', 'SOMETIMES', 'OFTEN');

-- CreateEnum
CREATE TYPE "Feeling" AS ENUM ('EASY', 'OK', 'HARD', 'TIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "loginId" VARCHAR(20),
    "passwordHash" TEXT,
    "name" VARCHAR(30) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'LEARNER',
    "isGuest" BOOLEAN NOT NULL DEFAULT false,
    "birthYear" INTEGER,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "baseline" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Identity" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "family" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "userId" UUID NOT NULL,
    "dailyGoal" INTEGER NOT NULL DEFAULT 5,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderTime" VARCHAR(5),
    "visualAlert" BOOLEAN NOT NULL DEFAULT true,
    "haptics" BOOLEAN NOT NULL DEFAULT true,
    "fontSize" "FontSize" NOT NULL DEFAULT 'NORMAL',
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "onboardedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "ConsentType" NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "guardianName" VARCHAR(30),
    "guardianContact" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sound" (
    "id" UUID NOT NULL,
    "symbol" VARCHAR(4) NOT NULL,
    "kind" "SoundKind" NOT NULL,
    "groupKey" VARCHAR(20) NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "place" TEXT NOT NULL,
    "manner" TEXT NOT NULL,
    "voicing" TEXT NOT NULL,
    "cue" TEXT NOT NULL,
    "guide" JSONB NOT NULL,

    CONSTRAINT "Sound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonItem" (
    "id" UUID NOT NULL,
    "kind" "ItemKind" NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "pronunciation" VARCHAR(500) NOT NULL,
    "targetSounds" TEXT[],
    "note" TEXT,
    "placement" BOOLEAN NOT NULL DEFAULT false,
    "placementOrder" INTEGER,
    "baselineFor" VARCHAR(4),
    "intonation" VARCHAR(4),
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "status" "ItemStatus" NOT NULL DEFAULT 'DRAFT',
    "source" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recording" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "sampleRate" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "device" VARCHAR(200),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacementSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "summary" JSONB,

    CONSTRAINT "PlacementSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "itemId" UUID,
    "targetText" VARCHAR(500) NOT NULL,
    "targetPronunciation" VARCHAR(500) NOT NULL,
    "recordingId" UUID,
    "placementSessionId" UUID,
    "context" "AttemptContext" NOT NULL,
    "soundSymbol" VARCHAR(4),
    "status" "AttemptStatus" NOT NULL DEFAULT 'QUEUED',
    "issue" VARCHAR(30),
    "heard" VARCHAR(500),
    "passed" BOOLEAN,
    "result" JSONB,
    "modelVersion" VARCHAR(80),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analyzedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoundProgress" (
    "userId" UUID NOT NULL,
    "soundId" UUID NOT NULL,
    "state" "SoundState" NOT NULL DEFAULT 'LOCKED',
    "placementResult" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "passes" INTEGER NOT NULL DEFAULT 0,
    "consecutiveFails" INTEGER NOT NULL DEFAULT 0,
    "lastPracticedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoundProgress_pkey" PRIMARY KEY ("userId", "soundId")
);

-- CreateTable
CREATE TABLE "DailySession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "goal" INTEGER NOT NULL,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "recordingCount" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DailySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Streak" (
    "userId" UUID NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "best" INTEGER NOT NULL DEFAULT 0,
    "lastDate" VARCHAR(10),

    CONSTRAINT "Streak_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "DiaryEntry" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "feeling" "Feeling",
    "note" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListenLink" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "group" "ListenerGroup" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListenLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListenLinkItem" (
    "id" UUID NOT NULL,
    "linkId" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ListenLinkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListenAnswer" (
    "id" UUID NOT NULL,
    "linkItemId" UUID NOT NULL,
    "answerText" VARCHAR(500),
    "unsure" BOOLEAN NOT NULL DEFAULT false,
    "familiarity" "Familiarity" NOT NULL,
    "listenerKey" VARCHAR(40) NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListenAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "reason" VARCHAR(300) NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_loginId_key" ON "User"("loginId");
CREATE UNIQUE INDEX "Identity_provider_providerUserId_key" ON "Identity"("provider", "providerUserId");
CREATE INDEX "Identity_userId_idx" ON "Identity"("userId");
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE INDEX "Consent_userId_type_idx" ON "Consent"("userId", "type");
CREATE UNIQUE INDEX "Sound_symbol_key" ON "Sound"("symbol");
CREATE INDEX "LessonItem_kind_idx" ON "LessonItem"("kind");
CREATE INDEX "LessonItem_placement_idx" ON "LessonItem"("placement");
CREATE UNIQUE INDEX "Recording_storageKey_key" ON "Recording"("storageKey");
CREATE INDEX "Recording_userId_idx" ON "Recording"("userId");
CREATE INDEX "Recording_expiresAt_idx" ON "Recording"("expiresAt");
CREATE INDEX "PlacementSession_userId_idx" ON "PlacementSession"("userId");
CREATE INDEX "Attempt_userId_createdAt_idx" ON "Attempt"("userId", "createdAt");
CREATE INDEX "Attempt_userId_soundSymbol_idx" ON "Attempt"("userId", "soundSymbol");
CREATE INDEX "Attempt_status_idx" ON "Attempt"("status");
CREATE UNIQUE INDEX "DailySession_userId_date_key" ON "DailySession"("userId", "date");
CREATE UNIQUE INDEX "DiaryEntry_userId_date_key" ON "DiaryEntry"("userId", "date");
CREATE UNIQUE INDEX "ListenLink_code_key" ON "ListenLink"("code");
CREATE INDEX "ListenLink_userId_idx" ON "ListenLink"("userId");
CREATE UNIQUE INDEX "ListenLinkItem_linkId_order_key" ON "ListenLinkItem"("linkId", "order");
CREATE INDEX "ListenAnswer_linkItemId_idx" ON "ListenAnswer"("linkItemId");

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonItem" ADD CONSTRAINT "LessonItem_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlacementSession" ADD CONSTRAINT "PlacementSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "LessonItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_placementSessionId_fkey" FOREIGN KEY ("placementSessionId") REFERENCES "PlacementSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SoundProgress" ADD CONSTRAINT "SoundProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SoundProgress" ADD CONSTRAINT "SoundProgress_soundId_fkey" FOREIGN KEY ("soundId") REFERENCES "Sound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailySession" ADD CONSTRAINT "DailySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Streak" ADD CONSTRAINT "Streak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListenLink" ADD CONSTRAINT "ListenLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListenLinkItem" ADD CONSTRAINT "ListenLinkItem_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "ListenLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListenLinkItem" ADD CONSTRAINT "ListenLinkItem_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListenAnswer" ADD CONSTRAINT "ListenAnswer_linkItemId_fkey" FOREIGN KEY ("linkItemId") REFERENCES "ListenLinkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

