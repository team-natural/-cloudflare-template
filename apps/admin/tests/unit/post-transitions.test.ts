// Pure-logic unit test (no bindings): the Post state machine (DEV-09 §2). This is the
// smallest, most portable kind of test — it validates the allowed-transition table directly.
import { describe, it, expect } from "vitest";
import { allowedTransitions } from "../../src/lib/server/services/posts";

describe("allowedTransitions (Post state machine — DEV-09 §2)", () => {
  it("draft can only be published", () => {
    expect(allowedTransitions("draft")).toEqual(["published"]);
  });

  it("published can go back to draft or be archived", () => {
    expect(allowedTransitions("published")).toEqual(["draft", "archived"]);
  });

  it("archived can only be republished (no direct draft->archived path)", () => {
    expect(allowedTransitions("archived")).toEqual(["published"]);
    expect(allowedTransitions("draft")).not.toContain("archived");
  });
});
