const target = process.env.SOAK_TEST_URL || "http://127.0.0.1:4000/health/ready";
const concurrency = Math.max(1, Math.min(Number(process.env.SOAK_TEST_CONCURRENCY || 20), 500));
const durationMs = Math.max(10000, Number(process.env.SOAK_TEST_DURATION_MS || 5 * 60 * 1000));
const timeoutMs = Math.max(1000, Number(process.env.SOAK_TEST_REQUEST_TIMEOUT_MS || 10000));
const maxFailureRate = Math.max(0, Math.min(1, Number(process.env.SOAK_TEST_MAX_FAILURE_RATE || 0.01)));
const deadline = Date.now() + durationMs;
const latencies = [];
let requests = 0;
let failures = 0;

async function worker() {
  while (Date.now() < deadline) {
    const started = performance.now();
    requests += 1;
    try {
      const response = await fetch(target, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
      if (!response.ok) failures += 1;
      await response.arrayBuffer();
    } catch {
      failures += 1;
    } finally {
      latencies.push(performance.now() - started);
    }
  }
}

const started = performance.now();
await Promise.all(Array.from({ length: concurrency }, () => worker()));
latencies.sort((a, b) => a - b);
const percentile = (value) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * value))] || 0;
const seconds = (performance.now() - started) / 1000;
const failureRate = requests ? failures / requests : 1;
console.log(JSON.stringify({
  target,
  durationSeconds: Number(seconds.toFixed(2)),
  concurrency,
  requests,
  failures,
  failureRate: Number(failureRate.toFixed(5)),
  requestsPerSecond: Number((requests / seconds).toFixed(2)),
  p50Ms: Number(percentile(0.5).toFixed(2)),
  p95Ms: Number(percentile(0.95).toFixed(2)),
  p99Ms: Number(percentile(0.99).toFixed(2)),
}, null, 2));
if (failureRate > maxFailureRate) process.exitCode = 1;
