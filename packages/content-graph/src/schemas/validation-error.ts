import { ZodError, ZodIssue } from "zod";

/**
 * Structured validation error returned by the GraphBuilder and schema boundaries.
 * Consumers never need to import Zod directly — all errors are mapped to this shape.
 */
export interface ValidationError {
  /** Semantic error code (e.g. "PROVENANCE_GATE_VIOLATION", "FIELD_CONSTRAINT_VIOLATION") */
  code: string;
  /** Human-readable description of the violation */
  message: string;
  /** JSON path to the offending field, as an array of string segments */
  path: string[];
  /**
   * The raw Zod issue code (e.g. "too_small", "invalid_type") for non-custom issues.
   * Omitted for custom issues where `code` already carries the semantic meaning.
   */
  constraint?: string;
}

/**
 * Maps a Zod `ZodError` to an array of `ValidationError` objects.
 *
 * Code resolution priority:
 * 1. If `issue.code === "custom"` and `issue.params?.code` is a string, use that value.
 *    This covers: PROVENANCE_GATE_VIOLATION, CONTRADICTION_EVIDENCE_INSUFFICIENT,
 *    DANGLING_REFERENCE, UNREGISTERED_SOURCE, DEPTH_PROGRESSION_VIOLATION.
 * 2. Otherwise use "FIELD_CONSTRAINT_VIOLATION" (length, range, UUID, enum failures).
 */
export function mapZodError(error: ZodError): ValidationError[] {
  return error.issues.map((issue: ZodIssue): ValidationError => {
    const path = issue.path.map(String);
    const message = issue.message;

    if (
      issue.code === "custom" &&
      typeof (issue.params as Record<string, unknown> | undefined)?.code === "string"
    ) {
      return {
        code: (issue.params as Record<string, unknown>).code as string,
        message,
        path,
        // No constraint for custom issues — the code already carries the semantic meaning
      };
    }

    return {
      code: "FIELD_CONSTRAINT_VIOLATION",
      message,
      path,
      constraint: issue.code,
    };
  });
}
