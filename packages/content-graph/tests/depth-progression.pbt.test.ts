// Feature: content-graph-data-model
// Property-based tests for the Depth Progression invariant (Property 7).

import { describe, it } from "vitest";
import * as fc from "fast-check";
import { GraphBuilder } from "../src/builder/graph-builder.js";
import { arbConceptNode } from "./arbitraries.js";

// ---------------------------------------------------------------------------
// Property 7a: "standard" node without prior "overview" sharing a tag is always rejected
// Validates: Requirements 4.3, 4.5
// ---------------------------------------------------------------------------

describe("Depth progression invariant", () => {
  it(
    // Feature: content-graph-data-model, Property 7
    "7a: standard node without prior overview sharing a tag is always rejected",
    () => {
      fc.assert(
        fc.property(
          fc
            .array(fc.uuidV(4), { minLength: 1, maxLength: 2 })
            .chain((sourceIds) =>
              arbConceptNode(sourceIds).map((node) => ({
                sourceIds,
                standardNode: {
                  ...node,
                  depth: "standard" as const,
                  tags: node.tags.length > 0 ? node.tags : ["default-tag"],
                },
              })),
            ),
          ({ sourceIds, standardNode }) => {
            const builder = new GraphBuilder().addSource(sourceIds[0]);
            const result = builder.addNode(standardNode);

            if (result.ok) return false;
            if (result.error.code !== "DEPTH_PROGRESSION_VIOLATION") return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // ---------------------------------------------------------------------------
  // Property 7b: "deep" node without prior "standard" sharing a tag is always rejected
  // Validates: Requirements 4.2, 4.4
  // ---------------------------------------------------------------------------

  it(
    // Feature: content-graph-data-model, Property 7
    "7b: deep node without prior standard sharing a tag is always rejected (even when overview exists)",
    () => {
      fc.assert(
        fc.property(
          fc
            .array(fc.uuidV(4), { minLength: 1, maxLength: 2 })
            .chain((sourceIds) =>
              arbConceptNode(sourceIds).chain((overviewNode) =>
                arbConceptNode(sourceIds).map((deepNode) => ({
                  sourceIds,
                  overviewNode: {
                    ...overviewNode,
                    depth: "overview" as const,
                    tags: ["shared-tag"],
                  },
                  deepNode: {
                    ...deepNode,
                    depth: "deep" as const,
                    tags: ["shared-tag"],
                  },
                })),
              ),
            ),
          ({ sourceIds, overviewNode, deepNode }) => {
            // Build a builder that has an overview node but NO standard node
            const builderWithSource = new GraphBuilder().addSource(sourceIds[0]);
            const overviewResult = builderWithSource.addNode(overviewNode);

            // Overview should always succeed — if it doesn't, skip this sample
            if (!overviewResult.ok) return true;

            const builderWithOverview = overviewResult.value;

            // Attempt to add a deep node — must fail because no standard node exists
            const deepResult = builderWithOverview.addNode(deepNode);

            if (deepResult.ok) return false;
            if (deepResult.error.code !== "DEPTH_PROGRESSION_VIOLATION") return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // ---------------------------------------------------------------------------
  // Property 7c: "overview" node always succeeds (subject to field validity)
  // Validates: Requirements 4.1, 4.6
  // ---------------------------------------------------------------------------

  it(
    // Feature: content-graph-data-model, Property 7
    "7c: overview node always succeeds on a fresh builder",
    () => {
      fc.assert(
        fc.property(
          fc
            .array(fc.uuidV(4), { minLength: 1, maxLength: 2 })
            .chain((sourceIds) =>
              arbConceptNode(sourceIds).map((node) => ({
                sourceIds,
                node: { ...node, depth: "overview" as const },
              })),
            ),
          ({ sourceIds, node }) => {
            const builder = new GraphBuilder().addSource(sourceIds[0]);
            const result = builder.addNode(node);

            return result.ok === true;
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
