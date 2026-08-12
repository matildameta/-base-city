#!/usr/bin/env node
/**
 * Project-scoped folder lock for Base City.
 *
 * PreToolUse hook: denies any file operation (Write/Edit/Read/NotebookEdit/
 * Glob/Grep) whose target resolves outside this project, and blocks Bash
 * commands that reach into another drive or a system path outside the
 * allow-listed roots.
 *
 * Protocol: reads the hook payload as JSON on stdin. To block, prints a
 * PreToolUse deny decision as JSON on stdout and exits 0.
 *
 * This is intentionally project-scoped (lives in D:\basecity\.claude), NOT a
 * global ~/.claude hook, so it only ever constrains work inside this project.
 */
"use strict";

const path = require("path");

const PROJECT_ROOT = "d:/basecity";

// Roots this session is allowed to touch. The project itself, plus the two
// Claude-managed locations tied to THIS project (memory + task temp) so the
// harness's own bookkeeping keeps working while everything else stays locked.
const ALLOWED_ROOTS = [
  PROJECT_ROOT,
  "c:/users/user/.claude/projects/d--basecity",
  "c:/users/user/appdata/local/temp/claude/d--basecity",
];

/** Normalize any path (windows, msys `/d/`, relative) to lowercase `d:/foo`. */
function normalize(p, cwd) {
  if (!p) return null;
  let s = String(p).trim().replace(/^["']|["']$/g, "");
  if (!s) return null;
  s = s.replace(/\\/g, "/");
  // msys / git-bash drive form: /d/foo -> d:/foo
  const msys = s.match(/^\/([a-zA-Z])\/(.*)$/);
  if (msys) s = msys[1] + ":/" + msys[2];
  // relative -> resolve against cwd
  if (!/^[a-zA-Z]:\//.test(s) && !s.startsWith("//")) {
    s = (cwd ? cwd.replace(/\\/g, "/") : PROJECT_ROOT) + "/" + s;
  }
  s = path.posix.normalize(s).toLowerCase();
  return s;
}

function underAllowedRoot(norm) {
  if (!norm) return true; // nothing concrete to check
  return ALLOWED_ROOTS.some(
    (root) => norm === root || norm.startsWith(root + "/")
  );
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let payload = {};
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    process.exit(0); // fail open on malformed payload rather than wedging the session
  }

  const tool = payload.tool_name || "";
  const input = payload.tool_input || {};
  const cwd = payload.cwd || PROJECT_ROOT;

  // File-path-bearing tools: precise check.
  const pathFields = ["file_path", "notebook_path", "path"];
  for (const f of pathFields) {
    if (input[f]) {
      const norm = normalize(input[f], cwd);
      if (!underAllowedRoot(norm)) {
        deny(
          `Folder lock: '${input[f]}' is outside D:\\basecity. This session is confined to the Base City project.`
        );
      }
    }
  }

  // Bash: block clear cross-drive / system-path reach-outs.
  if (tool === "Bash" && input.command) {
    const cmd = String(input.command);
    // Windows absolute paths on a drive other than D:
    const winDrive = cmd.match(/(?<![a-zA-Z])([a-zA-Z]):[\\/]/g) || [];
    for (const m of winDrive) {
      if (m[0].toLowerCase() !== "d") {
        const norm = normalize(m.replace(/[\\/]$/, "") + "/", cwd);
        if (!underAllowedRoot(norm)) {
          deny(
            `Folder lock: command references '${m}' on another drive. This session is confined to D:\\basecity.`
          );
        }
      }
    }
    // msys absolute drive form /x/ other than /d/
    const msysDrive = cmd.match(/(?:^|\s)\/([a-zA-Z])\//g) || [];
    for (const m of msysDrive) {
      const letter = m.trim().charAt(1).toLowerCase();
      if (letter !== "d") {
        const norm = normalize(m.trim(), cwd);
        if (!underAllowedRoot(norm)) {
          deny(
            `Folder lock: command references '${m.trim()}' outside D:\\basecity.`
          );
        }
      }
    }
  }

  process.exit(0);
});
