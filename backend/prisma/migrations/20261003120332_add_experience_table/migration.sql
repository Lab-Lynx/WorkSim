-- CreateTable
CREATE TABLE "Experience" (
    "id" TEXT NOT NULL,
    "authorName" VARCHAR(80),
    "content" VARCHAR(2000) NOT NULL,
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Experience_createdAt_idx" ON "Experience"("createdAt");
