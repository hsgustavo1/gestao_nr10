import { createServerFn } from "@tanstack/react-start";
import { normalizePageAnalysis, type PageAnalysis } from "./certificados-ai";

const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const FALLBACK_MODEL = "qwen/qwen3.6-27b";
const MAX_RETRIES = 3;

const PROMPT_SYSTEM =
  "Você lê certificados de treinamento NR-10 a partir de imagens escaneadas (às vezes com baixa " +
  "qualidade). Extraia exatamente o que está escrito na imagem, sem adivinhar nomes de terceiros. " +
  "Responda em JSON estrito.";

const USER_TEXT =
  "Analise esta página de certificado e responda apenas com um JSON no formato:\n" +
  '{"orientation_correction": 0|90|180|270, "page_type": "frente"|"verso", ' +
  '"employee_name_read": "<nome completo exatamente como está escrito, ' +
  'ou null se a página não tiver nome de pessoa>", "training_course_read": "<nome do curso como está escrito, ou null>", ' +
  '"training_type_guess": "nr10_basico"|"nr10_areas_classificadas"|"sep"|null, ' +
  '"category_guess": "formacao"|"reciclagem"|null, ' +
  '"workload_hours_read": <número de horas da carga horária como está escrito, ou null se não achar>, ' +
  '"training_date_read": "<data de REALIZAÇÃO/CONCLUSÃO do treinamento em dd/mm/aaaa, ou null>", ' +
  '"dates_read": ["..."], "confidence": "alta"|"media"|"baixa"}\n\n' +
  "Duas datas distintas: training_date_read é a data em que o treinamento foi REALIZADO/CONCLUÍDO " +
  '(ex.: "realizado em 12/03/2026", "concluído em..."). A data de EMISSÃO do certificado (ex.: ' +
  '"emitido em", "São Paulo, 20 de março de 2026") NÃO vai em training_date_read — coloque-a apenas ' +
  "em dates_read. Se houver só uma data e não der para saber qual é, use-a em training_date_read.\n\n" +
  "Carga horária e categoria: procure a carga horária no certificado (ex.: \"carga horária: 40 horas\", " +
  '"40h", "16 horas"). Regra: FORMAÇÃO (curso inicial) de NR-10 básico/complementar tem ~40 horas; ' +
  "RECICLAGEM tem ~16 horas. Use a carga horária para decidir category_guess quando ela existir. " +
  "Se não tiver certeza da categoria (carga horária ausente/ilegível e o texto não deixa claro), use " +
  'confidence "baixa" — é melhor deixar o campo para o usuário preencher do que chutar.\n\n' +
  "PRIMEIRO avalie a ORIENTAÇÃO: a imagem pode chegar girada (deitada ou de cabeça para baixo). " +
  "Em orientation_correction informe quantos graus no sentido HORÁRIO a imagem precisa ser girada " +
  "para o texto ficar na horizontal e legível: 0 se já está reta, 90 se o texto sobe da direita para " +
  "a esquerda, 180 se está de cabeça para baixo, 270 se o texto sobe da esquerda para a direita. " +
  "Se orientation_correction não for 0, ainda assim tente ler os campos o melhor possível — a imagem " +
  "será girada e reanalisada, então priorize acertar a orientação.\n\n" +
  "Critério para page_type — importante: o cabeçalho/logo da empresa aparece em TODAS as páginas " +
  "(frente e verso), então ele sozinho NÃO indica que é frente. Use este critério:\n" +
  '- "frente": contém a frase de certificação nominal, algo como "Certificamos [NOME DA PESSOA], ' +
  'por ter concluído o curso...". Tem o nome de uma pessoa específica.\n' +
  '- "verso": contém conteúdo programático — uma lista numerada (1., 2., 3., 4. ...) de tópicos/ementa ' +
  "do curso, carga horária detalhada, ou texto técnico genérico. NÃO tem nome de pessoa nenhuma.\n" +
  'Regra de consistência obrigatória: se employee_name_read for null, page_type DEVE ser "verso". ' +
  'Se employee_name_read tiver um nome, page_type DEVE ser "frente".';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGroq(
  apiKey: string,
  imageDataUrl: string,
  model: string = MODEL,
): Promise<PageAnalysis> {
  const body = {
    model,
    messages: [
      { role: "system", content: PROMPT_SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: USER_TEXT },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices[0].message.content as string;
      return normalizePageAnalysis(JSON.parse(content) as PageAnalysis);
    }

    const errBody = await res.text();
    if (res.status === 429 && attempt < MAX_RETRIES - 1) {
      const m = errBody.match(/try again in ([\d.]+)s/);
      const waitMs = (m ? parseFloat(m[1]) + 1 : 8) * 1000;
      await sleep(waitMs);
      continue;
    }
    throw new Error(`Groq HTTP ${res.status}: ${errBody}`);
  }
  throw new Error("Groq: limite de requisições excedido após múltiplas tentativas.");
}

/**
 * Analisa uma página de certificado (imagem, renderizada no client a partir do
 * PDF) via Groq/Llama 4 Vision. Só a imagem sai do nosso servidor — nenhum
 * roster de colaboradores é enviado; o match com o colaborador acontece
 * localmente em `certificados-ai.ts`, depois que a IA só leu o texto da imagem.
 */
export const analyzeCertificatePage = createServerFn({ method: "POST" })
  .validator((data: { imageDataUrl: string }) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY não configurada no servidor.");
    }
    try {
      return await callGroq(apiKey, data.imageDataUrl);
    } catch (err) {
      console.error(`Falha com o modelo principal (${MODEL}), tentando fallback`, err);
      return callGroq(apiKey, data.imageDataUrl, FALLBACK_MODEL);
    }
  });
