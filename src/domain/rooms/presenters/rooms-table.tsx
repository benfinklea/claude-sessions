import { useState } from "react";
import { Text, Box, useInput, useApp } from "ink";
import type { Session } from "../../session/domain/session.model.js";
import { truncate, padRight } from "../../session/presenters/formatters/table-formatter.js";

export type RoomsIntent =
  | { kind: "resume"; session: Session }
  | { kind: "new"; slug: string }
  | { kind: "rename"; session: Session; label: string }
  | { kind: "close"; session: Session }
  | { kind: "handoff"; session: Session };

interface RoomsTableProps {
  sessions: Session[];
  totalCount: number;
  filter: string;
  onSetFilter: (filter: string) => void;
  onIntent: (intent: RoomsIntent) => void;
  onPreview: (session: Session) => void;
}

const COL = { focus: 38, where: 8, project: 20, branch: 16, when: 9, msgs: 5 };

function glyph(s: Session): { mark: string; color?: string } {
  if (s.isLive) return { mark: "●", color: "green" };
  if (s.isStale) return { mark: "◐", color: "yellow" };
  return { mark: "○", color: undefined };
}

function relTime(d: Date): string {
  const sec = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (sec < 90) return "just now";
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h`;
  return `${Math.round(sec / 86400)}d`;
}

/** Minimal one-line text prompt used for New / Rename. */
function Prompt({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <Box flexDirection="column" paddingTop={1}>
      <Text bold>{title}</Text>
      <Box>
        <Text color="cyan">{"› "}</Text>
        <Text>{value}</Text>
        <Text>▏</Text>
      </Box>
      <Text dimColor>{hint}</Text>
    </Box>
  );
}

export function RoomsTable({
  sessions,
  totalCount,
  filter,
  onSetFilter,
  onIntent,
  onPreview,
}: RoomsTableProps) {
  const { exit } = useApp();
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<"nav" | "search" | "new" | "rename" | "confirmClose">("nav");
  const [draft, setDraft] = useState("");
  // Composable toggle filters, stacked on top of the text search.
  const [worktreesOnly, setWorktreesOnly] = useState(false);
  const [repoFilter, setRepoFilter] = useState<string | null>(null);

  // Distinct repos present (sorted) — what `R` cycles through.
  const repos = [...new Set(sessions.map((s) => s.repo).filter((r): r is string => !!r))].sort();

  // Apply the toggle filters; text search was already applied upstream.
  const view = sessions.filter(
    (s) => (!worktreesOnly || s.hasWorktree) && (repoFilter === null || s.repo === repoFilter),
  );

  const liveCount = view.filter((s) => s.isLive).length;
  const clamped = Math.min(selected, Math.max(view.length - 1, 0));
  const current = view[clamped];

  const maxVisible = Math.max((process.stdout.rows || 24) - 9, 5);
  const scrollOffset = Math.max(0, clamped - maxVisible + 1);
  const visible = view.slice(scrollOffset, scrollOffset + maxVisible);

  const cycleRepo = () => {
    setSelected(0);
    setRepoFilter((curr) => {
      if (repos.length === 0) return null;
      if (curr === null) return repos[0]!;
      const i = repos.indexOf(curr);
      return i < 0 || i === repos.length - 1 ? null : repos[i + 1]!;
    });
  };

  useInput((input, key) => {
    if (mode === "search") {
      if (key.escape) {
        setMode("nav");
        onSetFilter("");
        setSelected(0);
      } else if (key.return) {
        setMode("nav");
      } else if (key.backspace || key.delete) {
        onSetFilter(filter.slice(0, -1));
        setSelected(0);
      } else if (input && !key.ctrl && !key.meta) {
        onSetFilter(filter + input);
        setSelected(0);
      }
      return;
    }

    if (mode === "new" || mode === "rename") {
      if (key.escape) {
        setMode("nav");
        setDraft("");
      } else if (key.return) {
        const value = draft.trim();
        if (value) {
          if (mode === "new") onIntent({ kind: "new", slug: value });
          else if (current) onIntent({ kind: "rename", session: current, label: value });
        }
        setMode("nav");
        setDraft("");
      } else if (key.backspace || key.delete) {
        setDraft((d) => d.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta) {
        setDraft((d) => d + input);
      }
      return;
    }

    if (mode === "confirmClose") {
      if (input === "y" || input === "Y") {
        if (current) onIntent({ kind: "close", session: current });
        setMode("nav");
      } else {
        setMode("nav");
      }
      return;
    }

    // nav mode
    if (key.upArrow) setSelected((p) => Math.max(p - 1, 0));
    else if (key.downArrow) setSelected((p) => Math.min(p + 1, view.length - 1));
    else if (key.pageUp) setSelected((p) => Math.max(p - 10, 0));
    else if (key.pageDown) setSelected((p) => Math.min(p + 10, view.length - 1));
    else if (key.escape && (filter || worktreesOnly || repoFilter)) {
      onSetFilter("");
      setWorktreesOnly(false);
      setRepoFilter(null);
      setSelected(0);
    } else if (input === "/") setMode("search");
    else if (input === "w" || input === "W") {
      setWorktreesOnly((v) => !v);
      setSelected(0);
    } else if (input === "r" || input === "R") {
      cycleRepo();
    } else if (input === "n" || input === "N") {
      setDraft("");
      setMode("new");
    } else if ((input === "e" || input === "E") && current) {
      setDraft(current.focusLabel ?? "");
      setMode("rename");
    } else if ((input === "x" || input === "X") && current) {
      setMode("confirmClose");
    } else if ((input === "h" || input === "H") && current?.handoffPath) {
      onIntent({ kind: "handoff", session: current });
    } else if (input === " " && current) {
      onPreview(current);
    } else if (input === "q" || input === "Q") {
      exit();
    } else if (key.return && current) {
      onIntent({ kind: "resume", session: current });
    }
  });

  if (mode === "new") {
    return (
      <Prompt
        title="New session — short name (creates a worktree + branch via `c -wt`)"
        value={draft}
        hint="Enter create · Esc cancel"
      />
    );
  }
  if (mode === "rename") {
    return (
      <Prompt
        title="Rename — set this session's focus label (writes .wt-focus)"
        value={draft}
        hint="Enter save · Esc cancel"
      />
    );
  }
  if (mode === "confirmClose" && current) {
    return (
      <Box flexDirection="column" paddingTop={1}>
        <Text bold color="yellow">
          Close “{current.focusLabel ?? current.project}”?
        </Text>
        <Text dimColor>
          Runs wtrm (refuses if there are uncommitted changes). y = yes · any = no
        </Text>
      </Box>
    );
  }

  // context-aware Enter label
  const enterLabel = !current
    ? "—"
    : current.isLive
      ? "Jump"
      : current.isStale
        ? "Resume (clean)"
        : "Resume";

  const header = `     ${padRight("Session", COL.focus)} ${padRight("Where", COL.where)} ${padRight("Project", COL.project)} ${padRight("Branch", COL.branch)} ${padRight("When", COL.when)} Msgs`;

  let lastSection = "";
  const rows: React.ReactNode[] = [];
  visible.forEach((s, i) => {
    const realIndex = scrollOffset + i;
    const isSel = realIndex === clamped;
    const section = s.isLive ? "live" : "dormant";
    if (section !== lastSection) {
      lastSection = section;
      rows.push(
        <Text key={`sec-${section}-${realIndex}`} dimColor>
          {section === "live" ? "● LIVE" : "○ DORMANT"}
        </Text>,
      );
    }
    const g = glyph(s);
    const label = s.focusLabel ?? truncate(s.preview, COL.focus);
    const where = s.machine ?? "local";
    const line = `${padRight(truncate(label, COL.focus), COL.focus)} ${padRight(truncate(where, COL.where), COL.where)} ${padRight(truncate(s.project, COL.project), COL.project)} ${padRight(truncate(s.gitBranch, COL.branch), COL.branch)} ${padRight(relTime(s.modifiedAt), COL.when)} ${s.messageCount}`;
    const wt = s.hasWorktree ? "⎇" : " ";
    const ho = s.handoffPath ? "✎" : " ";
    rows.push(
      <Box key={s.id}>
        <Text color={isSel ? "cyan" : g.color} bold={isSel}>
          {isSel ? "▸" : " "}
          {g.mark}
          {wt}
          {ho} {line}
        </Text>
      </Box>,
    );
  });

  const filtersActive = worktreesOnly || repoFilter !== null;

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold>HOME</Text>
        <Text dimColor>
          {"  "}
          {liveCount} live · {view.length}
          {filtersActive ? `/${totalCount}` : ""} shown
        </Text>
        {worktreesOnly && <Text color="green"> [worktrees]</Text>}
        {repoFilter !== null && <Text color="cyan"> [repo:{repoFilter}]</Text>}
      </Box>
      <Text dimColor>{header}</Text>
      {view.length === 0 ? (
        <Box paddingTop={1} flexDirection="column">
          <Text>
            No sessions match{filtersActive ? " these filters (Esc to clear)" : ""}. Press N to
            start one.
          </Text>
        </Box>
      ) : (
        rows
      )}
      <Box paddingTop={1}>
        <Text dimColor>
          Enter {enterLabel} · N New · Space Peek{current?.handoffPath ? " · H Handoff" : ""} · E
          Rename · X Close · / Search · W Worktrees{repos.length ? " · R Repo" : ""} · Ctrl-Space
          Back · Q Quit ⎇ worktree ✎ handoff
        </Text>
      </Box>
      {(mode === "search" || filter) && (
        <Text>
          <Text color="yellow">Search: </Text>
          {filter}
          <Text dimColor> ({view.length})</Text>
        </Text>
      )}
    </Box>
  );
}
