import { describe, expect, it } from "vitest";

describe("infra de teste", () => {
  it("roda vitest com indexedDB fake disponível", () => {
    expect(typeof indexedDB).toBe("object");
  });
});
