import { useState } from "react";
import { Text, Box, useInput } from "ink";

interface HandoffViewProps {
  title: string;
  content: string;
  onClose: () => void;
}

/** A simple scrollable reader for a /handoff markdown file. */
export function HandoffView({ title, content, onClose }: HandoffViewProps) {
  const maxVisible = Math.max((process.stdout.rows || 24) - 6, 8);
  const width = Math.min((process.stdout.columns || 80) - 2, 120);
  const lines = content.split("\n").map((l) => (l.length > width ? l.slice(0, width) : l));
  const maxScroll = Math.max(0, lines.length - maxVisible);
  const [offset, setOffset] = useState(0);

  useInput((input, key) => {
    if (key.escape || input === "h" || input === "H" || input === "q" || input === "Q") onClose();
    else if (key.downArrow) setOffset((p) => Math.min(p + 1, maxScroll));
    else if (key.upArrow) setOffset((p) => Math.max(p - 1, 0));
    else if (key.pageDown) setOffset((p) => Math.min(p + 10, maxScroll));
    else if (key.pageUp) setOffset((p) => Math.max(p - 10, 0));
  });

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        Handoff · {title}
      </Text>
      <Box flexDirection="column">
        {lines.slice(offset, offset + maxVisible).map((line, i) => (
          <Text key={i} wrap="truncate">
            {line || " "}
          </Text>
        ))}
      </Box>
      <Text dimColor>
        {offset + maxVisible < lines.length || offset > 0
          ? `lines ${offset + 1}-${Math.min(offset + maxVisible, lines.length)} of ${lines.length} · `
          : ""}
        Up/Down scroll · Esc/H back
      </Text>
    </Box>
  );
}
