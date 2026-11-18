import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("merges Tailwind classes and preserves conditional classes", () => {
    expect(cn("border", "border-primary", false && "hidden")).toBe(
      "border border-primary",
    );
  });
});
