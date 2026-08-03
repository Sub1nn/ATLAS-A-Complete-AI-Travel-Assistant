import { Annotation } from "@langchain/langgraph";

export const AtlasState = Annotation.Root({
  schemaVersion: Annotation({
    reducer: (_current, next) => next,
    default: () => 1,
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
  temporalContext: Annotation({
    reducer: (_current, next) => next,
    default: () => ({}),
  }),
  planner: Annotation({
    reducer: (_current, next) => next,
    default: () => null,
  }),
  resolved: Annotation({
    reducer: (_current, next) => next,
    default: () => null,
  }),
  assessment: Annotation({
    reducer: (_current, next) => next,
    default: () => null,
  }),
  result: Annotation({
    reducer: (_current, next) => next,
    default: () => null,
  }),
});
