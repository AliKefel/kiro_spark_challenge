// Public barrel export for @lattice/content-graph

// --- EvidenceAnchor ---
export { EvidenceAnchorSchema, LocatorSchema } from "./schemas/evidence-anchor.schema.js";
export type { EvidenceAnchor, Locator } from "./schemas/evidence-anchor.schema.js";

// --- ConceptNode ---
export { ConceptNodeSchema, DepthSchema } from "./schemas/concept-node.schema.js";
export type { ConceptNode, Depth } from "./schemas/concept-node.schema.js";

// --- RelationshipEdge ---
export { RelationshipEdgeSchema, EdgeTypeSchema } from "./schemas/relationship-edge.schema.js";
export type { RelationshipEdge, EdgeType } from "./schemas/relationship-edge.schema.js";

// --- ContentGraph ---
export { ContentGraphSchema } from "./schemas/content-graph.schema.js";
export type { ContentGraph } from "./schemas/content-graph.schema.js";

// --- Validation ---
export { mapZodError } from "./schemas/validation-error.js";
export type { ValidationError } from "./schemas/validation-error.js";

// --- Builder ---
export { GraphBuilder } from "./builder/graph-builder.js";
export type { Result, ConceptNodeInput, RelationshipEdgeInput } from "./builder/graph-builder.js";
