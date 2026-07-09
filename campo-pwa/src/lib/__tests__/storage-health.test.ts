import { describe, expect, it } from "vitest";
import { formatBytes, storageWarning } from "@/lib/storage-health";

describe("formatBytes", () => {
  it("formata MB e GB legíveis", () => {
    expect(formatBytes(0)).toBe("0 MB");
    expect(formatBytes(180 * 1024 * 1024)).toBe("180 MB");
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe("2,5 GB");
  });
});

describe("storageWarning", () => {
  it("null quando há espaço de sobra", () => {
    expect(storageWarning({ usage: 100e6, quota: 10e9 })).toBeNull();
  });
  it("avisa quando resta menos de 500MB ou menos de 10% da cota", () => {
    expect(storageWarning({ usage: 9.8e9, quota: 10e9 })).toMatch(/quase cheio/i);
    expect(storageWarning({ usage: 0.95e9, quota: 1e9 })).toMatch(/quase cheio/i);
  });
  it("null quando estimate indisponível", () => {
    expect(storageWarning(null)).toBeNull();
  });
});
