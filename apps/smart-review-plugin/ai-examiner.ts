import { requestUrl } from "obsidian";
import { getDefaultProviderUrl, type AiConnectionSettings } from "./settings";

interface AiMessage {
  role: "system" | "user";
  content: string;
}

export async function completeAi(connection: AiConnectionSettings, system: string, user: string): Promise<string> {
  validateConnection(connection);
  const request = buildRequest(connection, [
    { role: "system", content: system },
    { role: "user", content: user }
  ]);
  const response = await withTimeout(requestUrl({
    url: request.url,
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body),
    throw: false
  }), connection.timeoutMs);

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`AI request failed (${response.status}): ${response.text.slice(0, 500)}`);
  }

  const payload = parseJson(response.text);
  return extractResponseText(connection.provider, payload);
}

export async function completeStructuredAi(connection: AiConnectionSettings, system: string, user: string): Promise<Record<string, unknown>> {
  const first = await completeAi(connection, system, user);
  try {
    return parseStructuredJson(first);
  } catch {
    const repaired = await completeAi(
      connection,
      "Repair malformed output into one valid JSON object. Return JSON only and preserve the original meaning.",
      `SCHEMA AND REQUEST:\n${user}\n\nMALFORMED OUTPUT:\n${first}`
    );
    return parseStructuredJson(repaired);
  }
}

export async function testAiConnection(connection: AiConnectionSettings): Promise<void> {
  const text = await completeAi(
    connection,
    "Return JSON only.",
    'Reply with exactly this JSON object: {"status":"ok"}'
  );
  const parsed = parseStructuredJson(text);
  if (getString(parsed, "status") !== "ok") {
    throw new Error("The model responded, but did not follow the required JSON format.");
  }
}

export async function listAiModels(connection: AiConnectionSettings): Promise<string[]> {
  const baseUrl = trimSlash(connection.baseUrl || getDefaultProviderUrl(connection.provider));
  const customHeaders = parseCustomHeaders(connection.customHeaders);
  if (connection.provider === "azure-openai") return [];
  const url = connection.provider === "ollama"
    ? `${baseUrl}/api/tags`
    : connection.provider === "gemini"
      ? `${baseUrl}/models${connection.apiKey.length > 0 ? `?key=${encodeURIComponent(connection.apiKey)}` : ""}`
      : getOpenAiModelsUrl(baseUrl);
  const headers = connection.provider === "anthropic"
    ? { "anthropic-version": "2023-06-01", "x-api-key": connection.apiKey, ...customHeaders }
    : connection.provider === "openai" || connection.provider === "openai-compatible"
      ? { ...(connection.apiKey.length > 0 ? { authorization: `Bearer ${connection.apiKey}` } : {}), ...customHeaders }
      : customHeaders;
  const response = await withTimeout(requestUrl({ url, method: "GET", headers, throw: false }), connection.timeoutMs);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Model discovery failed (${response.status}): ${response.text.slice(0, 500)}`);
  }
  const payload = parseJson(response.text);
  if (connection.provider === "ollama") {
    return uniqueSorted(getArray(payload, "models").map((item) => getRequiredString(asRecord(item), "name")));
  }
  if (connection.provider === "gemini") {
    return uniqueSorted(getArray(payload, "models").flatMap((item) => {
      const model = asRecord(item);
      const methods = model.supportedGenerationMethods;
      if (Array.isArray(methods) && !methods.includes("generateContent")) return [];
      return [getRequiredString(model, "name").replace(/^models\//, "")];
    }));
  }
  return uniqueSorted(getArray(payload, "data").map((item) => getRequiredString(asRecord(item), "id")));
}

export function parseStructuredJson(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return asRecord(JSON.parse(cleaned) as unknown);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) {
      throw new Error("AI response did not contain a JSON object.");
    }
    return asRecord(JSON.parse(cleaned.slice(start, end + 1)) as unknown);
  }
}

function buildRequest(connection: AiConnectionSettings, messages: AiMessage[]): { url: string; headers: Record<string, string>; body: unknown } {
  const baseUrl = trimSlash(connection.baseUrl || getDefaultProviderUrl(connection.provider));
  const customHeaders = parseCustomHeaders(connection.customHeaders);

  if (connection.provider === "anthropic") {
    return {
      url: `${baseUrl}/messages`,
      headers: {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": connection.apiKey,
        ...customHeaders
      },
      body: {
        model: connection.model,
        max_tokens: 4096,
        temperature: 0,
        system: messages[0]?.content ?? "",
        messages: messages.slice(1)
      }
    };
  }

  if (connection.provider === "gemini") {
    const keyQuery = connection.apiKey.length > 0 ? `?key=${encodeURIComponent(connection.apiKey)}` : "";
    return {
      url: `${baseUrl}/models/${encodeURIComponent(connection.model)}:generateContent${keyQuery}`,
      headers: { "content-type": "application/json", ...customHeaders },
      body: {
        systemInstruction: { parts: [{ text: messages[0]?.content ?? "" }] },
        contents: [{ role: "user", parts: [{ text: messages[1]?.content ?? "" }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" }
      }
    };
  }

  if (connection.provider === "ollama") {
    return {
      url: `${baseUrl}/api/chat`,
      headers: { "content-type": "application/json", ...customHeaders },
      body: { model: connection.model, messages, stream: false, format: "json", options: { temperature: 0 } }
    };
  }

  if (connection.provider === "azure-openai") {
    const separator = baseUrl.includes("?") ? "&" : "?";
    const url = baseUrl.includes("/chat/completions")
      ? `${baseUrl}${baseUrl.includes("api-version=") ? "" : `${separator}api-version=2024-10-21`}`
      : `${baseUrl}/openai/deployments/${encodeURIComponent(connection.model)}/chat/completions?api-version=2024-10-21`;
    return {
      url,
      headers: { "content-type": "application/json", "api-key": connection.apiKey, ...customHeaders },
      body: { messages, temperature: 0, max_tokens: 4096 }
    };
  }

  return {
    url: getOpenAiChatCompletionsUrl(baseUrl),
    headers: {
      "content-type": "application/json",
      ...(connection.apiKey.length > 0 ? { authorization: `Bearer ${connection.apiKey}` } : {}),
      ...customHeaders
    },
    body: { model: connection.model, messages, temperature: 0, max_tokens: 4096 }
  };
}

function extractResponseText(provider: AiConnectionSettings["provider"], payload: Record<string, unknown>): string {
  if (provider === "anthropic") {
    const content = getArray(payload, "content");
    const block = content.find((item) => getString(asRecord(item), "type") === "text");
    return getRequiredString(asRecord(block), "text");
  }
  if (provider === "gemini") {
    const candidate = asRecord(getArray(payload, "candidates")[0]);
    const content = asRecord(candidate.content);
    const part = asRecord(getArray(content, "parts")[0]);
    return getRequiredString(part, "text");
  }
  if (provider === "ollama") {
    return getRequiredString(asRecord(payload.message), "content");
  }
  const choice = asRecord(getArray(payload, "choices")[0]);
  return getRequiredString(asRecord(choice.message), "content");
}

function validateConnection(connection: AiConnectionSettings): void {
  if (connection.model.trim().length === 0) {
    throw new Error("AI model name is required.");
  }
  if (connection.provider !== "ollama" && connection.apiKey.trim().length === 0) {
    throw new Error("API key is required for this provider.");
  }
  if (connection.provider === "azure-openai" && connection.baseUrl.trim().length === 0) {
    throw new Error("Azure OpenAI endpoint is required.");
  }
}

function parseCustomHeaders(value: string): Record<string, string> {
  if (value.trim().length === 0) {
    return {};
  }
  const parsed = asRecord(JSON.parse(value) as unknown);
  const headers: Record<string, string> = {};
  for (const [key, item] of Object.entries(parsed)) {
    if (typeof item !== "string") {
      throw new Error("Custom header values must be strings.");
    }
    headers[key] = item;
  }
  return headers;
}

function parseJson(text: string): Record<string, unknown> {
  return asRecord(JSON.parse(text) as unknown);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected an object in AI response.");
  }
  return value as Record<string, unknown>;
}

function getArray(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new Error(`Missing array field: ${key}`);
  }
  return value;
}

function getString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function getRequiredString(record: Record<string, unknown>, key: string): string {
  const value = getString(record, key);
  if (value === null) {
    throw new Error(`Missing text field: ${key}`);
  }
  return value;
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getOpenAiChatCompletionsUrl(baseUrl: string): string {
  if (/\/chat\/completions$/i.test(baseUrl)) {
    return baseUrl;
  }
  return `${baseUrl}/chat/completions`;
}

function getOpenAiModelsUrl(baseUrl: string): string {
  const withoutChatEndpoint = baseUrl.replace(/\/chat\/completions$/i, "");
  return `${withoutChatEndpoint}/models`;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort((left, right) => left.localeCompare(right));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: number | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error("AI request timed out.")), Math.max(1_000, timeoutMs));
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
}
