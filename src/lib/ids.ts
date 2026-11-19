import { v7 as uuidv7 } from "uuid";

/** Time-ordered, non-guessable identifiers (ADR-021). */
export function newId(): string {
  return uuidv7();
}
