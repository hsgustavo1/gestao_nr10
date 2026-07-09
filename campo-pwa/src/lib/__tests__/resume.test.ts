import { describe, expect, it } from "vitest";
import { saveResume, getResume, clearResume, type ResumePoint } from "@/lib/resume";

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size;
    },
  } as Storage;
}

const point: ResumePoint = {
  inspectionId: "i1",
  label: "Subestação 2 → QGBT-03",
  path: "/inspecoes/i1/ponto/p1",
  at: new Date("2026-07-08T10:00:00Z").toISOString(),
};

describe("resume", () => {
  it("salva e recupera dentro da janela de 12h", () => {
    const s = fakeStorage();
    saveResume(point, s);
    const got = getResume(new Date("2026-07-08T18:00:00Z").getTime(), s);
    expect(got?.path).toBe("/inspecoes/i1/ponto/p1");
  });
  it("expira após 12h", () => {
    const s = fakeStorage();
    saveResume(point, s);
    expect(getResume(new Date("2026-07-09T01:00:00Z").getTime(), s)).toBeNull();
  });
  it("clearResume remove", () => {
    const s = fakeStorage();
    saveResume(point, s);
    clearResume(s);
    expect(getResume(Date.now(), s)).toBeNull();
  });
  it("tolera JSON corrompido", () => {
    const s = fakeStorage();
    s.setItem("campo-resume", "{lixo");
    expect(getResume(Date.now(), s)).toBeNull();
  });
});
