import type { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

/** -------- Multipart Parser (Buffer-basiert, robust genug für 1 Datei) ---------- */
function parseMultipartBinary(event: any): { file: Buffer; filename: string; contentType: string } {
  const ct = event.headers["content-type"] || event.headers["Content-Type"] || "";
  const m = ct.match(/multipart\/form-data;\s*boundary=([^;]+)/i);
  if (!m) throw new Error("No multipart boundary");
  const boundary = Buffer.from(`--${m[1]}`);
  const body: Buffer = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64")
    : Buffer.from(event.body || "", "utf8"); // raw bytes

  // Split by boundary in Buffer-space
  const parts: Buffer[] = [];
  let start = body.indexOf(boundary);
  if (start < 0) throw new Error("Boundary not found");
  start += boundary.length;

  while (start < body.length) {
    // boundary CRLF
    if (body[start] === 13 && body[start + 1] === 10) start += 2;
    const next = body.indexOf(boundary, start);
    if (next < 0) break; // should not happen
    const chunk = body.subarray(start, next - 2); // strip trailing CRLF
    parts.push(chunk);
    start = next + boundary.length;
    // closing "--"
    if (body[start] === 45 && body[start + 1] === 45) break;
  }

  for (const part of parts) {
    // Headers end at \r\n\r\n
    const sep = Buffer.from("\r\n\r\n");
    const hdrEnd = part.indexOf(sep);
    if (hdrEnd < 0) continue;
    const rawHeaders = part.subarray(0, hdrEnd).toString("utf8");
    const content = part.subarray(hdrEnd + sep.length);

    const dispo = /content-disposition:\s*form-data;[^]*?name="([^"]+)"(?:;\s*filename="([^"]*)")?/i.exec(rawHeaders);
    if (!dispo) continue;
    const name = dispo[1];
    const filename = dispo[2] || "upload.png";
    const typeMatch = /content-type:\s*([^\r\n]+)/i.exec(rawHeaders);
    const contentType = typeMatch ? typeMatch[1].trim() : "application/octet-stream";

    if (name === "image") {
      return { file: content, filename, contentType };
    }
  }
  throw new Error("No image part found");
}

/** -------- Gemini Pixelize Function ---------- */
export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method not allowed" };
    }

    const { file, contentType } = parseMultipartBinary(event);
    // akzeptiere png/jpg/webp als Input, schicke immer als png zu Gemini
    const inputMime = /png|jpeg|jpg|webp/i.test(contentType) ? contentType : "image/png";

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
      // Wichtig: wir wollen ein *Bild* zurück
      generationConfig: { responseMimeType: "image/png" },
    });

    // Sehr präziser Prompt, damit kein generischer Kopf entsteht
    const prompt = `
You are converting THIS SPECIFIC PERSON's selfie HEAD into tiny pixel art for a game sprite.

STRICT OUTPUT:
- Return exactly one PNG image.
- Transparent background (alpha).
- Head only, tightly cropped; no neck, no body, no text, no borders.
- Target grid: 8×8 pixels (head should fit cleanly into an 8×8 slot).
- Keep the person's unique features: hair color/shape, skin tone, eye placement, facial contrast.
- NES/retro-like style: solid pixels, no antialiasing or gradients, but allow 3–6 colors max for the head.

ALIGNMENT:
- Face centered and facing forward as much as possible.
- The pixel head should be framed so it can be drawn into an 8×8 area.

DO NOT:
- Do not invent a generic head.
- Do not include a body, background, or text.
- Do not output JSON or base64 text—return raw PNG binary only.
`;

    const result = await model.generateContent([
      { inlineData: { data: file.toString("base64"), mimeType: inputMime } },
      { text: prompt },
    ]);

    // Gemini liefert mit responseMimeType das Bild im ersten Part (inlineData)
    const inline =
      result?.response?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
    const b64 = inline?.data as string | undefined;
    if (!b64) throw new Error("No image returned from Gemini");

    return {
      statusCode: 200,
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
      body: b64,
      isBase64Encoded: true,
    };
  } catch (err: any) {
    console.error("[pixelize-head] error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: "Pixelize error: " + (err?.message || String(err)),
    };
  }
};
