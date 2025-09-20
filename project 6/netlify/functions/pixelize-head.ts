import type { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Sehr einfacher multipart/form-data Parser (nur für 1 Datei gedacht).
 * Holt die Datei "image" als Buffer heraus.
 */
function parseMultipart(event: any): Buffer {
  const ct = event.headers["content-type"] || event.headers["Content-Type"] || "";
  const match = ct.match(/boundary=([^;]+)/i);
  if (!match) throw new Error("No multipart boundary");
  const boundary = `--${match[1]}`;

  const body = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64")
    : Buffer.from(event.body || "");

  const parts = body.toString("binary").split(boundary).slice(1, -1);
  for (const part of parts) {
    const [rawHeaders, rawData] = part.split("\r\n\r\n");
    if (!rawHeaders || !rawData) continue;
    if (/name="image"/i.test(rawHeaders)) {
      const data = rawData.replace(/\r\n--$/, ""); // strip trailing
      return Buffer.from(data, "binary");
    }
  }
  throw new Error("No image part found");
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method not allowed" };
    }

    const imageBuffer = parseMultipart(event);

    // Gemini initialisieren
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Prompt für Pixel-Head
    const prompt = `
      Convert the provided selfie head into NES-style pixel art.
      Requirements:
      - output PNG
      - 8x8 head grid (transparent background)
      - keep key facial colors
      - crop tightly to the head only
    `;

    const result = await model.generateContent([
      { inlineData: { data: imageBuffer.toString("base64"), mimeType: "image/png" } },
      { text: prompt },
    ]);

    const base64 =
      result.response.candidates?.[0]?.content?.[0]?.inlineData?.data;
    if (!base64) {
      throw new Error("No image data returned from Gemini");
    }

    const buf = Buffer.from(base64, "base64");

    return {
      statusCode: 200,
      headers: { "Content-Type": "image/png" },
      body: buf.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err: any) {
    console.error("[pixelize-head] error:", err);
    return {
      statusCode: 500,
      body: "Pixelize error: " + (err.message || String(err)),
    };
  }
};
