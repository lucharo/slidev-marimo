import { describe, expect, it } from "vitest";
import type { CellOutput } from "./message-parser";
import { extractHtml, parseMessage } from "./message-parser";

describe("parseMessage", () => {
  it("parses valid message", () => {
    const msg = parseMessage('{"op":"cell-op","data":{"cellId":"123"}}');
    expect(msg).toEqual({ op: "cell-op", data: { cellId: "123" } });
  });

  it("returns null for invalid JSON", () => {
    const msg = parseMessage("not json");
    expect(msg).toBeNull();
  });

  it("returns null for missing op field", () => {
    const msg = parseMessage('{"data":{}}');
    expect(msg).toBeNull();
  });
});

describe("extractHtml", () => {
  it("returns null for undefined output", () => {
    expect(extractHtml(undefined)).toBeNull();
  });

  it("handles text/html mimetype", () => {
    const output: CellOutput = {
      channel: "output",
      mimetype: "text/html",
      data: "<div>Hello</div>",
      timestamp: Date.now(),
    };
    expect(extractHtml(output)).toBe("<div>Hello</div>");
  });

  it("handles text/plain mimetype with HTML escaping", () => {
    const output: CellOutput = {
      channel: "output",
      mimetype: "text/plain",
      data: "<script>alert('xss')</script>",
      timestamp: Date.now(),
    };
    expect(extractHtml(output)).toBe(
      "<pre>&lt;script&gt;alert('xss')&lt;/script&gt;</pre>",
    );
  });

  it("handles valid application/json mimetype", () => {
    const output: CellOutput = {
      channel: "output",
      mimetype: "application/json",
      data: '{"key":"value"}',
      timestamp: Date.now(),
    };
    const result = extractHtml(output);
    expect(result).toContain("language-json");
    expect(result).toContain('"key"');
  });

  it("handles invalid application/json gracefully (bug fix)", () => {
    const output: CellOutput = {
      channel: "output",
      mimetype: "application/json",
      data: "not valid json {{{",
      timestamp: Date.now(),
    };
    // Should not throw, should return raw text in pre tag
    const result = extractHtml(output);
    expect(result).toBe("<pre>not valid json {{{</pre>");
  });

  it("handles text/markdown mimetype (bug fix)", () => {
    const output: CellOutput = {
      channel: "output",
      mimetype: "text/markdown",
      data: "# Hello World\n\nThis is **bold**",
      timestamp: Date.now(),
    };
    const result = extractHtml(output);
    expect(result).toContain("markdown-content");
    expect(result).toContain("# Hello World");
  });

  it("handles image/png mimetype", () => {
    const output: CellOutput = {
      channel: "output",
      mimetype: "image/png",
      data: "base64encodeddata",
      timestamp: Date.now(),
    };
    expect(extractHtml(output)).toBe(
      '<img src="data:image/png;base64,base64encodeddata" />',
    );
  });

  it("handles unknown mimetype as preformatted text", () => {
    const output: CellOutput = {
      channel: "output",
      mimetype: "application/unknown",
      data: "some data",
      timestamp: Date.now(),
    };
    expect(extractHtml(output)).toBe("<pre>some data</pre>");
  });
});
