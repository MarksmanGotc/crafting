/**
 * GOTC Materials screenshot → Gemini proxy.
 * Secret: GEMINI_API_KEY (wrangler secret put GEMINI_API_KEY)
 * Never commit the API key.
 */

const MAX_BYTES = 4.5 * 1024 * 1024; // stay under typical Worker request limits

const SYSTEM_PROMPT = `You extract Game of Thrones: Conquest Materials inventory rows from a screenshot.
Return ONLY valid JSON (no markdown) with this shape:
{"materials":[{"name":"Black Iron","amounts":["6.2M","708","196","0","0","0"],"nameInferred":false,"exact":null}]}

Basic materials appear in this fixed order (top→bottom):
Black Iron, Copper Bar, Dragonglass, Goldenheart Wood, Hide, Ironwood, Kingswood Oak, Leather Straps, Milk of the Poppy, Silk, Weirwood, Wildfire, Basic Flux.

Rules:
- Each material row has exactly 6 amounts left→right: poor, common, fine, exquisite, epic, legendary.
- Keep abbreviated amount strings as shown (e.g. "6.2M", "708", "0"). Use "0" for empty/missing cells.
- Prefer official English names.
- Ignore the top resource bar (silver / food / gold).

Partial / cut-off names:
- If a row's name is only partly visible (scrolled off top or bottom) but its six amount icons are readable, STILL include the row.
- Infer the full name from neighbouring visible material names and the SAME list type.
- IMPORTANT: if the visible neighbours are season-set / gear materials (trophy icon on the name bar), infer using that season's gear order — NEVER fall back to basic materials (Wildfire, Copper Bar, etc.).
- Example: row above "Cleansed Lock of Hair" in season 13 is "Blazing Gilded Mail", not Wildfire.
- Basic materials order only applies when neighbours are also basic materials.
- Set "nameInferred": true when you inferred the name; false when the full name is clearly readable.

Open detail / Available panel:
- If a material row is expanded and shows an "Available:" exact count (often with commas, e.g. 3,133,439) and a quality (Poor/Common/Fine/Exquisite/Epic/Legendary), set:
  "exact": {"quality":"poor","amount":"3133439"}
  (digits only or with commas; quality lowercase).
- Also still fill "amounts" for that material's six icon values when visible.
- If no open Available panel for that row, set "exact": null.
- You may include other collapsed rows in the same screenshot; only attach "exact" to the opened material.

Include every material row that has readable amounts on screen.`;

function corsHeaders(origin, allowed) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  return headers;
}

function parseAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function jsonResponse(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...cors,
    },
  });
}

function usageDateKey(now = new Date()) {
  // Approximate Pacific calendar day for RPD-style messaging.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(now); // YYYY-MM-DD
}

async function getUsage(env) {
  if (!env.USAGE) return { count: 0, tracked: false };
  const key = `images:${usageDateKey()}`;
  const raw = await env.USAGE.get(key);
  return { count: Number(raw || 0) || 0, tracked: true, key };
}

async function bumpUsage(env, key) {
  if (!env.USAGE || !key) return;
  const raw = await env.USAGE.get(key);
  const next = (Number(raw || 0) || 0) + 1;
  await env.USAGE.put(key, String(next), { expirationTtl: 60 * 60 * 48 });
  return next;
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    /* fall through */
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch (_) {
      return null;
    }
  }
  return null;
}

async function readImageFromRequest(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('image') || form.get('file') || form.get('screenshot');
    if (!file || typeof file.arrayBuffer !== 'function') {
      throw new Error('Missing image file field (image|file|screenshot)');
    }
    const buf = await file.arrayBuffer();
    const mime = file.type || 'image/jpeg';
    return { bytes: new Uint8Array(buf), mime };
  }

  if (contentType.includes('application/json')) {
    const body = await request.json();
    const dataUrl = body.image || body.dataUrl || body.base64;
    if (!dataUrl || typeof dataUrl !== 'string') {
      throw new Error('JSON body needs image / dataUrl / base64 string');
    }
    const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
    let mime = 'image/jpeg';
    let b64 = dataUrl;
    if (match) {
      mime = match[1];
      b64 = match[2];
    } else if (body.mime) {
      mime = String(body.mime);
    }
    const binary = Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0));
    return { bytes: binary, mime };
  }

  throw new Error('Send multipart/form-data or JSON with base64 image');
}

function toBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function callGemini(env, mime, bytes) {
  const model = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: SYSTEM_PROMPT },
            {
              inlineData: {
                mimeType: mime,
                data: toBase64(bytes),
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        thinkingConfig: {
          thinkingLevel: 'MINIMAL',
        },
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = parseAllowedOrigins(env);
    const cors = corsHeaders(origin, allowed);

    if (request.method === 'OPTIONS') {
      if (origin && !allowed.includes(origin)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method === 'GET') {
      const usage = await getUsage(env);
      const limit = Number(env.DAILY_IMAGE_LIMIT || 0) || 0;
      return jsonResponse(
        {
          ok: true,
          service: 'gotc-gemini-proxy',
          model: env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
          dailyLimit: limit || null,
          usedToday: usage.tracked ? usage.count : null,
        },
        200,
        cors
      );
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'method_not_allowed' }, 405, cors);
    }

    if (origin && !allowed.includes(origin)) {
      return jsonResponse({ error: 'origin_not_allowed' }, 403, cors);
    }

    if (!env.GEMINI_API_KEY) {
      return jsonResponse(
        {
          error: 'missing_api_key',
          message: 'Set Worker secret GEMINI_API_KEY (no billing / Free Tier).',
        },
        500,
        cors
      );
    }

    const limit = Number(env.DAILY_IMAGE_LIMIT || 0) || 0;
    const usage = await getUsage(env);
    if (limit > 0 && usage.tracked && usage.count >= limit) {
      return jsonResponse(
        {
          error: 'daily_limit_reached',
          message: 'Daily AI usage limit reached. Please try again later.',
          usedToday: usage.count,
          dailyLimit: limit,
        },
        429,
        cors
      );
    }

    let image;
    try {
      image = await readImageFromRequest(request);
    } catch (err) {
      return jsonResponse(
        { error: 'bad_request', message: String(err.message || err) },
        400,
        cors
      );
    }

    if (!image.bytes.length) {
      return jsonResponse({ error: 'empty_image' }, 400, cors);
    }
    if (image.bytes.length > MAX_BYTES) {
      return jsonResponse(
        {
          error: 'image_too_large',
          message: 'Image must be under ~4.5MB.',
        },
        413,
        cors
      );
    }

    const { response, payload } = await callGemini(env, image.mime, image.bytes);

    if (response.status === 429) {
      return jsonResponse(
        {
          error: 'quota_exceeded',
          message: 'Daily AI usage limit reached. Please try again later.',
          provider: payload,
        },
        429,
        cors
      );
    }

    if (!response.ok) {
      const msg =
        (payload.error && payload.error.message) ||
        `Gemini error ${response.status}`;
      return jsonResponse(
        {
          error: 'gemini_error',
          message: msg,
          status: response.status,
        },
        response.status >= 400 && response.status < 600 ? response.status : 502,
        cors
      );
    }

    const text =
      payload?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ||
      '';
    const parsed = extractJsonObject(text);
    if (!parsed || !Array.isArray(parsed.materials)) {
      return jsonResponse(
        {
          error: 'parse_failed',
          message: 'Model did not return materials JSON.',
          raw: text.slice(0, 2000),
        },
        502,
        cors
      );
    }

    const usedToday = await bumpUsage(env, usage.key);

    return jsonResponse(
      {
        materials: parsed.materials,
        usedToday: usedToday != null ? usedToday : usage.count,
        dailyLimit: limit || null,
      },
      200,
      cors
    );
  },
};
