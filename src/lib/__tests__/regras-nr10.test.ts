import { describe, expect, it } from "vitest";
import { addDays, addYears, format } from "date-fns";
import { trainingExpiryStatus } from "../qualificacoes";
import { ncPrazoBucket } from "../rti";
import { epiTestStatus, nextTestDate, type EPI, type EPITest } from "../epis";
import { prontuarioCompleteness, PIE_REQUIRED_CATEGORIES, type NR10Document } from "../prontuario";
import { asoStatus, type ASO } from "../asos";
import { computeAptidao } from "../aptidao";

// As regras de validade/vencimento são o core do produto: estes testes
// protegem contra regressões nos cálculos de conformidade NR-10.

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const hoje = new Date();

// ── Capacitações: reciclagem bienal (NR-10 10.8.8) ───────────────────────────

describe("trainingExpiryStatus (validade 2 anos)", () => {
  it("sem data → none", () => {
    expect(trainingExpiryStatus(null)).toBe("none");
  });
  it("treinamento recente → ok", () => {
    expect(trainingExpiryStatus(iso(addDays(hoje, -30)))).toBe("ok");
  });
  it("vencendo dentro de 90 dias do fim dos 2 anos → expiring", () => {
    const date = iso(addDays(addYears(hoje, -2), 30)); // vence em ~30 dias
    expect(trainingExpiryStatus(date)).toBe("expiring");
  });
  it("mais de 2 anos → expired", () => {
    expect(trainingExpiryStatus(iso(addDays(addYears(hoje, -2), -10)))).toBe("expired");
  });
});

// ── RTI: faixas de prazo ─────────────────────────────────────────────────────

describe("ncPrazoBucket", () => {
  const nc = (prazo: string | null) => ({ prazo, status: "pendente" as const });
  it("sem prazo → sem_prazo", () => {
    expect(ncPrazoBucket(nc(null))).toBe("sem_prazo");
  });
  it("prazo passado → vencido", () => {
    expect(ncPrazoBucket(nc(iso(addDays(hoje, -1))))).toBe("vencido");
  });
  it("até 7 dias → semana", () => {
    expect(ncPrazoBucket(nc(iso(addDays(hoje, 5))))).toBe("semana");
  });
  it("até 30 dias → 30dias", () => {
    expect(ncPrazoBucket(nc(iso(addDays(hoje, 20))))).toBe("30dias");
  });
  it("até 90 dias → 90dias", () => {
    expect(ncPrazoBucket(nc(iso(addDays(hoje, 60))))).toBe("90dias");
  });
  it("acima de 90 dias → mais90", () => {
    expect(ncPrazoBucket(nc(iso(addDays(hoje, 120))))).toBe("mais90");
  });
});

// ── EPIs: status de ensaio ───────────────────────────────────────────────────

describe("epiTestStatus", () => {
  const epi = (interval = 6): EPI => ({
    id: "e1", epi_type: "luva_isolante", description: null, epi_class: null,
    serial_number: null, ca: null, employee_id: null, sector: null,
    acquisition_date: null, test_interval_months: interval, active: true,
    notes: null, created_at: "", updated_at: "",
  });
  const test = (date: string, result: "aprovado" | "reprovado" = "aprovado"): EPITest => ({
    id: "t1", epi_id: "e1", test_date: date, result, laboratory: null,
    certificate_path: null, notes: null, created_at: "",
  });

  it("sem ensaio → none", () => {
    expect(epiTestStatus(epi(), null)).toBe("none");
  });
  it("reprovado tem precedência → failed", () => {
    expect(epiTestStatus(epi(), test(iso(addDays(hoje, -10)), "reprovado"))).toBe("failed");
  });
  it("ensaio recente → ok", () => {
    expect(epiTestStatus(epi(6), test(iso(addDays(hoje, -30))))).toBe("ok");
  });
  it("intervalo estourado → expired", () => {
    expect(epiTestStatus(epi(6), test(iso(addDays(hoje, -200))))).toBe("expired");
  });
  it("próximo ensaio = último aprovado + intervalo", () => {
    const last = test("2026-01-15");
    expect(nextTestDate(epi(6), last)).toBe("2026-07-15");
  });
});

// ── Prontuário: completude ───────────────────────────────────────────────────

describe("prontuarioCompleteness", () => {
  const doc = (category: string, validity: string | null): NR10Document => ({
    id: crypto.randomUUID(), category: category as NR10Document["category"],
    title: "Doc", description: null, document_date: null, validity_date: validity,
    file_path: null, responsavel: null, art: null, created_by: null,
    created_by_name: null, created_at: "", updated_at: "",
  });

  it("sem documentos: só a categoria integrada (Pessoas) conta", () => {
    const r = prontuarioCompleteness([]);
    expect(r.covered).toHaveLength(1);
    expect(r.missing).toHaveLength(PIE_REQUIRED_CATEGORIES.length - 1);
  });
  it("documento vencido não cobre a categoria", () => {
    // -2 dias evita a borda de 24h (ancoragem em T12:00:00) — robusto à hora do dia
    const r = prontuarioCompleteness([doc("esquema_unifilar", iso(addDays(hoje, -2)))]);
    expect(r.missing).toContain("esquema_unifilar");
  });
  it("documento perene cobre a categoria", () => {
    const r = prontuarioCompleteness([doc("esquema_unifilar", null)]);
    expect(r.covered).toContain("esquema_unifilar");
  });
});

// ── ASO: status ──────────────────────────────────────────────────────────────

const asoBase = (over: Partial<ASO>): Pick<ASO, "validity_date" | "resultado" | "apto_eletricidade"> => ({
  validity_date: iso(addDays(hoje, 180)),
  resultado: "apto",
  apto_eletricidade: true,
  ...over,
});

describe("asoStatus", () => {
  it("sem ASO → none", () => {
    expect(asoStatus(null)).toBe("none");
  });
  it("válido e distante → ok", () => {
    expect(asoStatus(asoBase({}))).toBe("ok");
  });
  it("vencendo em ≤ 60 dias → expiring", () => {
    expect(asoStatus(asoBase({ validity_date: iso(addDays(hoje, 30)) }))).toBe("expiring");
  });
  it("vencido → expired", () => {
    // -2 dias evita a borda de 24h (ancoragem em T12:00:00) — robusto à hora do dia
    expect(asoStatus(asoBase({ validity_date: iso(addDays(hoje, -2)) }))).toBe("expired");
  });
  it("inapto tem precedência sobre validade", () => {
    expect(asoStatus(asoBase({ resultado: "inapto" }))).toBe("inapto");
  });
  it("sem aptidão para eletricidade → inapto", () => {
    expect(asoStatus(asoBase({ apto_eletricidade: false }))).toBe("inapto");
  });
});

// ── Motor de aptidão (NR-10 10.8) ────────────────────────────────────────────

describe("computeAptidao", () => {
  const base = () => ({
    employee: { status: "ativo" as const, reciclagem_requerida: false, reciclagem_motivo: null },
    trainings: [{ training_type: "nr10_basico" as const, category: "formacao" as const, training_date: iso(addDays(hoje, -100)) }],
    authorization: { valid: true },
    aso: { ...asoBase({}), exam_date: iso(addDays(hoje, -10)) },
  });

  it("tudo em dia → apto sem bloqueantes", () => {
    const r = computeAptidao(base());
    expect(r.apto).toBe(true);
    expect(r.bloqueantes).toHaveLength(0);
  });

  it("sem autorização → bloqueado", () => {
    const r = computeAptidao({ ...base(), authorization: null });
    expect(r.apto).toBe(false);
    expect(r.bloqueantes.map((b) => b.code)).toContain("sem_autorizacao");
  });

  it("autorização inválida → bloqueado", () => {
    const r = computeAptidao({ ...base(), authorization: { valid: false } });
    expect(r.bloqueantes.map((b) => b.code)).toContain("autorizacao_invalida");
  });

  it("NR-10 Básico ausente → bloqueado", () => {
    const r = computeAptidao({ ...base(), trainings: [] });
    expect(r.bloqueantes.map((b) => b.code)).toContain("nr10_basico_ausente");
  });

  it("NR-10 Básico vencido → bloqueado", () => {
    const r = computeAptidao({
      ...base(),
      trainings: [{ training_type: "nr10_basico", category: "formacao", training_date: iso(addDays(addYears(hoje, -2), -30)) }],
    });
    expect(r.bloqueantes.map((b) => b.code)).toContain("nr10_basico_vencido");
  });

  it("reciclagem recente revalida formação antiga", () => {
    const r = computeAptidao({
      ...base(),
      trainings: [
        { training_type: "nr10_basico", category: "formacao", training_date: iso(addYears(hoje, -5)) },
        { training_type: "nr10_basico", category: "reciclagem", training_date: iso(addDays(hoje, -60)) },
      ],
    });
    expect(r.apto).toBe(true);
  });

  it("ASO ausente → bloqueado", () => {
    const r = computeAptidao({ ...base(), aso: null });
    expect(r.bloqueantes.map((b) => b.code)).toContain("aso_ausente");
  });

  it("ASO vencido → bloqueado", () => {
    const r = computeAptidao({
      ...base(),
      aso: { ...asoBase({ validity_date: iso(addDays(hoje, -5)) }), exam_date: iso(addYears(hoje, -2)) },
    });
    expect(r.bloqueantes.map((b) => b.code)).toContain("aso_vencido");
  });

  it("ASO inapto p/ eletricidade → bloqueado", () => {
    const r = computeAptidao({
      ...base(),
      aso: { ...asoBase({ apto_eletricidade: false }), exam_date: iso(addDays(hoje, -10)) },
    });
    expect(r.bloqueantes.map((b) => b.code)).toContain("aso_inapto");
  });

  it("reciclagem extraordinária pendente → bloqueado com motivo", () => {
    const r = computeAptidao({
      ...base(),
      employee: { status: "ativo", reciclagem_requerida: true, reciclagem_motivo: "Mudança de função" },
    });
    const b = r.bloqueantes.find((x) => x.code === "reciclagem_requerida");
    expect(b).toBeDefined();
    expect(b!.detail).toBe("Mudança de função");
  });

  it("colaborador afastado → bloqueado", () => {
    const r = computeAptidao({ ...base(), employee: { status: "afastado" } });
    expect(r.bloqueantes.map((b) => b.code)).toContain("colaborador_inativo");
  });

  it("acumula múltiplos bloqueantes", () => {
    const r = computeAptidao({
      employee: { status: "ativo", reciclagem_requerida: true },
      trainings: [],
      authorization: null,
      aso: null,
    });
    expect(r.apto).toBe(false);
    expect(r.bloqueantes.length).toBeGreaterThanOrEqual(4);
  });
});
