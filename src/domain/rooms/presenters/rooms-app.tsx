import React, { useState, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import type { RoomsModule } from "../rooms.module.js";
import type { Session } from "../../session/domain/session.model.js";
import { SplashScreen } from "../../session/presenters/components/splash-screen.js";
import { SessionPreview } from "../../session/presenters/components/session-preview.js";
import { useSessions } from "../../session/presenters/hooks/use-sessions.js";
import { RoomsTable, type RoomsIntent } from "./rooms-table.js";

export interface RoomsCliOptions {
  noSplash: boolean;
}

/** A request handed back to cli.tsx (after Ink exits) to act on via tmux. */
export type RoomsRequest = { kind: "resume"; session: Session } | { kind: "new"; slug: string };

interface RoomsAppProps {
  module: RoomsModule;
  options: RoomsCliOptions;
  version: string;
  onRequest: (req: RoomsRequest) => void;
}

export function RoomsApp({ module, options, version, onRequest }: RoomsAppProps) {
  const { exit } = useApp();
  const [isSplashVisible, setSplashVisible] = useState(!options.noSplash);
  const [notice, setNotice] = useState<string | null>(null);

  // Claude-only dashboard: pin the provider so useSessions loads immediately.
  module.multiAgentRepository.setActiveProvider("claude");

  const {
    filtered,
    filter,
    setFilter,
    openPreview,
    closePreview,
    previewSession,
    previewDetail,
    isLoaded,
    totalCount,
  } = useSessions({
    listUseCase: module.listSessionsUseCase,
    deleteUseCase: module.deleteSessionUseCase,
    getDetailUseCase: module.getSessionDetailUseCase,
    repository: module.multiAgentRepository,
  });

  const handleIntent = useCallback(
    (intent: RoomsIntent) => {
      switch (intent.kind) {
        case "resume":
          onRequest({ kind: "resume", session: intent.session });
          exit();
          break;
        case "new":
          onRequest({ kind: "new", slug: intent.slug });
          exit();
          break;
        case "rename":
          if (intent.session.worktreeRoot) {
            module.worktreeActions.setFocus(intent.session.worktreeRoot, intent.label);
            setNotice(`Renamed → “${intent.label}”. Refresh (r) to update the list.`);
          } else {
            setNotice("Can't rename: no worktree found for this session.");
          }
          break;
        case "close": {
          const root = intent.session.worktreeRoot;
          if (!root) {
            setNotice("Can't close: no worktree found.");
          } else if (intent.session.isLive) {
            setNotice("That session is live — end the agent first, then close.");
          } else {
            const ok = module.worktreeActions.teardown(root, { backup: true });
            setNotice(
              ok
                ? "Closed (changes stashed via wtrm --backup)."
                : "wtrm refused — worktree may be dirty.",
            );
          }
          break;
        }
      }
    },
    [exit, module.worktreeActions, onRequest],
  );

  useInput((input) => {
    if (notice && input) setNotice(null);
  });

  if (isSplashVisible) {
    return <SplashScreen version={version} onComplete={() => setSplashVisible(false)} />;
  }

  if (!isLoaded) {
    return (
      <Box paddingTop={1} paddingLeft={1}>
        <Text dimColor>Loading sessions…</Text>
      </Box>
    );
  }

  if (previewSession && previewDetail) {
    return (
      <SessionPreview
        session={previewSession}
        detail={previewDetail}
        onClose={closePreview}
        onResume={() => {
          onRequest({ kind: "resume", session: previewSession });
          exit();
        }}
      />
    );
  }

  return (
    <Box flexDirection="column">
      <RoomsTable
        sessions={filtered}
        totalCount={totalCount}
        filter={filter}
        onSetFilter={setFilter}
        onIntent={handleIntent}
        onPreview={openPreview}
      />
      {notice && <Text color="cyan">{notice}</Text>}
    </Box>
  );
}
