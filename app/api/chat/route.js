import fs from "node:fs/promises";
import path from "node:path";

import { normalizeHistory } from "@/lib/contextWindow";

export const maxDuration = 300;

const DEFAULT_MODEL = "gpt-4.1-nano";
const API_BASE = "https://api.openai.com/v1";
const DEADLINE_MS = 45000;
const HISTORY_LIMIT = 6;
let systemPromptPromise;

function getPreferredModel() {
  const envRaw = process.env.OPENAI_MODEL_CANDIDATES || "";
  const preferred = envRaw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)[0];

  return preferred || DEFAULT_MODEL;
}

async function loadSystemPrompt() {
  if (!systemPromptPromise) {
    const promptPath = path.join(process.cwd(), "prompts", "systemPrompt.txt");
    systemPromptPromise = fs.readFile(promptPath, "utf8");
  }

  return systemPromptPromise;
}

function buildOpenAIInput(history, message) {
  const input = history.map((item) => ({
    role: item.role,
    content: [{ type: "input_text", text: item.content }]
  }));

  const latestIsSameUserMessage =
    history.length > 0 &&
    history[history.length - 1].role === "user" &&
    history[history.length - 1].content === message;

  if (!latestIsSameUserMessage) {
    input.push({
      role: "user",
      content: [{ type: "input_text", text: message }]
    });
  }

  return input;
}

function extractTextFromResponse(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload?.output) ? payload.output : [];
  const reply = output
    .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
    .filter((item) => item?.type === "output_text" || item?.type === "text")
    .map((item) => item?.text || "")
    .join("")
    .trim();

  return reply;
}

async function callOpenAI({ apiKey, model, temperature, instructions, input, deadlineMs }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), deadlineMs);

  try {
    const response = await fetch(`${API_BASE}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        instructions,
        input,
        temperature
      }),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error?.message || `OpenAI request failed (${response.status})`;
      const err = new Error(message);
      err.status = response.status;
      throw err;
    }

    const reply = extractTextFromResponse(payload);
    if (!reply) {
      throw new Error("OpenAI returned an empty reply");
    }

    return reply;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  const startedAt = Date.now();
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const message = String(body?.message || "").trim();
    if (!message) {
      return Response.json({ error: "message is required" }, { status: 400 });
    }

    const history = normalizeHistory(body?.history, HISTORY_LIMIT);
    const systemPrompt = await loadSystemPrompt();
    const input = buildOpenAIInput(history, message);
    const model = getPreferredModel();
    const temperature = Number(process.env.OPENAI_TEMPERATURE || "0.7");
    const elapsed = Date.now() - startedAt;
    const remaining = DEADLINE_MS - elapsed;
    if (remaining <= 0) {
      return Response.json({ error: "Chat request timed out before reaching OpenAI." }, { status: 504 });
    }

    const reply = await callOpenAI({
      apiKey,
      model,
      temperature,
      instructions: systemPrompt.trim(),
      input,
      deadlineMs: remaining
    });

    return Response.json({ reply, model });
  } catch (error) {
    const status =
      typeof error?.status === "number" ? (error.status === 401 || error.status === 403 ? error.status : 502) : 500;

    return Response.json(
      { error: error instanceof Error ? error.message : "Internal chat route error" },
      { status }
    );
  }
}
