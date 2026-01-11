import React from "react";
import { render } from "ink";
import { Calendar, type CalendarConfig } from "./calendar";
import { Document } from "./document";
import type { DocumentConfig } from "./document/types";
import { FlightCanvas } from "./flight";
import type { FlightConfig } from "./flight/types";
import { Inbox, type InboxConfig } from "./inbox";

// Clear screen and hide cursor
function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[H\x1b[?25l");
}

// Show cursor on exit
function showCursor() {
  process.stdout.write("\x1b[?25h");
}

export interface RenderOptions {
  socketPath?: string;
  scenario?: string;
}

export async function renderCanvas(
  kind: string,
  id: string,
  config?: unknown,
  options?: RenderOptions
): Promise<void> {
  // Clear screen before rendering
  clearScreen();

  // Ensure cursor is shown on exit
  process.on("exit", showCursor);
  process.on("SIGINT", () => {
    showCursor();
    process.exit();
  });

  switch (kind) {
    case "calendar":
      return renderCalendar(
        id,
        config as CalendarConfig | undefined,
        options
      );
    case "document":
      return renderDocument(
        id,
        config as DocumentConfig | undefined,
        options
      );
    case "flight":
      return renderFlight(
        id,
        config as FlightConfig | undefined,
        options
      );
    case "inbox":
      return renderInbox(
        id,
        config as InboxConfig | undefined,
        options
      );
    default:
      console.error(`Unknown canvas kind: ${kind}`);
      console.log("Available: calendar, document, flight, inbox");
      process.exit(1);
  }
}

async function renderCalendar(
  id: string,
  config?: CalendarConfig,
  options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <Calendar
      id={id}
      config={config}
      socketPath={options?.socketPath}
      scenario={options?.scenario || "display"}
    />,
    {
      exitOnCtrlC: true,
    }
  );
  await waitUntilExit();
}

async function renderDocument(
  id: string,
  config?: DocumentConfig,
  options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <Document
      id={id}
      config={config}
      socketPath={options?.socketPath}
      scenario={options?.scenario || "display"}
    />,
    {
      exitOnCtrlC: true,
    }
  );
  await waitUntilExit();
}

async function renderFlight(
  id: string,
  config?: FlightConfig,
  options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <FlightCanvas
      id={id}
      config={config}
      socketPath={options?.socketPath}
      scenario={options?.scenario || "booking"}
    />,
    {
      exitOnCtrlC: true,
    }
  );
  await waitUntilExit();
}

async function renderInbox(
  id: string,
  config?: InboxConfig,
  options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <Inbox
      id={id}
      config={config}
      socketPath={options?.socketPath}
      scenario={options?.scenario || "list"}
    />,
    {
      exitOnCtrlC: true,
    }
  );
  await waitUntilExit();
}
