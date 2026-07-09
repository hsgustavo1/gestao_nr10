import { createServerFn } from "@tanstack/react-start";
import {
  normalizeParecerResponse,
  type ParecerInput,
  type ParecerSugestao,
} from "./rti-parecer-ai";

const MODEL = "llama-3.3-70b-versatile";
const FALLBACK_MODEL = "qwen/qwen3.6-27b";
const MAX_RETRIES = 3;

const PROMPT_SYSTEM =
  "Você é um engenheiro eletricista consultor, redigindo o parecer técnico de um Relatório " +
  "Técnico de Inspeção (RTI) de instalações elétricas conforme a NR-10, em português formal " +
  "brasileiro. Seja objetivo, técnico e sem alarmismo. O texto será REVISADO por um humano " +
  "responsável (ART) antes de emitir — é uma sugestão. Responda em JSON estrito no formato " +
  '{"parecer": "...", "resumo_executivo": "..."}. O parecer tem 3 a 6 parágrafos separados ' +
  "por \\n: estado geral da instalação, principais riscos pelas NCs mais graves, e conclusão " +
  "com recomendação de priorização. O resumo_executivo tem 1 parágrafo para gestores.";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGroq(
  apiKey: string,
  input: ParecerInput,
  model: string = MODEL,
): Promise<ParecerSugestao> {
  const body = {
    model,
    messages: [
      { role: "system", content: PROMPT_SYSTEM },
      { role: "user", content: `Dados estruturados da inspeção:\n${JSON.stringify(input)}` },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  };
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      return normalizeParecerResponse(JSON.parse(data.choices[0].message.content as string));
    }
    const errBody = await res.text();
    if (res.status === 429 && attempt < MAX_RETRIES - 1) {
      const m = errBody.match(/try again in ([\d.]+)s/);
      await sleep((m ? parseFloat(m[1]) + 1 : 8) * 1000);
      continue;
    }
    throw new Error(`Groq HTTP ${res.status}: ${errBody}`);
  }
  throw new Error("Groq: limite de requisições excedido após múltiplas tentativas.");
}

/**
 * Sugere parecer + resumo executivo a partir do resumo estruturado das NCs.
 * Só o resumo textual das NCs sai do servidor; o texto volta marcado como
 * sugestão e é sempre revisado por humano antes da emissão (D-C3).
 */
export const sugerirParecer = createServerFn({ method: "POST" })
  .validator((data: { input: ParecerInput }) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY não configurada no servidor.");
    try {
      return await callGroq(apiKey, data.input);
    } catch (err) {
      console.error(`Falha com o modelo principal (${MODEL}), tentando fallback`, err);
      return callGroq(apiKey, data.input, FALLBACK_MODEL);
    }
  });
