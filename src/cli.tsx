#!/usr/bin/env node

import React from "react";
import { Command } from "commander";
import { render } from "ink";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { createRoomsModule } from "./domain/rooms/rooms.module.js";
import { RoomsApp, type RoomsRequest } from "./domain/rooms/presenters/rooms-app.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const program = new Command()
  .name("claude-sessions")
  .description(
    "A persistent tmux dashboard for Claude Code sessions — see live vs dormant, jump into running ones, resume old ones, spawn new ones, without typing a tmux command.",
  )
  .version(pkg.version, "-v, --version")
  .option("--splash", "Show the splash screen on launch", false)
  .option("--limit <n>", "How many recent sessions to load (default 300)", "300")
  .option("--all", "Include agent/subagent and workflow transcripts (hidden by default)", false)
  .option("--json", "Print this machine's sessions as JSON and exit (used over SSH)", false)
  .parse();

const opts = program.opts<{ splash: boolean; limit: string; all: boolean; json: boolean }>();

// Fast open: cap how many recent sessions the Claude provider parses.
if (!process.env.CLAUDE_SESSIONS_LIMIT && opts.limit) {
  process.env.CLAUDE_SESSIONS_LIMIT = opts.limit;
}
// Hide agent/subagent/workflow transcripts unless --all.
if (opts.all) process.env.CLAUDE_SESSIONS_INCLUDE_AGENTS = "1";

const module = createRoomsModule();
const { orchestrator, worktreeActions, resolveRowAction } = module;

// Headless JSON mode: report THIS machine's sessions (local-only, no remote
// recursion, no tmux bootstrap, NO render). The Mac calls this over SSH to
// gather pippen. We must NOT fall through to the dashboard, and must NOT call
// process.exit() — on a pipe that truncates the payload to ~64KB. Writing and
// letting the event loop drain naturally flushes the whole thing.
if (opts.json) {
  module.multiAgentRepository.setActiveProvider("claude");
  const sessions = await module.localListUseCase.execute();
  const { toDTO } = await import("./domain/rooms/infrastructure/remote/session-dto.js");
  process.stdout.write(JSON.stringify(sessions.map(toDTO)));
  process.exitCode = 0;
} else {
  runDashboard();
}

function runDashboard(): void {
  // Bootstrap the dedicated "sessions" tmux session + Ctrl-Space→HOME binding.
  // If tmux is unavailable we still run; jumps just fall back to a plain resume.
  const tmuxReady = orchestrator.ensureLobby(os.homedir());

  let pending: RoomsRequest | null = null;
  const instance = render(
    <RoomsApp
      module={module}
      options={{ noSplash: !opts.splash }}
      version={pkg.version}
      onRequest={(req) => {
        pending = req;
      }}
    />,
  );

  instance.waitUntilExit().then(() => {
    if (!pending) return;
    const req: RoomsRequest = pending;

    if (req.kind === "new") {
      // Spawn `c -wt <slug>` in a new lobby window, then jump to it.
      const { command, args } = worktreeActions.spawnCommand(req.slug);
      const target = tmuxReady
        ? orchestrator.spawnWindow({ name: req.slug, cwd: os.homedir(), command, args })
        : null;
      if (target) orchestrator.jumpTo(target);
      else fallbackExec(command, args, os.homedir());
      return;
    }

    // Remote session (e.g. pippen): open a local window that SSHes in — attach the
    // live tmux window there, or resume the session over SSH if dormant.
    if (req.session.machine) {
      const host = req.session.machine;
      const t = req.session.tmuxTarget;
      const remoteCmd =
        req.session.isLive && t
          ? `tmux attach-session -t ${t.session}:${t.window}`
          : `cd '${req.session.worktreeRoot ?? req.session.cwd}' && claude --resume ${req.session.id}`;
      const sshArgs = ["-t", host, remoteCmd];
      if (tmuxReady) {
        const target = orchestrator.spawnWindow({
          name: `${host}:${req.session.focusLabel ?? req.session.project}`,
          cwd: os.homedir(),
          command: "ssh",
          args: sshArgs,
        });
        if (target) {
          orchestrator.jumpTo(target);
          process.exit(0);
        }
      }
      fallbackExec("ssh", sshArgs, os.homedir());
      return;
    }

    // resume (local)
    const action = resolveRowAction.resolve(req.session);
    if (action.kind === "JUMP" && tmuxReady) {
      orchestrator.jumpTo(action.target);
      process.exit(0);
    }

    // RESUME (dormant/stale) — open in a new lobby window, or fall back.
    const resumeArgs = module.resumeSessionUseCase.buildResumeArgs(
      req.session.id,
      req.session.provider,
    );
    if (!resumeArgs) process.exit(0);

    const cwd = req.session.worktreeRoot ?? req.session.cwd;
    if (tmuxReady) {
      const target = orchestrator.spawnWindow({
        name: req.session.focusLabel ?? req.session.project,
        cwd,
        command: resumeArgs.command,
        args: resumeArgs.args,
      });
      if (target) {
        orchestrator.jumpTo(target);
        process.exit(0);
      }
    }
    fallbackExec(resumeArgs.command, resumeArgs.args, cwd);
  });
}

/** No tmux (or spawn failed): run the command inline, handing over the terminal. */
function fallbackExec(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, { stdio: "inherit", cwd });
  process.exit(result.status ?? 0);
}
