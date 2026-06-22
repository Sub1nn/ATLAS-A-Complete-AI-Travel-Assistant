const target = process.env.LOAD_TEST_URL || "http://127.0.0.1:4000/health/live";
const concurrency = Math.max(1, Math.min(Number(process.env.LOAD_TEST_CONCURRENCY || 20), 200));
const requests = Math.max(concurrency, Math.min(Number(process.env.LOAD_TEST_REQUESTS || 250), 10000));
let cursor = 0;
let failures = 0;
const latencies = [];

async function worker() {
  while (cursor < requests) {
    cursor += 1;
    const started = performance.now();
    try {
      const response = await fetch(target, { signal: AbortSignal.timeout(10000) });
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
const report = {
  target,
  requests,
  concurrency,
  failures,
  requestsPerSecond: Number((requests / seconds).toFixed(2)),
  p50Ms: Number(percentile(0.5).toFixed(2)),
  p95Ms: Number(percentile(0.95).toFixed(2)),
  p99Ms: Number(percentile(0.99).toFixed(2)),
};
console.log(JSON.stringify(report, null, 2));
if (failures > Math.max(1, requests * 0.01)) process.exitCode = 1;
