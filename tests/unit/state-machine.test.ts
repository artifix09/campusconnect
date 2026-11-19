import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, TRANSITIONS } from "@/domain/state-machine";
import { BusinessRuleError, ConflictError, ForbiddenError } from "@/lib/errors";
import { COMPLAINT_STATUSES, type Actor } from "@/domain/types";

const student: Actor = { id: "s1", role: "STUDENT", name: "S", email: "s@x.pk" };
const stranger: Actor = { id: "s2", role: "STUDENT", name: "T", email: "t@x.pk" };
const admin: Actor = { id: "a1", role: "DEPT_ADMIN", departmentId: "d1", name: "A", email: "a@x.pk" };

const complaint = { studentId: student.id, resolvedAt: null, reopenCount: 0 };
const NOTE = "Fixed the network switch in Lab 3.";

describe("TRANSITIONS", () => {
  it("covers every status", () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual([...COMPLAINT_STATUSES].sort());
  });

  it("makes rejected and withdrawn complaints final", () => {
    expect(TRANSITIONS.REJECTED).toEqual({});
    expect(TRANSITIONS.WITHDRAWN).toEqual({});
  });
});

describe("assertTransition", () => {
  it("lets staff start work on a pending complaint", () => {
    expect(() => assertTransition({ from: "PENDING", to: "IN_PROGRESS", actor: admin, complaint })).not.toThrow();
  });

  it("rejects illegal jumps with a conflict", () => {
    expect(() => assertTransition({ from: "REJECTED", to: "RESOLVED", actor: admin, complaint, note: NOTE })).toThrow(
      ConflictError,
    );
    expect(() => assertTransition({ from: "PENDING", to: "RESOLVED", actor: admin, complaint, note: NOTE })).toThrow(
      ConflictError,
    );
  });

  it("requires a reason to reject and a note to resolve", () => {
    expect(() => assertTransition({ from: "PENDING", to: "REJECTED", actor: admin, complaint, note: "no" })).toThrow(
      BusinessRuleError,
    );
    expect(() => assertTransition({ from: "IN_PROGRESS", to: "RESOLVED", actor: admin, complaint })).toThrow(
      BusinessRuleError,
    );
    expect(canTransition({ from: "IN_PROGRESS", to: "RESOLVED", actor: admin, complaint, note: NOTE })).toBe(true);
  });

  it("stops students from making staff transitions", () => {
    expect(() => assertTransition({ from: "PENDING", to: "IN_PROGRESS", actor: student, complaint })).toThrow(
      ForbiddenError,
    );
  });

  it("lets only the owner withdraw a pending complaint", () => {
    expect(canTransition({ from: "PENDING", to: "WITHDRAWN", actor: student, complaint })).toBe(true);
    expect(canTransition({ from: "PENDING", to: "WITHDRAWN", actor: stranger, complaint })).toBe(false);
    expect(canTransition({ from: "PENDING", to: "WITHDRAWN", actor: admin, complaint })).toBe(false);
    expect(canTransition({ from: "IN_PROGRESS", to: "WITHDRAWN", actor: student, complaint })).toBe(false);
  });

  describe("reopening", () => {
    const now = new Date("2026-11-19T10:00:00Z");
    const resolved = (daysAgo: number, reopenCount = 0) => ({
      studentId: student.id,
      resolvedAt: new Date(now.getTime() - daysAgo * 86_400_000),
      reopenCount,
    });
    const reopen = (c: ReturnType<typeof resolved>, note = "The internet is down again.") =>
      assertTransition({ from: "RESOLVED", to: "IN_PROGRESS", actor: student, complaint: c, note, now });

    it("is allowed within 7 days", () => {
      expect(() => reopen(resolved(3))).not.toThrow();
    });

    it("is refused after 7 days", () => {
      expect(() => reopen(resolved(8))).toThrow(/within 7 days/);
    });

    it("is allowed only once", () => {
      expect(() => reopen(resolved(1, 1))).toThrow(/already been reopened/);
    });

    it("needs a reason", () => {
      expect(() => reopen(resolved(1), "bad")).toThrow(BusinessRuleError);
    });
  });
});
