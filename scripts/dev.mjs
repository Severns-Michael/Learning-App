// Wrapper that strips ELECTRON_RUN_AS_NODE before launching electron-vite.
// That env var (if set in the user's shell) makes Electron run as plain Node,
// breaking the main process. Unsetting it here ensures the app works regardless.
import { spawn } from "node:child_process";

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const args = process.argv.slice(2);
const cmd = args.shift() ?? "dev";

const child = spawn("electron-vite", [cmd, ...args], {
  stdio: "inherit",
  env,
  shell: true,
});
child.on("exit", (code) => process.exit(code ?? 0));
