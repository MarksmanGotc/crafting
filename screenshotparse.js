/**
 * GOTC Materials screenshot import via Gemini (Cloudflare Worker proxy).
 * Maps AI JSON → catalog keys → Poor totals for calculator inputs.
 */
(function (global) {
    'use strict';

    const GEMINI_PROXY_URL = 'https://gotc-gemini-proxy.nooxel.workers.dev';
    const BMC_URL = 'https://buymeacoffee.com/nooxel';
    const MAX_SCREENSHOTS_PER_BATCH = 4;
    const CLIENT_RATE_MAX_IMAGES = 10;
    const CLIENT_RATE_WINDOW_MS = 15 * 60 * 1000;
    const CLIENT_RATE_STORAGE_KEY = 'gotc-screenshot-ai-window';
    const TIER_MULTIPLIERS = [1, 4, 16, 64, 256, 1024];
    const TIER_NAMES = ['poor', 'common', 'fine', 'exquisite', 'epic', 'legendary'];
    const MSG_BATCH_LIMIT = 'You can add up to 4 screenshots at a time.';
    const MSG_CLIENT_RATE_LIMIT =
        'Easy tiger — free AI only goes so far. Try again in a few minutes.';
    const MSG_QUOTA_EXCEEDED =
        'Free AI daily limit reached. Recognition is paused for a while.';
    const MSG_BMC_TAIL = '— that helps me raise the limits later ☕';
    const FALLBACK_BASIC_MATERIALS = [
        { key: 'black-iron', label: 'Black Iron' },
        { key: 'copper-bar', label: 'Copper Bar' },
        { key: 'dragonglass', label: 'Dragonglass' },
        { key: 'goldenheart-wood', label: 'Goldenheart Wood' },
        { key: 'hide', label: 'Hide' },
        { key: 'ironwood', label: 'Ironwood' },
        { key: 'kingswood-oak', label: 'Kingswood Oak' },
        { key: 'leather-straps', label: 'Leather Straps' },
        { key: 'milk-of-the-poppy', label: 'Milk of the Poppy' },
        { key: 'silk', label: 'Silk' },
        { key: 'weirwood', label: 'Weirwood' },
        { key: 'wildfire', label: 'Wildfire' },
        { key: 'basic-flux', label: 'Basic Flux', aliases: ['FLUX', 'BASIC FLUX'] }
    ];

    function compactName(value) {
        return String(value || '')
            .toUpperCase()
            .replace(/0/g, 'O')
            .replace(/1/g, 'I')
            .replace(/5/g, 'S')
            .replace(/[^A-Z]/g, '');
    }

    function levenshtein(a, b) {
        const m = a.length;
        const n = b.length;
        if (!m) return n;
        if (!n) return m;
        const row = new Array(n + 1);
        for (let j = 0; j <= n; j++) row[j] = j;
        for (let i = 1; i <= m; i++) {
            let prev = i - 1;
            row[0] = i;
            for (let j = 1; j <= n; j++) {
                const cur = row[j];
                row[j] = a[i - 1] === b[j - 1]
                    ? prev
                    : 1 + Math.min(prev, row[j], row[j - 1]);
                prev = cur;
            }
        }
        return row[n];
    }

    function nameDistance(ocrCompact, catalogCompact) {
        if (!ocrCompact || !catalogCompact) return Infinity;
        if (ocrCompact === catalogCompact) return 0;
        if (catalogCompact.length >= 6 && ocrCompact.includes(catalogCompact)) {
            if (ocrCompact.length <= catalogCompact.length + 2) return 0;
            const extra = ocrCompact.length - catalogCompact.length;
            return Math.min(4, 1 + Math.floor(extra / 3));
        }
        if (catalogCompact.length >= 6 && ocrCompact.length >= catalogCompact.length) {
            const maxDist = Math.max(1, Math.floor(catalogCompact.length * 0.22));
            let best = Infinity;
            const span = catalogCompact.length;
            for (let i = 0; i <= ocrCompact.length - span; i++) {
                best = Math.min(best, levenshtein(ocrCompact.substr(i, span), catalogCompact));
                if (best === 0) {
                    if (ocrCompact.length <= catalogCompact.length + 2) return 0;
                    return Math.min(4, 1 + Math.floor((ocrCompact.length - catalogCompact.length) / 3));
                }
            }
            if (best <= maxDist) return best;
        }
        const lengthGap = Math.abs(ocrCompact.length - catalogCompact.length);
        if (lengthGap > Math.max(2, Math.ceil(catalogCompact.length * 0.4))) return Infinity;
        const dist = levenshtein(ocrCompact, catalogCompact);
        if (catalogCompact.length <= 5) {
            return (dist <= 1 && Math.abs(ocrCompact.length - catalogCompact.length) <= 1) ? dist : Infinity;
        }
        return dist <= Math.max(2, Math.floor(catalogCompact.length * 0.28)) ? dist : Infinity;
    }

    function formatSeasonLabel(season) {
        if (season == null || season === '') return 'season0';
        const n = Number(season);
        if (!Number.isFinite(n) || n <= 0) return 'season0';
        return 'season' + n;
    }

    function longestCompactName(material) {
        let best = 0;
        (material.compactNames || []).forEach(name => {
            if (name && name.length > best) best = name.length;
        });
        return best;
    }

    function enrichCatalogItem(item) {
        const names = [item.label].concat(item.aliases || []);
        return {
            ...item,
            kind: item.kind || 'basic',
            names,
            compactNames: names.map(compactName).filter(Boolean)
        };
    }

    function getMaterialsRoot() {
        if (global.materials) return global.materials;
        try {
            if (typeof materials !== 'undefined' && materials) return materials;
        } catch (err) { /* ignore */ }
        return null;
    }

    function getBasicMaterialCatalog() {
        const fromData = [];
        const root = getMaterialsRoot();
        const seasonZero = root && root[0] && root[0].mats;
        if (seasonZero) {
            Object.entries(seasonZero).forEach(([key, meta]) => {
                fromData.push({
                    key,
                    inputId: 'my-' + key,
                    label: (meta && meta['Original-name']) || key,
                    kind: 'basic',
                    season: 0,
                    aliases: key === 'basic-flux' ? ['FLUX', 'BASIC FLUX'] : []
                });
            });
        }
        const source = fromData.length ? fromData : FALLBACK_BASIC_MATERIALS.map(item => ({
            ...item,
            inputId: 'my-' + item.key,
            kind: 'basic',
            season: 0,
            aliases: item.aliases || []
        }));
        return source.map(enrichCatalogItem);
    }

    function getGearMaterialCatalog() {
        const fromData = [];
        const root = getMaterialsRoot();
        if (!root) return [];
        Object.keys(root).forEach(seasonKey => {
            const seasonNum = Number(seasonKey);
            if (!Number.isFinite(seasonNum) || seasonNum < 1) return;
            const season = root[seasonKey];
            if (season && season.mats) {
                Object.entries(season.mats).forEach(([key, meta]) => {
                    fromData.push({
                        key,
                        inputId: 'my-' + key,
                        label: (meta && meta['Original-name']) || key,
                        kind: 'gear',
                        season: seasonNum,
                        aliases: []
                    });
                });
            }
            if (season && season.flux) {
                fromData.push({
                    key: 'season-' + seasonNum + '-flux',
                    inputId: 'my-season-' + seasonNum + '-flux',
                    label: season.flux.name || ('Season ' + seasonNum + ' Flux'),
                    kind: 'gear',
                    season: seasonNum,
                    aliases: ['SEASON ' + seasonNum + ' FLUX']
                });
            }
        });
        return fromData.map(enrichCatalogItem);
    }

    function bestNameDistance(compact, material) {
        let dist = Infinity;
        (material.compactNames || []).forEach(name => {
            dist = Math.min(dist, nameDistance(compact, name));
        });
        return dist;
    }

    /** Parse game amount strings like 6.2M, 708, 8.4K. */
    function parseGameAmount(raw) {
        if (raw == null) return null;
        let text = String(raw).toUpperCase().trim();
        if (!text) return null;
        text = text
            .replace(/(\d),(\d)/g, '$1.$2')
            .replace(/,/g, '')
            .replace(/[O]/g, '0')
            .replace(/[Il]/g, '1')
            .replace(/\s+/g, '');
        text = text.replace(/[^0-9.KMB]/g, '');
        text = text.replace(/\.(?=.*\.)/g, '');
        const match = text.match(/^(\d+(?:\.\d+)?)([KMB])?$/);
        if (!match) {
            const digits = text.match(/^\d+$/);
            if (!digits) return null;
            const asInt = parseInt(digits[0], 10);
            return Number.isFinite(asInt) ? asInt : null;
        }
        const value = parseFloat(match[1]);
        if (!Number.isFinite(value)) return null;
        const suffix = match[2] || '';
        if (suffix === 'K') return Math.round(value * 1000);
        if (suffix === 'M') return Math.round(value * 1000000);
        if (suffix === 'B') return Math.round(value * 1000000000);
        return Math.round(value);
    }

    function tiersToPoor(tiers) {
        let total = 0;
        for (let i = 0; i < 6; i++) {
            const amount = Number(tiers[i]);
            if (Number.isFinite(amount) && amount > 0) {
                total += amount * TIER_MULTIPLIERS[i];
            }
        }
        return total;
    }

    function formatAmount(number) {
        if (number == null || !Number.isFinite(Number(number))) return '';
        const value = Number(number);
        const parts = String(value).split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return parts.join('.');
    }

    function formatScaledInput(poorTotal, scale) {
        const amount = Number(poorTotal);
        const divisor = Number(scale) || 1;
        if (!Number.isFinite(amount)) return '';
        if (divisor >= 1000) {
            const rounded = Math.round((amount / divisor) * 100) / 100;
            const fixed = rounded.toFixed(2).replace(/\.?0+$/, '');
            const parts = fixed.split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            return parts.join('.');
        }
        return formatAmount(Math.round(amount / divisor));
    }

    function padTiers(list) {
        const out = [0, 0, 0, 0, 0, 0];
        (list || []).forEach((value, index) => {
            if (index < 6 && value != null) out[index] = value;
        });
        return out;
    }

    function packMergedMaterial(material, source) {
        const tiers = padTiers(material.tiers);
        const exactTiers = [false, false, false, false, false, false];
        (material.exactTiers || []).forEach((flag, index) => {
            if (index < 6) exactTiers[index] = !!flag;
        });
        return {
            key: material.key,
            inputId: material.inputId,
            label: material.label,
            kind: material.kind || 'basic',
            season: material.season != null ? material.season : null,
            tiers: tiers,
            exactTiers: exactTiers,
            poorTotal: material.poorTotal != null ? material.poorTotal : tiersToPoor(tiers),
            warnings: material.warnings || [],
            inferred: !!material.inferred,
            inferredFrom: material.inferredFrom || '',
            source: source || material.source || ''
        };
    }

    function mergeIntoMaterialMap(target, materials, source) {
        const map = target || {};
        (materials || []).forEach(material => {
            if (!material || !material.key || material.skipped || material.poorTotal == null) return;
            const incoming = packMergedMaterial(material, source);
            const prev = map[incoming.key];
            if (!prev) {
                map[incoming.key] = incoming;
                return;
            }
            const tiers = padTiers(prev.tiers);
            const exactTiers = [false, false, false, false, false, false];
            (prev.exactTiers || []).forEach((flag, index) => {
                if (index < 6) exactTiers[index] = !!flag;
            });
            for (let i = 0; i < 6; i++) {
                if (incoming.exactTiers && incoming.exactTiers[i] && incoming.tiers[i] != null) {
                    tiers[i] = incoming.tiers[i];
                    exactTiers[i] = true;
                } else if (exactTiers[i]) {
                    continue;
                } else if (incoming.tiers && incoming.tiers[i] != null) {
                    tiers[i] = incoming.tiers[i];
                }
            }
            map[incoming.key] = {
                ...prev,
                ...incoming,
                tiers: tiers,
                exactTiers: exactTiers,
                poorTotal: tiersToPoor(tiers),
                warnings: [].concat(prev.warnings || [], incoming.warnings || [])
            };
        });
        return map;
    }

    function mergeImageResults(imageResults) {
        const byKey = {};
        (imageResults || []).forEach(imageResult => {
            mergeIntoMaterialMap(byKey, imageResult.materials, imageResult.fileName);
        });
        return Object.keys(byKey).map(key => byKey[key]);
    }

    function getGeminiProxyUrl() {
        if (typeof global !== 'undefined' && global.GOTC_GEMINI_PROXY_URL) {
            return String(global.GOTC_GEMINI_PROXY_URL).replace(/\/$/, '');
        }
        return GEMINI_PROXY_URL;
    }

    /** Parse exact Available counts like 3,133,439 or 3133439. */
    function parseExactCount(raw) {
        if (raw == null) return null;
        const text = String(raw).trim();
        if (!text) return null;
        if (/[KMB]/i.test(text.toUpperCase())) return null;
        const plain = text.replace(/[^\d]/g, '');
        if (!/^\d{1,9}$/.test(plain)) return null;
        const n = parseInt(plain, 10);
        return Number.isFinite(n) && n >= 0 ? n : null;
    }

    function qualityNameToIndex(quality) {
        const q = String(quality || '').toLowerCase().replace(/[^a-z]/g, '');
        const map = {
            poor: 0,
            common: 1,
            fine: 2,
            exquisite: 3,
            epic: 4,
            legendary: 5,
            legend: 5
        };
        return Object.prototype.hasOwnProperty.call(map, q) ? map[q] : null;
    }

    function resolveGeminiNameToMaterial(name, hintedSeason) {
        const label = String(name || '').trim();
        if (!label) return null;
        const compact = compactName(label);
        if (!compact) return null;
        const seasonHint = hintedSeason != null && Number.isFinite(Number(hintedSeason))
            ? Number(hintedSeason)
            : null;
        const catalog = getBasicMaterialCatalog().concat(getGearMaterialCatalog());
        let best = null;
        catalog.forEach(material => {
            if (seasonHint != null && material.kind === 'gear' && material.season != null
                && material.season !== seasonHint) {
                return;
            }
            const dist = bestNameDistance(compact, material);
            // Allow slightly looser match when name may be inferred / partial.
            if (dist === Infinity || dist > 3) return;
            const nameLen = longestCompactName(material);
            const preferBasic = material.kind === 'basic' ? 1 : 0;
            if (!best
                || dist < best.dist
                || (dist === best.dist && preferBasic > best.preferBasic)
                || (dist === best.dist && preferBasic === best.preferBasic && nameLen > best.nameLen)) {
                best = { material: material, dist: dist, nameLen: nameLen, preferBasic: preferBasic };
            }
        });
        return best ? best.material : null;
    }

    function getBasicMaterialsInOrder() {
        return getBasicMaterialCatalog();
    }

    function getGearMaterialsInOrder(season) {
        return getGearMaterialCatalog().filter(item => (
            item.kind === 'gear'
            && item.season === season
            && item.key.indexOf('-flux') < 0
        ));
    }

    /**
     * When Gemini marks nameInferred, prefer the neighbour in the same list
     * (gear season order or basic order) over a wrong basic guess like Wildfire.
     */
    function resolveInferredMaterialFromNeighbours(rows, index) {
        const row = rows[index];
        if (!row || !row.nameInferred) return null;

        let nextMat = null;
        for (let i = index + 1; i < rows.length; i++) {
            const candidate = resolveGeminiNameToMaterial(rows[i].name || rows[i].label, rows[i].season);
            if (candidate) {
                nextMat = candidate;
                break;
            }
        }
        let prevMat = null;
        for (let i = index - 1; i >= 0; i--) {
            if (rows[i].nameInferred) continue;
            const candidate = resolveGeminiNameToMaterial(rows[i].name || rows[i].label, rows[i].season);
            if (candidate) {
                prevMat = candidate;
                break;
            }
        }

        if (nextMat && nextMat.kind === 'gear' && nextMat.season != null) {
            const list = getGearMaterialsInOrder(nextMat.season);
            const idx = list.findIndex(item => item.key === nextMat.key);
            if (idx > 0) return list[idx - 1];
        }
        if (prevMat && prevMat.kind === 'gear' && prevMat.season != null) {
            const list = getGearMaterialsInOrder(prevMat.season);
            const idx = list.findIndex(item => item.key === prevMat.key);
            if (idx >= 0 && idx < list.length - 1) return list[idx + 1];
        }
        if (nextMat && nextMat.kind === 'basic') {
            const list = getBasicMaterialsInOrder();
            const idx = list.findIndex(item => item.key === nextMat.key);
            if (idx > 0) return list[idx - 1];
        }
        if (prevMat && prevMat.kind === 'basic') {
            const list = getBasicMaterialsInOrder();
            const idx = list.findIndex(item => item.key === prevMat.key);
            if (idx >= 0 && idx < list.length - 1) return list[idx + 1];
        }
        return null;
    }

    function materialsFromGeminiResponse(payload) {
        const rows = payload && Array.isArray(payload.materials) ? payload.materials : [];
        const usedKeys = new Set();
        const materials = [];
        rows.forEach((row, rowIndex) => {
            if (!row) return;
            let material = null;
            if (row.nameInferred) {
                material = resolveInferredMaterialFromNeighbours(rows, rowIndex);
            }
            if (!material) {
                material = resolveGeminiNameToMaterial(row.name || row.label, row.season);
            }
            // If Gemini guessed a basic name but neighbours are gear, force neighbour inference.
            if (material && material.kind === 'basic' && row.nameInferred) {
                const fromNeighbours = resolveInferredMaterialFromNeighbours(rows, rowIndex);
                if (fromNeighbours && fromNeighbours.kind === 'gear') {
                    material = fromNeighbours;
                }
            }
            if (!material || usedKeys.has(material.key)) return;
            const amounts = Array.isArray(row.amounts) ? row.amounts : (Array.isArray(row.tiers) ? row.tiers : []);
            const tiers = [0, 0, 0, 0, 0, 0];
            const exactTiers = [false, false, false, false, false, false];
            const warnings = [];
            for (let i = 0; i < 6; i++) {
                const raw = amounts[i];
                if (raw == null || raw === '' || raw === '-') {
                    tiers[i] = 0;
                    continue;
                }
                const amount = parseGameAmount(raw);
                tiers[i] = amount != null ? amount : 0;
            }

            const exact = row.exact && typeof row.exact === 'object' ? row.exact : null;
            const exactQuality = exact
                ? (exact.quality || exact.tier || exact.qualityIndex)
                : (row.exactQuality || row.exactTierQuality);
            const exactAmountRaw = exact
                ? (exact.amount != null ? exact.amount : exact.value)
                : (row.exactAmount != null ? row.exactAmount : row.available);
            let exactIndex = null;
            if (typeof exactQuality === 'number' && exactQuality >= 0 && exactQuality <= 5) {
                exactIndex = exactQuality;
            } else {
                exactIndex = qualityNameToIndex(exactQuality);
            }
            const exactAmount = parseExactCount(exactAmountRaw);
            if (exactIndex != null && exactAmount != null) {
                tiers[exactIndex] = exactAmount;
                exactTiers[exactIndex] = true;
                warnings.push('Used exact Available count for ' + TIER_NAMES[exactIndex]);
            }

            const wasInferred = !!row.nameInferred
                || (row.name && compactName(row.name) !== compactName(material.label));
            if (wasInferred) {
                warnings.push('Name inferred from list order / neighbours');
            }

            const hasAny = tiers.some(value => Number(value) > 0);
            if (!hasAny) return;
            usedKeys.add(material.key);
            materials.push({
                key: material.key,
                inputId: material.inputId,
                label: material.label,
                kind: material.kind || 'basic',
                season: material.season != null ? material.season : 0,
                tiers: tiers,
                exactTiers: exactTiers,
                poorTotal: tiersToPoor(tiers),
                skipped: false,
                reason: '',
                warnings: warnings,
                inferred: wasInferred,
                sourceEngine: 'gemini'
            });
        });
        return materials;
    }

    async function parseSingleImageWithGemini(file, options) {
        const proxyUrl = getGeminiProxyUrl();
        const onProgress = options && options.onProgress;
        if (onProgress) {
            onProgress({
                phase: 'gemini',
                fileName: file && file.name,
                message: 'Reading screenshot with AI…'
            });
        }
        const form = new FormData();
        form.append('image', file, (file && file.name) || 'screenshot.jpg');
        let response;
        try {
            response = await fetch(proxyUrl + '/', {
                method: 'POST',
                body: form
            });
        } catch (err) {
            const error = new Error('Could not reach AI image service. Check your connection and try again.');
            error.code = 'network_error';
            throw error;
        }
        let payload = null;
        try {
            payload = await response.json();
        } catch (_) {
            payload = null;
        }
        if (response.status === 429) {
            const error = new Error(MSG_QUOTA_EXCEEDED);
            error.code = (payload && payload.error) || 'quota_exceeded';
            error.showBmc = true;
            throw error;
        }
        if (!response.ok) {
            const error = new Error(
                (payload && payload.message)
                    || ('AI image service error (' + response.status + ').')
            );
            error.code = (payload && payload.error) || 'gemini_error';
            throw error;
        }
        const materials = materialsFromGeminiResponse(payload);
        return {
            fileName: file && file.name ? file.name : 'screenshot',
            kind: 'gemini',
            materials: materials,
            debug: {
                engine: 'gemini',
                usedToday: payload && payload.usedToday != null ? payload.usedToday : null,
                dailyLimit: payload && payload.dailyLimit != null ? payload.dailyLimit : null,
                rawMaterials: payload && payload.materials ? payload.materials : []
            },
            rawText: JSON.stringify(payload && payload.materials ? payload.materials : [], null, 2)
        };
    }

    const ALLOWED_SCREENSHOT_FORMATS = 'PNG, JPG, WebP, GIF';

    function isScreenshotImageFile(file) {
        if (!file) return false;
        const type = String(file.type || '').toLowerCase();
        if (/^image\/(png|jpe?g|webp|gif)$/.test(type)) return true;
        // Some browsers leave type empty on drop — fall back to extension.
        if (type && type.indexOf('image/') === 0) return false;
        return /\.(png|jpe?g|webp|gif)$/i.test(file.name || '');
    }

    async function parseImages(files, options) {
        let list = Array.from(files || []).filter(isScreenshotImageFile);
        if (!list.length) {
            throw new Error('Only image files are allowed (' + ALLOWED_SCREENSHOT_FORMATS + ').');
        }
        if (list.length > MAX_SCREENSHOTS_PER_BATCH) {
            const error = new Error(MSG_BATCH_LIMIT);
            error.code = 'batch_limit';
            throw error;
        }
        const remaining = getClientRateRemaining();
        if (remaining <= 0) {
            const error = new Error(MSG_CLIENT_RATE_LIMIT);
            error.code = 'client_rate_limit';
            error.showBmc = true;
            throw error;
        }
        if (list.length > remaining) {
            const error = new Error(
                'Only ' + remaining + ' more screenshot' + (remaining === 1 ? '' : 's') +
                ' allowed in this 15-minute window.'
            );
            error.code = 'client_rate_limit';
            error.showBmc = true;
            throw error;
        }
        recordClientRateUsage(list.length);

        const onProgress = options && options.onProgress;
        const images = [];
        for (let i = 0; i < list.length; i++) {
            if (onProgress) {
                onProgress({
                    phase: 'gemini',
                    imageIndex: i,
                    imageCount: list.length,
                    fileName: list[i].name,
                    message: 'AI reading screenshot ' + (i + 1) + ' of ' + list.length + '…'
                });
            }
            images.push(await parseSingleImageWithGemini(list[i], options));
        }
        return {
            images,
            materials: mergeImageResults(images)
        };
    }

    function getSelectedScale() {
        const select = document.getElementById('scaleSelect');
        const scale = select ? parseFloat(select.value) : 1;
        return Number.isFinite(scale) && scale > 0 ? scale : 1;
    }

    function applyParsedMaterials(materials, options) {
        const scale = getSelectedScale();
        const preserveExisting = !!(options && options.preserveExisting);
        const applied = [];
        let filledGear = false;
        (materials || []).forEach(material => {
            if (!material || material.poorTotal == null) return;
            const input = document.getElementById(material.inputId || ('my-' + material.key));
            if (!input) return;
            const existingRaw = (input.value || '').replace(/,/g, '').trim();
            if (preserveExisting && existingRaw && material.inferred) {
                return;
            }
            input.value = formatScaledInput(material.poorTotal, scale);
            const parent = input.closest('.my-material');
            if (parent) parent.classList.add('active');
            if (input.closest('#advMaterials')) filledGear = true;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            applied.push(material);
        });
        if (filledGear) {
            if (typeof global.setGearMaterialsOpen === 'function') {
                global.setGearMaterialsOpen(true);
            } else {
                const section = document.getElementById('gearMaterialsSection');
                const toggle = document.getElementById('toggleAdvMaterials');
                const container = document.getElementById('advMaterials');
                if (container && toggle) {
                    container.style.display = 'block';
                    toggle.classList.add('open');
                    toggle.setAttribute('aria-expanded', 'true');
                    if (section) section.classList.add('is-open');
                }
            }
            if (typeof global.updateGearMaterialSummary === 'function') {
                global.updateGearMaterialSummary({ openIfFilled: true });
            }
        }
        return applied;
    }

    function applyToBasicInputs(materials, options) {
        return applyParsedMaterials(materials, options);
    }

    function readClientRateTimestamps() {
        try {
            const raw = localStorage.getItem(CLIENT_RATE_STORAGE_KEY);
            const list = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(list)) return [];
            const cutoff = Date.now() - CLIENT_RATE_WINDOW_MS;
            return list.map(Number).filter(function (ts) {
                return Number.isFinite(ts) && ts >= cutoff;
            });
        } catch (_) {
            return [];
        }
    }

    function writeClientRateTimestamps(list) {
        try {
            localStorage.setItem(CLIENT_RATE_STORAGE_KEY, JSON.stringify(list));
        } catch (_) {
            /* ignore quota / private mode */
        }
    }

    function getClientRateRemaining() {
        return Math.max(0, CLIENT_RATE_MAX_IMAGES - readClientRateTimestamps().length);
    }

    function recordClientRateUsage(count) {
        const n = Math.max(0, Number(count) || 0);
        if (!n) return;
        const now = Date.now();
        const next = readClientRateTimestamps();
        for (let i = 0; i < n; i++) next.push(now);
        writeClientRateTimestamps(next);
    }

    function setStatus(element, message, kind, options) {
        if (!element) return;
        element.hidden = !message;
        element.classList.remove('is-error', 'is-ok', 'is-busy');
        if (kind) element.classList.add(kind);
        element.textContent = '';
        if (!message) return;
        element.appendChild(document.createTextNode(message));
        if (options && options.showBmc) {
            element.appendChild(document.createTextNode(' '));
            const link = document.createElement('a');
            link.href = BMC_URL;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'bmc-link';
            link.textContent = 'Buy me a coffee';
            element.appendChild(link);
            element.appendChild(document.createTextNode(' ' + MSG_BMC_TAIL));
        }
    }

    function appendThumbs(container, files) {
        if (!container) return;
        Array.from(files || []).forEach(file => {
            const img = document.createElement('img');
            img.alt = file.name || 'Screenshot';
            img.src = URL.createObjectURL(file);
            container.appendChild(img);
        });
    }

    function bindCalculatorUi() {
        const root = document.getElementById('screenshotImport');
        if (!root) return;
        const fileInput = document.getElementById('screenshotFiles');
        const dropZone = document.getElementById('screenshotDropZone') || document.getElementById('screenshotPickBtn');
        const statusEl = document.getElementById('screenshotStatus');
        const thumbsEl = document.getElementById('screenshotThumbs');
        if (!fileInput || !dropZone) return;
        const session = { byKey: {} };

        async function handleFiles(fileList) {
            const incoming = Array.from(fileList || []);
            let files = incoming.filter(isScreenshotImageFile);
            if (!files.length) {
                if (incoming.length) {
                    setStatus(
                        statusEl,
                        'Only image files are allowed (' + ALLOWED_SCREENSHOT_FORMATS + ').',
                        'is-error'
                    );
                }
                return;
            }

            let notice = '';
            if (files.length < incoming.length) {
                notice = 'Skipped non-image files. Allowed formats: ' + ALLOWED_SCREENSHOT_FORMATS + '.';
            }
            if (files.length > MAX_SCREENSHOTS_PER_BATCH) {
                files = files.slice(0, MAX_SCREENSHOTS_PER_BATCH);
                notice = notice
                    ? notice + ' ' + MSG_BATCH_LIMIT + ' Using the first 4.'
                    : MSG_BATCH_LIMIT + ' Using the first 4.';
            }

            const remaining = getClientRateRemaining();
            if (remaining <= 0) {
                setStatus(statusEl, MSG_CLIENT_RATE_LIMIT, 'is-error', { showBmc: true });
                return;
            }
            if (files.length > remaining) {
                files = files.slice(0, remaining);
                notice = notice
                    ? notice + ' Only ' + remaining + ' more in this 15-minute window.'
                    : 'Only ' + remaining + ' more screenshot' + (remaining === 1 ? '' : 's') +
                        ' in this 15-minute window.';
            }

            dropZone.classList.add('is-busy');
            if (dropZone.disabled != null) dropZone.disabled = true;
            appendThumbs(thumbsEl, files);
            setStatus(statusEl, notice || 'Reading screenshot with AI…', 'is-busy');
            try {
                const result = await parseImages(files, {
                    onProgress: function (info) {
                        setStatus(statusEl, info.message, 'is-busy');
                    }
                });
                mergeIntoMaterialMap(session.byKey, result.materials);
                const mergedList = Object.keys(session.byKey).map(function (key) { return session.byKey[key]; });
                const applied = applyParsedMaterials(mergedList);
                const totalFilled = mergedList.length;
                const exactHits = mergedList.filter(function (item) {
                    return (item.exactTiers || []).some(Boolean);
                }).length;
                const gearCount = applied.filter(function (item) {
                    const el = document.getElementById(item.inputId || ('my-' + item.key));
                    return el && el.closest('#advMaterials');
                }).length;
                const basicCount = applied.length - gearCount;
                if (!applied.length && !totalFilled) {
                    setStatus(statusEl, 'No materials were recognised. Try a clearer Materials screenshot.', 'is-error');
                    return;
                }
                const exactNote = exactHits
                    ? ' Used exact Available for ' + exactHits + ' stack' + (exactHits === 1 ? '' : 's') + '.'
                    : '';
                const kindNote = gearCount && basicCount
                    ? ' (basic ' + basicCount + ', gear ' + gearCount + ')'
                    : (gearCount ? ' (gear materials)' : '');
                setStatus(
                    statusEl,
                    'Filled ' + applied.length + ' input' + (applied.length === 1 ? '' : 's') + kindNote +
                    '. ' + totalFilled + ' materials in total.' + exactNote +
                    ' Add another screenshot for the rest, or edit the values below.',
                    'is-ok'
                );
            } catch (error) {
                console.error(error);
                setStatus(
                    statusEl,
                    error && error.message ? error.message : 'Could not read the screenshots.',
                    'is-error',
                    { showBmc: !!(error && error.showBmc) }
                );
            } finally {
                dropZone.classList.remove('is-busy');
                if (dropZone.disabled != null) dropZone.disabled = false;
            }
        }

        dropZone.addEventListener('click', function (event) {
            if (dropZone.tagName === 'BUTTON') {
                event.preventDefault();
                fileInput.click();
            }
        });
        dropZone.addEventListener('dragover', function (event) {
            event.preventDefault();
            dropZone.classList.add('is-drag');
        });
        dropZone.addEventListener('dragleave', function () {
            dropZone.classList.remove('is-drag');
        });
        dropZone.addEventListener('drop', function (event) {
            event.preventDefault();
            dropZone.classList.remove('is-drag');
            handleFiles(event.dataTransfer && event.dataTransfer.files);
        });

        fileInput.addEventListener('change', function () {
            const files = Array.from(fileInput.files || []);
            fileInput.value = '';
            handleFiles(files);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindCalculatorUi);
    } else {
        bindCalculatorUi();
    }

    global.ScreenshotParse = {
        parseImages,
        parseSingleImageWithGemini,
        applyToBasicInputs,
        mergeIntoMaterialMap,
        tiersToPoor,
        parseGameAmount,
        formatAmount,
        formatScaledInput,
        getBasicMaterialCatalog,
        getGearMaterialCatalog,
        applyParsedMaterials,
        formatSeasonLabel,
        getGeminiProxyUrl,
        TIER_NAMES,
        TIER_MULTIPLIERS
    };
})(typeof window !== 'undefined' ? window : this);
