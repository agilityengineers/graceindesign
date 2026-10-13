// Filter at the process boundary: Next's parent/worker request and error output
// bypass application loggers. Keep stdout/stderr separate and preserve exit codes.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createLogRedactor } from "./log-redaction-stream.mjs";

const require = createRequire(import.meta.url);
const child = spawn(process.execPath, [
  require.resolve("next/dist/bin/next"), ...process.argv.slice(2),
], { stdio: ["inherit", "pipe", "pipe"] });
child.stdout.pipe(createLogRedactor()).pipe(process.stdout);
child.stderr.pipe(createLogRedactor()).pipe(process.stderr);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", () => {
  console.error("Unable to start Next.js");
  process.exitCode = 1;
});
child.on("close", (code, signal) => {
  process.exitCode = code ?? (signal === "SIGINT" ? 130 : 143);
});
