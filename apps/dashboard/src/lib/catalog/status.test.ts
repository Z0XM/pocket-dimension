import { describe, expect, it } from "bun:test";
import { extractStatusLine, mapStatusLabel } from "./status";

describe("extractStatusLine", () => {
  it("extracts Status: done", () => {
    expect(extractStatusLine("Status: done\n\n# Story 3.2")).toBe("done");
  });

  it("extracts Status: ready-for-dev", () => {
    expect(extractStatusLine("Status: ready-for-dev\n\n# Story")).toBe("ready-for-dev");
  });

  it("extracts **Status:** complete", () => {
    expect(extractStatusLine("**Status:** complete\n\n# Epic")).toBe("complete");
  });

  it("strips bold/backticks from captured label", () => {
    expect(extractStatusLine("Status: **in-progress**\n")).toBe("in-progress");
    expect(extractStatusLine("Status: `done`\n")).toBe("done");
  });

  it("returns null when Status line is missing", () => {
    expect(extractStatusLine("# Story 3.2\n\nNo status here.")).toBeNull();
  });

  it("returns null for empty Status value", () => {
    expect(extractStatusLine("Status:\n")).toBeNull();
    expect(extractStatusLine("Status:   \n")).toBeNull();
  });

  it("never invents status from body text", () => {
    expect(extractStatusLine("# Story\n\nThe Status: field was removed.\n")).toBeNull();
  });
});

describe("mapStatusLabel", () => {
  it("maps backlog", () => {
    expect(mapStatusLabel("backlog")).toEqual({ status: "backlog", statusLabel: "backlog" });
  });

  it("maps done variants", () => {
    expect(mapStatusLabel("done")).toEqual({ status: "done", statusLabel: "done" });
    expect(mapStatusLabel("complete")).toEqual({ status: "done", statusLabel: "complete" });
    expect(mapStatusLabel("completed")).toEqual({ status: "done", statusLabel: "completed" });
  });

  it("maps board-adjacent labels to unknown with label kept", () => {
    expect(mapStatusLabel("ready-for-dev")).toEqual({ status: "unknown", statusLabel: "ready-for-dev" });
    expect(mapStatusLabel("in-progress")).toEqual({ status: "unknown", statusLabel: "in-progress" });
    expect(mapStatusLabel("review")).toEqual({ status: "unknown", statusLabel: "review" });
    expect(mapStatusLabel("contexted")).toEqual({ status: "unknown", statusLabel: "contexted" });
  });

  it("maps unknown labels with raw statusLabel preserved", () => {
    expect(mapStatusLabel("blocked")).toEqual({ status: "unknown", statusLabel: "blocked" });
  });
});
