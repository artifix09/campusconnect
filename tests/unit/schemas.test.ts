import { describe, expect, it } from "vitest";
import {
  ChangeStatusInput,
  CreateComplaintInput,
  IdempotencyKey,
  ListComplaintsQuery,
} from "@/modules/complaints/schemas";

const valid = {
  categoryId: "0193f1aa-0000-7000-8000-00000000c0de",
  title: "Internet down in Lab 3",
  description: "No computer in Lab 3 can reach the internet since 9 AM.",
};

describe("CreateComplaintInput", () => {
  it("strips fields a student must never set (mass assignment)", () => {
    const parsed = CreateComplaintInput.parse({
      ...valid,
      departmentId: "0193f1aa-0000-7000-8000-0000000000ff",
      status: "RESOLVED",
      studentId: "someone-else",
      priority: "URGENT",
    });
    expect(parsed).not.toHaveProperty("departmentId");
    expect(parsed).not.toHaveProperty("status");
    expect(parsed).not.toHaveProperty("studentId");
    expect(parsed).not.toHaveProperty("priority");
    expect(parsed.isAnonymous).toBe(false);
  });

  it("trims text and enforces lengths", () => {
    expect(CreateComplaintInput.parse({ ...valid, title: "   Internet down   " }).title).toBe("Internet down");
    expect(CreateComplaintInput.safeParse({ ...valid, title: "Hi" }).success).toBe(false);
    expect(CreateComplaintInput.safeParse({ ...valid, description: "too short" }).success).toBe(false);
  });

  it("requires a valid category id", () => {
    expect(CreateComplaintInput.safeParse({ ...valid, categoryId: "1" }).success).toBe(false);
  });
});

describe("ChangeStatusInput", () => {
  it("uses the reason as the note when rejecting", () => {
    expect(ChangeStatusInput.parse({ to: "REJECTED", reason: "Outside our responsibility." })).toEqual({
      to: "REJECTED",
      note: "Outside our responsibility.",
    });
  });

  it("does not allow staff to set WITHDRAWN or PENDING", () => {
    expect(ChangeStatusInput.safeParse({ to: "WITHDRAWN" }).success).toBe(false);
    expect(ChangeStatusInput.safeParse({ to: "PENDING" }).success).toBe(false);
  });
});

describe("ListComplaintsQuery", () => {
  it("parses comma-separated statuses and applies defaults", () => {
    const q = ListComplaintsQuery.parse({ status: "pending,in_progress" });
    expect(q.status).toEqual(["PENDING", "IN_PROGRESS"]);
    expect(q.limit).toBe(20);
    expect(q.sort).toBe("-createdAt");
  });

  it("rejects unknown sort fields", () => {
    expect(ListComplaintsQuery.safeParse({ sort: "password" }).success).toBe(false);
  });
});

describe("IdempotencyKey", () => {
  it("accepts UUIDs and rejects junk", () => {
    expect(IdempotencyKey.safeParse("6f1c2b8e-3a51-4c0e-9f61-8f7a2d1b0c44").success).toBe(true);
    expect(IdempotencyKey.safeParse("short").success).toBe(false);
    expect(IdempotencyKey.safeParse("has spaces in it").success).toBe(false);
  });
});
