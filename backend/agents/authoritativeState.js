import { Annotation } from "@langchain/langgraph";

const replace = {
  reducer: (_current, next) => next,
  default: () => null,
};

export const AuthoritativeAtlasState = Annotation.Root({
  schemaVersion: Annotation({
    reducer: (_current, next) => next,
    default: () => 2,
  }),
  message: Annotation({
    reducer: (_current, next) => next,
    default: () => "",
  }),
  memory: Annotation({
    reducer: (_current, next) => next,
    default: () => ({}),
  }),
  previousMessages: Annotation({
    reducer: (_current, next) => next,
    default: () => [],
  }),
  documentFocused: Annotation({
    reducer: (_current, next) => Boolean(next),
    default: () => false,
  }),
  baseResolved: Annotation(replace),
  planner: Annotation(replace),
  resolved: Annotation(replace),
  retrievedDocs: Annotation({
    reducer: (_current, next) => next,
    default: () => [],
  }),
  toolsToUse: Annotation({
    reducer: (_current, next) => next,
    default: () => [],
  }),
  toolResults: Annotation({
    reducer: (_current, next) => next,
    default: () => [],
  }),
  successfulToolResults: Annotation({
    reducer: (_current, next) => next,
    default: () => [],
  }),
  answer: Annotation({
    reducer: (_current, next) => next,
    default: () => "",
  }),
  verificationResult: Annotation(replace),
  quality: Annotation(replace),
  repairCount: Annotation({
    reducer: (_current, next) => Number(next || 0),
    default: () => 0,
  }),
  result: Annotation(replace),
});
