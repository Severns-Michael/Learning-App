import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { platform } from "node:process";

const HEALTH_URL = "http://127.0.0.1:8000/api/health/";
const READY_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 500;

function pythonExecutable(repoRoot: string): string {
  // Prefer the project venv; fall back to system python if not found.
  const venvWin = resolve(repoRoot, ".venv", "Scripts", "python.exe");
  const venvUnix = resolve(repoRoot, ".venv", "bin", "python");
  if (platform === "win32" && existsSync(venvWin)) return venvWin;
  if (platform !== "win32" && existsSync(venvUnix)) return venvUnix;
  return platform === "win32" ? "python" : "python3";
}

export class DjangoSupervisor {
  private child: ChildProcess | null = null;

  constructor(private repoRoot: string) {}

  async start(): Promise<void> {
    const python = pythonExecutable(this.repoRoot);
    const backendDir = resolve(this.repoRoot, "lms_backend");

    console.log(`[django] starting: ${python} manage.py runserver`);
    this.child = spawn(
      python,
      ["manage.py", "runserver", "127.0.0.1:8000", "--noreload"],
      { cwd: backendDir, stdio: ["ignore", "pipe", "pipe"] },
    );

    this.child.stdout?.on("data", (b) => process.stdout.write(`[django] ${b}`));
    this.child.stderr?.on("data", (b) => process.stderr.write(`[django] ${b}`));
    this.child.on("exit", (code, signal) => {
      console.log(`[django] exited code=${code} signal=${signal}`);
      this.child = null;
    });

    await this.waitForReady();
  }

  private async waitForReady(): Promise<void> {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(1000) });
        if (res.ok) {
          const body = (await res.json()) as { ok?: boolean };
          if (body.ok) {
            console.log("[django] health check passed");
            return;
          }
        }
      } catch {
        // not ready yet
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    throw new Error(`Django did not become ready within ${READY_TIMEOUT_MS}ms`);
  }

  stop(): void {
    if (!this.child) return;
    console.log("[django] stopping");
    if (platform === "win32" && this.child.pid) {
      // /T kills the whole process tree, /F forces termination.
      spawn("taskkill", ["/pid", String(this.child.pid), "/T", "/F"]);
    } else {
      this.child.kill("SIGTERM");
    }
    this.child = null;
  }
}
