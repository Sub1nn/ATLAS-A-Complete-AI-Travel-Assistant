import { spawn } from "child_process";

const intervalMs = Math.max(60 * 60 * 1000, Number(process.env.RETENTION_INTERVAL_MS || 24 * 60 * 60 * 1000));

async function runRetention() {
  await new Promise((resolve) => {
    const child = spawn(process.execPath, [new URL("./enforce-retention.js", import.meta.url).pathname], { stdio: "inherit", env: process.env });
    child.once("exit", (code) => {
      if (code) console.error(`Retention enforcement exited with code ${code}`);
      resolve();
    });
  });
}

while (true) {
  await runRetention();
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
