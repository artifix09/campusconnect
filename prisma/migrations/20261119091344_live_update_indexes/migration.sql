-- CreateIndex
CREATE INDEX "complaint_updated_at_idx" ON "complaint"("updated_at");

-- CreateIndex
CREATE INDEX "complaint_department_id_updated_at_idx" ON "complaint"("department_id", "updated_at");

-- CreateIndex
CREATE INDEX "complaint_student_id_updated_at_idx" ON "complaint"("student_id", "updated_at");
