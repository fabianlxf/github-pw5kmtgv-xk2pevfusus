{\rtf1\ansi\ansicpg1252\cocoartf2821
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 import type \{ Handler \} from "@netlify/functions";\
import OpenAI from "openai";\
\
export const handler: Handler = async (event) => \{\
  try \{\
    // Only POST with multipart/form-data\
    if (event.httpMethod !== "POST") \{\
      return \{ statusCode: 405, body: "Method Not Allowed" \};\
    \}\
\
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";\
    if (!OPENAI_API_KEY) \{\
      return \{ statusCode: 501, body: JSON.stringify(\{ error: "OPENAI_API_KEY missing" \}) \};\
    \}\
\
    // Netlify Functions raw body handling\
    // We expect a binary body from the browser FormData upload\
    if (!event.body) \{\
      return \{ statusCode: 400, body: JSON.stringify(\{ error: "no audio file" \}) \};\
    \}\
\
    // Netlify encodes body base64 by default for binary uploads\
    const isBase64 = event.isBase64Encoded;\
    const buf = Buffer.from(event.body, isBase64 ? "base64" : "utf8");\
\
    // We can\'92t easily parse multipart boundary here.\
    // Simplest: accept raw audio blob from client instead of multipart.\
    // On the client, send fetch(url, \{ body: blob, headers: \{ "Content-Type": "audio/webm" \}\})\
    // BUT if you want to keep FormData, we need a parser. For brevity, we accept raw blob.\
\
    // Try to infer mimetype from header\
    const mime = event.headers["content-type"] || "audio/webm";\
\
    // Use OpenAI Whisper\
    const openai = new OpenAI(\{ apiKey: OPENAI_API_KEY \});\
    // Create a File from the buffer (Edge-compatible)\
    const file = new File([buf], "speech.webm", \{ type: mime \});\
\
    const resp = await openai.audio.transcriptions.create(\{\
      file,\
      model: "whisper-1",\
      temperature: 0,\
    \});\
\
    const text = String((resp as any).text || "").trim();\
    if (!text) \{\
      return \{ statusCode: 422, body: JSON.stringify(\{ error: "Kein Text erkennbar." \}) \};\
    \}\
\
    return \{\
      statusCode: 200,\
      headers: \{ "Content-Type": "application/json" \},\
      body: JSON.stringify(\{ text \}),\
    \};\
  \} catch (err: any) \{\
    console.error("[/api/stt] error", err);\
    return \{\
      statusCode: 500,\
      body: JSON.stringify(\{ error: "stt failed", detail: err?.message || String(err) \}),\
    \};\
  \}\
\};}