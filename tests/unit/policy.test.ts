import { describe, expect, it } from "vitest";
import { can, canSeeStudentIdentity, complaintScope, type ComplaintAction } from "@/domain/policy";
import type { Actor, ComplaintRef } from "@/domain/types";

const LIBRARY = "0193f1aa-0000-7000-8000-00000000000a";
const LAB_IT = "0193f1aa-0000-7000-8000-00000000000b";

const owner: Actor = { id: "student-1", role: "STUDENT", name: "Ayesha", email: "a@x.pk" };
const otherStudent: Actor = { id: "student-2", role: "STUDENT", name: "Hamza", email: "h@x.pk" };
const libraryAdmin: Actor = { id: "lib-admin", role: "DEPT_ADMIN", departmentId: LIBRARY, name: "Lib", email: "l@x.pk" };
const labAdmin: Actor = { id: "lab-admin", role: "DEPT_ADMIN", departmentId: LAB_IT, name: "Lab", email: "lb@x.pk" };
const superAdmin: Actor = { id: "super", role: "SUPER_ADMIN", name: "Super", email: "s@x.pk" };

const labComplaint: ComplaintRef = { studentId: owner.id, departmentId: LAB_IT, status: "PENDING" };

describe("complaintScope", () => {
  it("limits students to their own complaints", () => {
    expect(complaintScope(owner)).toEqual({ studentId: owner.id });
  });

  it("limits department admins to their department", () => {
    expect(complaintScope(libraryAdmin)).toEqual({ departmentId: LIBRARY });
  });

  it("gives the super admin everything", () => {
    expect(complaintScope(superAdmin)).toEqual({});
  });
});

describe("can", () => {
  // The brief's scenario: a Library admin must not touch a Lab/IT complaint.
  it.each<ComplaintAction>(["read", "comment", "changeStatus", "changePriority", "internalNote", "export"])(
    "denies the library admin %s on a Lab/IT complaint",
    (action) => {
      expect(can(libraryAdmin, action, labComplaint)).toBe(false);
    },
  );

  it.each<ComplaintAction>(["read", "comment", "changeStatus", "changePriority", "internalNote"])(
    "allows the Lab/IT admin %s on a Lab/IT complaint",
    (action) => {
      expect(can(labAdmin, action, labComplaint)).toBe(true);
    },
  );

  it("lets only the owner read, withdraw, reopen and rate", () => {
    for (const action of ["read", "withdraw", "reopen", "rate"] as const) {
      expect(can(owner, action, labComplaint)).toBe(true);
      expect(can(otherStudent, action, labComplaint)).toBe(false);
    }
  });

  it("never lets a student change status or write internal notes", () => {
    expect(can(owner, "changeStatus", labComplaint)).toBe(false);
    expect(can(owner, "internalNote", labComplaint)).toBe(false);
  });

  it("lets owners attach images only while the complaint is open", () => {
    expect(can(owner, "attach", labComplaint)).toBe(true);
    expect(can(owner, "attach", { ...labComplaint, status: "RESOLVED" })).toBe(false);
    expect(can(labAdmin, "attach", { ...labComplaint, status: "RESOLVED" })).toBe(true);
  });

  it("reserves reassignment and identity reveal for the super admin", () => {
    for (const action of ["reassign", "revealIdentity"] as const) {
      expect(can(superAdmin, action, labComplaint)).toBe(true);
      expect(can(labAdmin, action, labComplaint)).toBe(false);
      expect(can(owner, action, labComplaint)).toBe(false);
    }
  });
});

describe("canSeeStudentIdentity", () => {
  const anonymous = { studentId: owner.id, isAnonymous: true };
  const named = { studentId: owner.id, isAnonymous: false };

  it("hides anonymous students from department admins and the super admin by default", () => {
    expect(canSeeStudentIdentity(labAdmin, anonymous)).toBe(false);
    expect(canSeeStudentIdentity(superAdmin, anonymous)).toBe(false);
  });

  it("always shows students their own identity", () => {
    expect(canSeeStudentIdentity(owner, anonymous)).toBe(true);
  });

  it("shows named complaints to staff", () => {
    expect(canSeeStudentIdentity(labAdmin, named)).toBe(true);
    expect(canSeeStudentIdentity(superAdmin, named)).toBe(true);
  });
});
