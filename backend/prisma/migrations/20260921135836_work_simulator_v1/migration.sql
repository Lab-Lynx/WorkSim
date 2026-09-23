-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('assigned', 'in_progress', 'submitted_v1', 'resubmitted', 'done', 'abandoned');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'past_due', 'canceled');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "StarterTemplate" AS ENUM ('react', 'node_express', 'django');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('awaiting_ci', 'evaluating', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "MentorMessageRole" AS ENUM ('user', 'mentor');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "name" TEXT;

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitHubConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "githubUserId" TEXT NOT NULL,
    "githubLogin" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StarterRepo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "starterTemplate" "StarterTemplate" NOT NULL,
    "githubRepoId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StarterRepo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "chapaSubscriptionRef" TEXT,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "renewalReminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "chapaTxRef" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'assigned',
    "content" JSONB NOT NULL,
    "branchName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "abandonedAt" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "role" "MentorMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentorMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'awaiting_ci',
    "prNumber" INTEGER NOT NULL,
    "headSha" TEXT NOT NULL,
    "diff" TEXT NOT NULL,
    "ciPassed" BOOLEAN,
    "ciRunUrl" TEXT,
    "failureReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "requirementsMetScore" INTEGER,
    "correctnessTestsScore" INTEGER,
    "codeQualityScore" INTEGER,
    "problemSolvingScore" INTEGER,
    "totalScore" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubConnection_userId_key" ON "GitHubConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StarterRepo_userId_key" ON "StarterRepo"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StarterRepo_githubRepoId_key" ON "StarterRepo"("githubRepoId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_chapaSubscriptionRef_key" ON "Subscription"("chapaSubscriptionRef");

-- CreateIndex
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_chapaTxRef_key" ON "Payment"("chapaTxRef");

-- CreateIndex
CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_userId_status_idx" ON "Ticket"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_userId_branchName_key" ON "Ticket"("userId", "branchName");

-- CreateIndex
CREATE INDEX "MentorMessage_ticketId_createdAt_idx" ON "MentorMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_ticketId_attempt_key" ON "Submission"("ticketId", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_submissionId_key" ON "Evaluation"("submissionId");

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubConnection" ADD CONSTRAINT "GitHubConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StarterRepo" ADD CONSTRAINT "StarterRepo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorMessage" ADD CONSTRAINT "MentorMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written constraints (Doc 4 §4.4 / §4.5) — Prisma cannot express these
-- ---------------------------------------------------------------------------

-- DR-01: at most one active ticket per user (active = not done/abandoned)
CREATE UNIQUE INDEX "Ticket_userId_active_key"
ON "Ticket" ("userId")
WHERE "status" NOT IN ('done', 'abandoned');

-- DR-02: at most one live subscription per user (active or past_due)
CREATE UNIQUE INDEX "Subscription_userId_live_key"
ON "Subscription" ("userId")
WHERE "status" IN ('active', 'past_due');

-- DR-03: submission attempts are only 1 or 2
ALTER TABLE "Submission"
ADD CONSTRAINT "Submission_attempt_range_check"
CHECK ("attempt" IN (1, 2));

-- DR-04: score fields all-null or all-filled, each in [0, 100]
ALTER TABLE "Evaluation"
ADD CONSTRAINT "Evaluation_scores_all_or_none_check"
CHECK (
  (
    "requirementsMetScore" IS NULL
    AND "correctnessTestsScore" IS NULL
    AND "codeQualityScore" IS NULL
    AND "problemSolvingScore" IS NULL
    AND "totalScore" IS NULL
  )
  OR (
    "requirementsMetScore" IS NOT NULL
    AND "correctnessTestsScore" IS NOT NULL
    AND "codeQualityScore" IS NOT NULL
    AND "problemSolvingScore" IS NOT NULL
    AND "totalScore" IS NOT NULL
  )
);

ALTER TABLE "Evaluation"
ADD CONSTRAINT "Evaluation_requirementsMetScore_range_check"
CHECK ("requirementsMetScore" IS NULL OR ("requirementsMetScore" >= 0 AND "requirementsMetScore" <= 100));

ALTER TABLE "Evaluation"
ADD CONSTRAINT "Evaluation_correctnessTestsScore_range_check"
CHECK ("correctnessTestsScore" IS NULL OR ("correctnessTestsScore" >= 0 AND "correctnessTestsScore" <= 100));

ALTER TABLE "Evaluation"
ADD CONSTRAINT "Evaluation_codeQualityScore_range_check"
CHECK ("codeQualityScore" IS NULL OR ("codeQualityScore" >= 0 AND "codeQualityScore" <= 100));

ALTER TABLE "Evaluation"
ADD CONSTRAINT "Evaluation_problemSolvingScore_range_check"
CHECK ("problemSolvingScore" IS NULL OR ("problemSolvingScore" >= 0 AND "problemSolvingScore" <= 100));

ALTER TABLE "Evaluation"
ADD CONSTRAINT "Evaluation_totalScore_range_check"
CHECK ("totalScore" IS NULL OR ("totalScore" >= 0 AND "totalScore" <= 100));
