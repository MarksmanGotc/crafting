# GOTC Gemini proxy (Cloudflare Worker)

Gemini Free Tier key only — do **not** link billing. Model: `gemini-3.5-flash-lite`.

## Sinun checklist (järjestyksessä)

### 1) Gemini API key (Free, ilman billingiä)
1. Avaa https://aistudio.google.com/apikey
2. Create API key → valitse / luo projekti
3. **Älä** paina “Set up billing” / älä linkitä korttia
4. Kopioi avain talteen (näytetään kerran)

### 2) Cloudflare-tili
1. Avaa https://dash.cloudflare.com/sign-up
2. Luo tili (ilmainen riittää)
3. Asenna Node.js jos ei ole: https://nodejs.org/

### 3) Deploy Worker tästä kansiosta
PowerShellissä:

```powershell
cd c:\Users\Axel\Desktop\cursor\got\workers\gemini-proxy
npx wrangler login
npx wrangler deploy
npx wrangler secret put GEMINI_API_KEY
```

`secret put` kysyy avaimen — liitä AI Studion key (ei näy repossa).

Deploy tulostaa URL:n, esim. `https://gotc-gemini-proxy.<sinun-subdomain>.workers.dev`

### 4) (Valinnainen) oma päiväraja KV:llä
```powershell
npx wrangler kv namespace create GOTC_USAGE
```
Liitä saatu `id` `wrangler.toml` → `[[kv_namespaces]]` ja deploy uudelleen.

### 5) Kerro URL:lle frontille
Kun Worker toimii, screenshot-importtiin asetetaan tuo `workers.dev`-osoite (tehdään seuraavaksi yhdessä).

## Testi ilman fronttia
```powershell
curl -X POST "https://GOTC-URL.workers.dev/" -F "image=@C:\path\to\1.jpg"
```

Tai selaimessa GET juureen → `{ "ok": true, "service": "gotc-gemini-proxy", ... }`

## Turvallisuus
- Avain vain Cloudflare Secretissä
- CORS rajoitettu `ALLOWED_ORIGINS` (muokkaa `wrangler.toml` jos Pages-URL eri)
- 429 → frontti näyttää “try again later” (ei laskua Free Tierissä)
