-- AlterTable
ALTER TABLE "two_factor" ADD COLUMN     "failed_verification_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locked_until" TIMESTAMPTZ,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "two_factor_secret_idx" ON "two_factor"("secret");
