import type { Handler } from '@netlify/functions'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }
    if (!process.env.GOOGLE_API_KEY) return { statusCode: 501, body: 'GOOGLE_API_KEY fehlt' }

    const body = JSON.parse(event.body || '{}')
    const description = String(body?.description || '').trim()
    if (!description) return { statusCode: 400, body: 'description required' }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
    const model = genAI.getGenerativeModel({
      model: process.env.GOOGLE_GEMINI_MODEL || 'gemini-1.5-flash',
      generationConfig: { temperature: 0.3, maxOutputTokens: 900, responseMimeType: 'application/json' },
    })

    const day = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const prompt = `Erstelle einen realistischen Zeitplan als JSON …
{
  "date":"${day}",
  "timezone":"Europe/Berlin",
  "tasks":[{ "title":"...", "start":"${day}THH:MM:00", "end":"${day}THH:MM:00", "category":"fitness|finances|learning|personal|work|creativity|social|mind|org|impact|other" }]
}
Nutzer-Notizen:
${description}`

    const resp = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
    let parsed: any
    try { parsed = JSON.parse(resp.response.text()) } catch { parsed = { tasks: [] } }

    const events = (Array.isArray(parsed.tasks) ? parsed.tasks : []).map((t: any) => ({
      title: String(t?.title || 'Task'),
      start: t?.start || `${day}T09:00:00`,
      end: t?.end || `${day}T10:00:00`,
      category: String(t?.category || 'other'),
    }))

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: day, timezone: 'Europe/Berlin', events }),
    }
  } catch (e: any) {
    console.error('plan-day error', e)
    return { statusCode: 500, body: e?.message || 'Plan generation failed' }
  }
}
