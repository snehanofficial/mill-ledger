import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("merges Tailwind classes and preserves conditional classes", () => {
    const isHidden = false;
    expect(cn("border", "border-primary", isHidden && "hidden")).toBe(
      "border border-primary",
    );
  });
});
