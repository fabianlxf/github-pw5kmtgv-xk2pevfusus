import type { Handler } from "@netlify/functions";
import parser from "lambda-multipart-parser";
import OpenAI from "openai";

// Whisper STT via OpenAI
export const handler: Handler = async (event) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return { statusCode: 501, body: JSON.stringify({ error: "OPENAI_API_KEY fehlt" }) };
    }
    // multipart/form-data parsen (FormData mit "file")
    const result = await parser.parse(event);
    const file = (result.files || [])[0];

    if (!file || !file.content) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Kein Audio. Feld muss "file" heißen.' }) };
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Node 18+/22 hat global File/Blob meist schon; falls nicht, aus undici holen
    // @ts-ignore
    const NodeFile = (global as any).File ?? (await import("undici")).File;
    const blob = new Blob([file.content], { type: file.contentType || "audio/webm" });
    const up = new NodeFile([blob], file.filename || "speech.webm", { type: file.contentType || "audio/webm" });

    const resp = await openai.audio.transcriptions.create({
      file: up,
      model: "whisper-1",
      temperature: 0,
    });

    const text = String((resp as any).text || "").trim();
    if (!text) {
      return { statusCode: 422, body: JSON.stringify({ error: "Kein Text erkennbar." }) };
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    };
  } catch (e: any) {
    console.error("[stt] error", e);
    return { statusCode: Number(e?.status) || 500, body: JSON.stringify({ error: e?.message || "stt failed" }) };
  }
};
