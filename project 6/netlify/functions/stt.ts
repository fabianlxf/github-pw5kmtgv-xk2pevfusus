import type { Handler } from '@netlify/functions'
import OpenAI from 'openai'

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }
    if (!process.env.OPENAI_API_KEY) return { statusCode: 501, body: 'OPENAI_API_KEY fehlt' }

    // multipart/form-data auslesen
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || ''
    if (!contentType.includes('multipart/form-data')) {
      return { statusCode: 400, body: 'multipart/form-data erwartet (field "file")' }
    }

    // Netlify stellt den rohen Body als Base64 bereit:
    const raw = Buffer.from(event.body || '', 'base64')
    // simple boundary split (für kleine Uploads ok)
    const boundary = contentType.split('boundary=')[1]
    if (!boundary) return { statusCode: 400, body: 'boundary fehlt' }

    const parts = raw.toString('binary').split(`--${boundary}`)
    const filePart = parts.find(p => p.includes('name="file"'))
    if (!filePart) return { statusCode: 400, body: 'file fehlt' }

    const headerEnd = filePart.indexOf('\r\n\r\n')
    const fileBinary = filePart.slice(headerEnd + 4, filePart.lastIndexOf('\r\n'))
    const buf = Buffer.from(fileBinary, 'binary')

    const filenameMatch = /filename="([^"]+)"/.exec(filePart)
    const filename = filenameMatch?.[1] || 'audio.webm'
    const mimeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(filePart)
    const mime = mimeMatch?.[1] || 'audio/webm'

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    // Node: File aus undici verwenden
    const { File } = await import('undici')
    const file = new File([buf], filename, { type: mime })

    const resp = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      temperature: 0,
    })

    const text = String((resp as any).text || '').trim()
    if (!text) return { statusCode: 422, body: JSON.stringify({ error: 'Kein Text erkennbar.' }) }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }
  } catch (e: any) {
    console.error('stt error', e)
    return { statusCode: 500, body: e?.message || 'stt failed' }
  }
}
