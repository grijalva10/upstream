import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { useIPCServer } from "./calendar/hooks/use-ipc-server";

export interface Email {
  id: string;
  from: string;
  subject: string;
  preview: string;
  classification:
    | "interested"
    | "pricing_given"
    | "question"
    | "referral"
    | "broker_redirect"
    | "soft_pass"
    | "hard_pass"
    | "bounce"
    | "unclassified";
  confidence: number;
  receivedAt: string;
}

export interface InboxConfig {
  title?: string;
  emails?: Email[];
  filter?: string;
}

interface InboxProps {
  id: string;
  config?: InboxConfig;
  socketPath?: string;
  scenario?: string;
}

const CLASSIFICATION_COLORS = {
  interested: "green",
  pricing_given: "greenBright",
  question: "yellow",
  referral: "cyan",
  broker_redirect: "magenta",
  soft_pass: "gray",
  hard_pass: "red",
  bounce: "redBright",
  unclassified: "white",
} as const;

const CLASSIFICATION_ICONS = {
  interested: "+",
  pricing_given: "$",
  question: "?",
  referral: ">",
  broker_redirect: "B",
  soft_pass: "~",
  hard_pass: "X",
  bounce: "!",
  unclassified: " ",
} as const;

// Demo data
const DEMO_EMAILS: Email[] = [
  {
    id: "1",
    from: "john@acmeholdings.com",
    subject: "Re: Property Interest",
    preview: "Yes, we might be interested in discussing further...",
    classification: "interested",
    confidence: 0.92,
    receivedAt: "2h ago",
  },
  {
    id: "2",
    from: "sarah@smithprops.com",
    subject: "Re: 456 Oak Ave",
    preview: "We'd consider $4.5M for the property...",
    classification: "pricing_given",
    confidence: 0.88,
    receivedAt: "5h ago",
  },
  {
    id: "3",
    from: "mike@johnson.com",
    subject: "Re: Investment Opportunity",
    preview: "What's the current cap rate on this?",
    classification: "question",
    confidence: 0.95,
    receivedAt: "1d ago",
  },
  {
    id: "4",
    from: "lisa@williams.com",
    subject: "Re: Portfolio Discussion",
    preview: "Not interested at this time, thanks.",
    classification: "soft_pass",
    confidence: 0.78,
    receivedAt: "2d ago",
  },
];

export function Inbox({ id, config, socketPath, scenario }: InboxProps) {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [liveConfig, setLiveConfig] = useState(config);

  // IPC for remote control
  useIPCServer({
    socketPath,
    scenario: scenario || "list",
    onClose: () => exit(),
    onUpdate: (newConfig) => setLiveConfig(newConfig as InboxConfig),
  });

  const emails = liveConfig?.emails || DEMO_EMAILS;
  const title = liveConfig?.title || "Response Inbox";

  useInput((input, key) => {
    if (input === "q" || key.escape) {
      if (showDetails) {
        setShowDetails(false);
      } else {
        exit();
      }
    }
    if (key.upArrow || input === "k") {
      setSelectedIndex((i) => Math.max(0, i - 1));
    }
    if (key.downArrow || input === "j") {
      setSelectedIndex((i) => Math.min(emails.length - 1, i + 1));
    }
    if (key.return || input === "o") {
      setShowDetails(true);
    }
  });

  const selectedEmail = emails[selectedIndex];

  if (showDetails && selectedEmail) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            Email Details
          </Text>
        </Box>

        <Box flexDirection="column" borderStyle="single" padding={1}>
          <Text>
            <Text bold>From:</Text> {selectedEmail.from}
          </Text>
          <Text>
            <Text bold>Subject:</Text> {selectedEmail.subject}
          </Text>
          <Text>
            <Text bold>Classification:</Text>{" "}
            <Text color={CLASSIFICATION_COLORS[selectedEmail.classification]}>
              {selectedEmail.classification}
            </Text>{" "}
            ({Math.round(selectedEmail.confidence * 100)}%)
          </Text>
          <Box marginTop={1}>
            <Text>{selectedEmail.preview}</Text>
          </Box>
        </Box>

        <Box marginTop={1}>
          <Text color="gray">Press ESC/q to go back</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {title}
        </Text>
        <Text color="gray"> | </Text>
        <Text color="gray">{emails.length} messages</Text>
      </Box>

      {/* Email list */}
      <Box flexDirection="column" borderStyle="single" padding={1}>
        {emails.map((email, index) => {
          const isSelected = index === selectedIndex;

          return (
            <Box
              key={email.id}
              flexDirection="row"
              paddingY={0}
              backgroundColor={isSelected ? "gray" : undefined}
            >
              {/* Classification indicator */}
              <Box width={3}>
                <Text color={CLASSIFICATION_COLORS[email.classification]} bold>
                  {CLASSIFICATION_ICONS[email.classification]}
                </Text>
              </Box>

              {/* From */}
              <Box width={25}>
                <Text bold={isSelected}>{email.from.slice(0, 23)}</Text>
              </Box>

              {/* Subject */}
              <Box width={35}>
                <Text>{email.subject.slice(0, 33)}</Text>
              </Box>

              {/* Confidence */}
              <Box width={8}>
                <Text color="gray">
                  {Math.round(email.confidence * 100)}%
                </Text>
              </Box>

              {/* Time */}
              <Box width={10}>
                <Text color="gray">{email.receivedAt}</Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Legend */}
      <Box marginTop={1} flexDirection="row" flexWrap="wrap">
        {Object.entries(CLASSIFICATION_ICONS).map(([key, icon]) => (
          <Box key={key} marginRight={2}>
            <Text color={CLASSIFICATION_COLORS[key as keyof typeof CLASSIFICATION_COLORS]}>
              {icon}
            </Text>
            <Text color="gray"> {key}</Text>
          </Box>
        ))}
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text color="gray">
          Navigate: j/k | Open: Enter/o | Quit: q/ESC
        </Text>
      </Box>
    </Box>
  );
}

export default Inbox;
