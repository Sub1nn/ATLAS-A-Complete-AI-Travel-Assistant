import { AsyncLocalStorage } from "node:async_hooks";

const agentRuntimeStorage = new AsyncLocalStorage();

export function withAgentRuntime(runtime, operation) {
  if (!runtime || typeof runtime !== "object") {
    throw new TypeError("An ATLAS agent runtime is required.");
  }
  if (typeof operation !== "function") {
    throw new TypeError("An ATLAS agent operation is required.");
  }
  return agentRuntimeStorage.run(runtime, operation);
}

export function getAgentRuntime() {
  const runtime = agentRuntimeStorage.getStore();
  if (!runtime) throw new Error("ATLAS agent runtime is unavailable.");
  return runtime;
}
