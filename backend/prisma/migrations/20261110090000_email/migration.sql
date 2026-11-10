-- 이메일 인증 · 비밀번호 재설정
CREATE TYPE "EmailTokenKind" AS ENUM ('VERIFY', 'RESET');

ALTER TABLE "User" ADD COLUMN "email" VARCHAR(254), ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "EmailToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "EmailTokenKind" NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailToken_tokenHash_key" ON "EmailToken"("tokenHash");
CREATE INDEX "EmailToken_userId_kind_idx" ON "EmailToken"("userId", "kind");
ALTER TABLE "EmailToken" ADD CONSTRAINT "EmailToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
