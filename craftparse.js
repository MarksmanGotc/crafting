let initialMaterials = {};
const urlParams = new URLSearchParams(window.location.search);
const isDebugMode = urlParams.has('debug') && urlParams.get('debug') === 'true';

const LEVELS = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45];
const normalizeKey = (str = '') =>
    (str || '')
        .toString()
        .toLowerCase()
        .replace(/["'`]/g, '')
        .replace(/\s+/g, '-');
const allMaterials = Object.values(materials).reduce((acc, season) => {
    return { ...acc, ...season.mats };
}, {});
const materialKeyMap = {};
const materialToSeason = {};
Object.values(materials).forEach(season => {
    Object.keys(season.mats).forEach(mat => {
        const normalized = normalizeKey(mat);
        materialKeyMap[normalized] = mat;
        materialToSeason[mat] = season.season;
        materialToSeason[normalized] = season.season;
    });
});
const normalizedKeyCache = new WeakMap();

function getNormalizedKeyMap(source) {
    if (!source || typeof source !== 'object') {
        return {};
    }
    let cached = normalizedKeyCache.get(source);
    if (!cached) {
        cached = {};
        Object.keys(source).forEach(key => {
            cached[normalizeKey(key)] = key;
        });
        normalizedKeyCache.set(source, cached);
    }
    return cached;
}
let qualityMultipliers = {};
const WARLORD_PENALTY = 3;
const BASE_MOST_WEIGHT = 12;
const BASE_SECOND_WEIGHT = 6;
const GEAR_MOST_WEIGHT = 6;
const GEAR_SECOND_WEIGHT = 3;
const GEAR_BASELINE_BONUS = BASE_MOST_WEIGHT;
const LEFTOVER_WEIGHT_BASE = 7;
const LEFTOVER_WEIGHT_GEAR = 3;
const BALANCE_WEIGHT = 0.1;
const CTW_SET_NAME_FALLBACK = 'Ceremonial Targaryen Warlord';
const ctwSetName =
    typeof window !== 'undefined' && window.CTW_SET_NAME
        ? window.CTW_SET_NAME
        : CTW_SET_NAME_FALLBACK;

const SeasonZeroPreference = Object.freeze({
    OFF: 0,
    LOW: 1,
    NORMAL: 2,
    HIGH: 3
});
const seasonZeroValueText = {
    [SeasonZeroPreference.OFF]: 'Off - exclude Season 0 items',
    [SeasonZeroPreference.LOW]: 'Low weighting',
    [SeasonZeroPreference.NORMAL]: 'Normal weighting',
    [SeasonZeroPreference.HIGH]: 'High weighting'
};
const SEASON_ZERO_SCORE_DEFAULT = Object.freeze({ seasonZero: 0, nonSeason: 0 });
const SEASON_ZERO_SCORE_ADJUSTMENTS = Object.freeze({
    // Non-season adjustments remain at zero so that the slider only influences Season 0 items.
    [SeasonZeroPreference.LOW]: Object.freeze({ seasonZero: 100, nonSeason: 0 }),
    // Normal weighting sits roughly halfway between the low and high configurations
    // to provide a smoother progression without overwhelming the default results.
    [SeasonZeroPreference.NORMAL]: Object.freeze({ seasonZero: 700, nonSeason: 0 }),
    [SeasonZeroPreference.HIGH]: Object.freeze({ seasonZero: 1400, nonSeason: 0 })
});
let currentSeasonZeroPreference = SeasonZeroPreference.NORMAL;
const qualityColorMap = {
    poor: '#A9A9A9',
    common: '#32CD32',
    fine: '#0070DD',
    exquisite: '#A335EE',
    epic: '#FF8000',
    legendary: '#E5CC80'
};
let qualitySelectHandlersAttached = false;
let failedLevels = [];
let requestedTemplates = {};
let remainingUse = {};
let ctwMediumNotice = false;
let level20OnlyWarlordsActive = false;
const productsByLevel = craftItem.products.reduce((acc, product) => {
    const levelKey = product.level.toString();
    if (!acc[levelKey]) {
        acc[levelKey] = [];
    }
    acc[levelKey].push(product);
    return acc;
}, {});
const productLookup = new Map();
craftItem.products.forEach(product => {
    productLookup.set(getProductLookupKey(product), product);
});

function slug(str) {
    return (str || '')
        .toString()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/['"`]/g, '')
        .replace(/[^a-z0-9-]/g, '');
}

function formatTimestamp(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return (
        date.getFullYear().toString() +
        pad(date.getMonth() + 1) +
        pad(date.getDate()) +
        pad(date.getHours()) +
        pad(date.getMinutes())
    );
}

function waitForNextFrame() {
    return new Promise(resolve => {
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => resolve());
        } else {
            setTimeout(resolve, 0);
        }
    });
}

function isLocalStorageAvailable() {
    try {
        if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
            return false;
        }
        const testKey = '__noox_update_log__';
        window.localStorage.setItem(testKey, testKey);
        window.localStorage.removeItem(testKey);
        return true;
    } catch (error) {
        return false;
    }
}

function initializeUpdateLog() {
    const overlay = document.getElementById('updateLogOverlay');
    const trigger = document.getElementById('openUpdateLog');

    if (!overlay || !trigger) {
        return;
    }

    const closeButton = overlay.querySelector('.close-popup');
    const storageKey = 'noox-update-log-2024-05-14';
    const storageSupported = isLocalStorageAvailable();
    const hasSeenUpdate = storageSupported ? window.localStorage.getItem(storageKey) === 'seen' : false;

    const markSeen = () => {
        if (storageSupported) {
            try {
                window.localStorage.setItem(storageKey, 'seen');
            } catch (error) {
                // Ignore storage failures silently
            }
        }
    };

    const setExpandedState = (expanded) => {
        trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    };

    const openOverlay = () => {
        overlay.style.display = 'flex';
        overlay.setAttribute('aria-hidden', 'false');
        setExpandedState(true);
    };

    const closeOverlay = (shouldMarkSeen = false) => {
        overlay.style.display = 'none';
        overlay.setAttribute('aria-hidden', 'true');
        setExpandedState(false);
        if (shouldMarkSeen) {
            markSeen();
        }
    };

    if (!hasSeenUpdate) {
        openOverlay();
    }

    trigger.addEventListener('click', () => {
        if (overlay.style.display === 'flex') {
            closeOverlay(true);
        } else {
            openOverlay();
        }
    });

    closeButton?.addEventListener('click', () => closeOverlay(true));

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closeOverlay(true);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && overlay.style.display === 'flex') {
            closeOverlay(true);
        }
    });
}

const calculationProgressState = {
    total: 0,
    processed: 0
};

function resetCalculationProgress(total) {
    calculationProgressState.total = total;
    calculationProgressState.processed = 0;
    updateCalculationProgress(0, total);
}

function updateCalculationProgress(processed, totalOverride = calculationProgressState.total) {
    calculationProgressState.processed = Math.min(processed, totalOverride);
    const container = document.querySelector('.spinner-progress');
    const track = document.querySelector('.spinner-progress__track');
    const bar = document.querySelector('.spinner-progress__bar');
    const label = document.querySelector('.spinner-progress__label');
    const total = Math.max(totalOverride, 0);

    if (!track || !bar || !label) {
        return;
    }

    const hasTotal = total > 0;
    const ratio = hasTotal ? Math.min(1, processed / total) : 0;
    const percent = Math.round(ratio * 100);

    bar.style.transform = `scaleX(${ratio})`;
    track.setAttribute('aria-valuenow', hasTotal ? percent : 0);
    track.setAttribute('aria-valuemin', 0);
    track.setAttribute('aria-valuemax', 100);
    if (container) {
        container.classList.toggle('is-active', hasTotal);
    }
    label.textContent = hasTotal ? `Calculating templates… ${percent}%` : 'Preparing templates…';
}

function completeCalculationProgress() {
    updateCalculationProgress(calculationProgressState.total, calculationProgressState.total);
}

function clearCalculationProgress() {
    calculationProgressState.total = 0;
    calculationProgressState.processed = 0;
    const container = document.querySelector('.spinner-progress');
    const track = document.querySelector('.spinner-progress__track');
    const bar = document.querySelector('.spinner-progress__bar');
    const label = document.querySelector('.spinner-progress__label');
    if (container) {
        container.classList.remove('is-active');
    }
    if (bar) {
        bar.style.transform = 'scaleX(0)';
    }
    if (track) {
        track.setAttribute('aria-valuenow', 0);
    }
    if (label) {
        label.textContent = 'Preparing templates…';
    }
}

function createProgressTracker(total) {
    resetCalculationProgress(total);
    const chunkSize = Math.max(1, Math.floor(Math.max(total, 100) / 25));
    let processed = 0;

    const tick = async (increment = 1) => {
        processed += increment;
        updateCalculationProgress(processed, total);
        if (processed % chunkSize === 0) {
            await waitForNextFrame();
        }
    };

    const complete = () => {
        processed = total;
        completeCalculationProgress();
    };

    return { tick, complete };
}

function getProductLookupKey(product) {
    return [
        product.level,
        product.season,
        slug(product.name),
        slug(product.setName || 'no-set')
    ].join('|');
}

function closeAllQualitySelects() {
    document.querySelectorAll('.quality-select.open').forEach(wrapper => {
        wrapper.classList.remove('open');
        const trigger = wrapper.querySelector('.quality-select__display');
        if (trigger) {
            trigger.setAttribute('aria-expanded', 'false');
        }
    });
}

function updateQualitySelectUI(select, trigger, optionsContainer) {
    if (!select || !trigger || !optionsContainer) return;

    const labelEl = trigger.querySelector('.quality-select__label');
    const swatchEl = trigger.querySelector('.quality-select__swatch');
    const selectedOption = Array.from(select.options).find(opt => opt.value === select.value) || select.options[0];

    if (labelEl && selectedOption) {
        labelEl.textContent = selectedOption.textContent;
    }

    trigger.dataset.qualityValue = select.value || '';

    if (swatchEl) {
        const color = qualityColorMap[select.value];
        if (color) {
            swatchEl.style.backgroundColor = color;
            swatchEl.classList.remove('quality-select__swatch--empty');
        } else {
            swatchEl.style.removeProperty('background-color');
            swatchEl.classList.add('quality-select__swatch--empty');
        }
    }

    optionsContainer.querySelectorAll('.quality-select__option').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.value === select.value);
    });
}

function initializeQualitySelects() {
    const selects = Array.from(document.querySelectorAll('select.temps'))
        .filter(select => /^temp\d+$/.test(select.id || ''));

    selects.forEach(select => {
        if (select.dataset.customSelect === 'true') return;

        select.dataset.customSelect = 'true';

        const wrapper = document.createElement('div');
        wrapper.className = 'quality-select';
        wrapper.dataset.selectId = select.id || '';

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'quality-select__display';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-label', 'Select template quality');
        trigger.dataset.qualityTrigger = select.id || '';

        const swatch = document.createElement('span');
        swatch.className = 'quality-select__swatch quality-select__swatch--empty';
        const label = document.createElement('span');
        label.className = 'quality-select__label';
        const chevron = document.createElement('span');
        chevron.className = 'quality-select__chevron';
        trigger.append(swatch, label, chevron);

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'quality-select__options';
        optionsContainer.setAttribute('role', 'listbox');

        Array.from(select.options).forEach(option => {
            const optionButton = document.createElement('button');
            optionButton.type = 'button';
            optionButton.className = 'quality-select__option';
            optionButton.dataset.value = option.value;
            optionButton.setAttribute('role', 'option');
            optionButton.setAttribute('data-quality', option.value);

            const optionSwatch = document.createElement('span');
            optionSwatch.className = 'quality-select__swatch';
            if (qualityColorMap[option.value]) {
                optionSwatch.style.backgroundColor = qualityColorMap[option.value];
            } else {
                optionSwatch.classList.add('quality-select__swatch--empty');
            }

            const optionLabel = document.createElement('span');
            optionLabel.className = 'quality-select__option-label';
            optionLabel.textContent = option.textContent;

            optionButton.append(optionSwatch, optionLabel);
            if (option.selected) {
                optionButton.classList.add('selected');
            }

            optionsContainer.appendChild(optionButton);
        });

        const parent = select.parentNode;
        parent.insertBefore(wrapper, select);
        wrapper.append(trigger, optionsContainer, select);

        select.classList.add('quality-select__native');
        updateQualitySelectUI(select, trigger, optionsContainer);

        trigger.addEventListener('click', event => {
            event.preventDefault();
            const isOpen = wrapper.classList.contains('open');
            closeAllQualitySelects();
            wrapper.classList.toggle('open', !isOpen);
            trigger.setAttribute('aria-expanded', (!isOpen).toString());
            if (!isOpen) {
                const selectedBtn = optionsContainer.querySelector('.quality-select__option.selected');
                (selectedBtn || optionsContainer.querySelector('.quality-select__option'))?.focus();
            }
        });

        trigger.addEventListener('keydown', event => {
            if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
                event.preventDefault();
                const isOpen = wrapper.classList.contains('open');
                if (!isOpen) {
                    closeAllQualitySelects();
                    wrapper.classList.add('open');
                    trigger.setAttribute('aria-expanded', 'true');
                }
                const options = Array.from(optionsContainer.querySelectorAll('.quality-select__option'));
                if (!options.length) return;
                if (event.key === 'ArrowUp') {
                    (optionsContainer.querySelector('.quality-select__option.selected') || options[options.length - 1])?.focus();
                } else {
                    (optionsContainer.querySelector('.quality-select__option.selected') || options[0])?.focus();
                }
            }
        });

        optionsContainer.addEventListener('click', event => {
            const optionButton = event.target.closest('.quality-select__option');
            if (!optionButton) return;
            event.preventDefault();
            const { value } = optionButton.dataset;
            if (value && select.value !== value) {
                select.value = value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                updateQualitySelectUI(select, trigger, optionsContainer);
            }
            wrapper.classList.remove('open');
            trigger.setAttribute('aria-expanded', 'false');
            trigger.focus();
        });

        optionsContainer.addEventListener('keydown', event => {
            const optionButton = event.target.closest('.quality-select__option');
            if (!optionButton) return;

            const options = Array.from(optionsContainer.querySelectorAll('.quality-select__option'));
            const currentIndex = options.indexOf(optionButton);

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                const next = options[currentIndex + 1] || options[0];
                next.focus();
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                const prev = options[currentIndex - 1] || options[options.length - 1];
                prev.focus();
            } else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                optionButton.click();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                wrapper.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');
                trigger.focus();
            }
        });

        select.addEventListener('change', () => {
            updateQualitySelectUI(select, trigger, optionsContainer);
        });
    });

    if (!qualitySelectHandlersAttached) {
        document.addEventListener('click', event => {
            if (!event.target.closest('.quality-select')) {
                closeAllQualitySelects();
            }
        });

        qualitySelectHandlersAttached = true;
    }
}

function getSeasonZeroPreference() {
    return currentSeasonZeroPreference;
}

function getSeasonZeroScoreAdjustments(preference) {
    return SEASON_ZERO_SCORE_ADJUSTMENTS[preference] || SEASON_ZERO_SCORE_DEFAULT;
}

function updateSeasonZeroSliderLabel(value) {
    const sliderEl = document.getElementById('seasonZeroPriority');
    if (!sliderEl) return;
    const normalized = Number.isInteger(value) ? value : SeasonZeroPreference.NORMAL;
    const valueText = seasonZeroValueText[normalized] || seasonZeroValueText[SeasonZeroPreference.NORMAL];
    sliderEl.setAttribute('aria-valuetext', valueText);
}

function initializeSeasonZeroSlider() {
    const slider = document.getElementById('seasonZeroPriority');
    if (!slider) return;

    const initialValue = parseInt(slider.value, 10);
    const safeValue = Number.isNaN(initialValue) ? SeasonZeroPreference.NORMAL : initialValue;
    currentSeasonZeroPreference = safeValue;
    slider.value = safeValue;
    updateSeasonZeroSliderLabel(safeValue);

    const handleChange = (event) => {
        const value = parseInt(event.target.value, 10);
        if (Number.isNaN(value)) {
            return;
        }
        currentSeasonZeroPreference = value;
        updateSeasonZeroSliderLabel(value);
    };

    slider.addEventListener('input', handleChange);
    slider.addEventListener('change', handleChange);
}

function applySeasonZeroPreference(products, preference) {
    if (!Array.isArray(products)) return [];
    if (preference === SeasonZeroPreference.OFF) {
        return products.filter(product => product.season !== 0);
    }
    return products;
}

document.addEventListener('DOMContentLoaded', function() {
    initializeUpdateLog();
    createLevelStructure();
    addCalculateButton();
        formatedInputNumber();
        inputActive();
        initAdvMaterialSection();
        initializeQualitySelects();
        initializeSeasonZeroSlider();

    const shareParam = urlParams.get('share');
    if (shareParam) {
        try {
            const data = JSON.parse(atob(shareParam));
            initialMaterials = data.initialMaterials || {};
            populateInputsFromShare(data);
            // Show loading overlay before automatic calculation
            document.querySelector('.spinner-wrap').classList.add('active');
            // Automatically trigger calculation based on the populated inputs
            calculateMaterials();
        } catch (e) {
            console.error('Invalid share data');
        }
    }
	
    // Kun footerin sisällä olevaa SVG:tä painetaan
    document.querySelectorAll('footer svg, #openGiftFromHeader').forEach(element => {
		element.addEventListener('click', function() {
			const pageDivs = document.querySelectorAll('.wrapper > div');
			const giftDiv = document.querySelector('.wrapper .gift');

			pageDivs.forEach(div => {
				div.style.display = 'none';
			});
			giftDiv.style.display = 'flex';
			gtag('event', 'donate_click', {
				'event_label_gift': 'Open domnate views'
			});
		});
	});

    document.querySelector('.gift button').addEventListener('click', function() {
        const pageDivs = document.querySelectorAll('.wrapper > div');
        const wrapperDiv = document.querySelector('#generatebychoice');

        pageDivs.forEach(div => {
            div.style.display = 'none';
        });

        wrapperDiv.style.display = 'block';
    });

    const ctwBtn = document.getElementById('ctwInfoBtn');
    const ctwPopup = document.getElementById('ctwInfoPopup');
    ctwBtn?.addEventListener('click', () => {
        if (ctwPopup) {
            ctwPopup.style.display = 'flex';
        }
    });
    ctwPopup?.addEventListener('click', (e) => {
        if (e.target === ctwPopup || e.target.closest('.close-popup')) {
            ctwPopup.style.display = 'none';
        }
    });

    const oddsBtn = document.getElementById('oddsInfoBtn');
    const oddsPopup = document.getElementById('oddsInfoPopup');
    oddsBtn?.addEventListener('click', () => {
        if (oddsPopup) {
            oddsPopup.style.display = 'flex';
        }
    });
    oddsPopup?.addEventListener('click', (e) => {
        if (e.target === oddsPopup || e.target.closest('.close-popup')) {
            oddsPopup.style.display = 'none';
        }
    });

    const gearBtn = document.getElementById('gearLevelsInfoBtn');
    const gearPopup = document.getElementById('gearLevelsInfoPopup');
    gearBtn?.addEventListener('click', () => {
        if (gearPopup) {
            gearPopup.style.display = 'flex';
        }
    });
    gearPopup?.addEventListener('click', (e) => {
        if (e.target === gearPopup || e.target.closest('.close-popup')) {
            gearPopup.style.display = 'none';
        }
    });

    const seasonZeroBtn = document.getElementById('seasonZeroInfoBtn');
    const seasonZeroPopup = document.getElementById('seasonZeroInfoPopup');
    seasonZeroBtn?.addEventListener('click', () => {
        if (seasonZeroPopup) {
            seasonZeroPopup.style.display = 'flex';
        }
    });
    seasonZeroPopup?.addEventListener('click', (e) => {
        if (e.target === seasonZeroPopup || e.target.closest('.close-popup')) {
            seasonZeroPopup.style.display = 'none';
        }
    });

    const materialsInfoBtn = document.getElementById('yourMaterialsInfoBtn');
    const materialsInfoPopup = document.getElementById('yourMaterialsInfoPopup');
    materialsInfoBtn?.addEventListener('click', () => {
        if (materialsInfoPopup) {
            materialsInfoPopup.style.display = 'flex';
        }
    });
    materialsInfoPopup?.addEventListener('click', (e) => {
        if (e.target === materialsInfoPopup || e.target.closest('.close-popup')) {
            materialsInfoPopup.style.display = 'none';
        }
    });

    const scaleBtn = document.getElementById('scaleInfoBtn');
    const scalePopup = document.getElementById('scaleInfoPopup');
    scaleBtn?.addEventListener('click', () => {
        if (scalePopup) {
            scalePopup.style.display = 'flex';
        }
    });
    scalePopup?.addEventListener('click', (e) => {
        if (e.target === scalePopup || e.target.closest('.close-popup')) {
            scalePopup.style.display = 'none';
        }
    });

    const templatesBtn = document.getElementById('templatesInfoBtn');
    const templatesPopup = document.getElementById('templatesInfoPopup');
    templatesBtn?.addEventListener('click', () => {
        if (templatesPopup) {
            templatesPopup.style.display = 'flex';
        }
    });
    templatesPopup?.addEventListener('click', (e) => {
        if (e.target === templatesPopup || e.target.closest('.close-popup')) {
            templatesPopup.style.display = 'none';
        }
    });

    // Trigger calculation when pressing Enter on any input
    document.addEventListener('keydown', e => {
        const activeEl = document.activeElement;
        const tag = activeEl ? activeEl.tagName : '';
        const isQualityTrigger = activeEl?.classList?.contains('quality-select__display');
        if (e.key === 'Enter' && (['INPUT', 'SELECT'].includes(tag) || isQualityTrigger) &&
            document.getElementById('results').style.display === 'none') {
            const manualVisible = document.getElementById('manualInput').style.display !== 'none';
            const choiceVisible = document.getElementById('generatebychoice').style.display !== 'none';
            if (choiceVisible) {
                calculateWithPreferences();
            } else if (manualVisible) {
                calculateMaterials();
            }
        }

        if (e.key === 'Escape') {
            if (document.getElementById('results').style.display === 'block') {
                closeResults();
            }
            document.querySelectorAll('.info-overlay').forEach(overlay => {
                if (overlay.style.display !== 'none') {
                    overlay.style.display = 'none';
                }
            });
            closeAllQualitySelects();
        }
    });

    // Custom tab order for template amount inputs and quality selects
    const templateInputs = LEVELS.map(l => document.getElementById(`templateAmount${l}`)).filter(Boolean);
    const templateSelects = LEVELS.map(l => document.getElementById(`temp${l}`)).filter(Boolean);
    const qualityTriggers = templateSelects
        .map(select => select.closest('.quality-select')?.querySelector('.quality-select__display'))
        .filter(Boolean);

    templateInputs.forEach((input, idx) => {
        input.addEventListener('keydown', e => {
            if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                const next = templateInputs[idx + 1];
                if (next) {
                    next.focus();
                } else if (qualityTriggers[0]) {
                    qualityTriggers[0].focus();
                }
            }
        });
    });

    qualityTriggers.forEach((trigger, idx) => {
        trigger.addEventListener('keydown', e => {
            if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                const next = qualityTriggers[idx + 1];
                if (next) {
                    next.focus();
                } else {
                    const firstMat = document.querySelector('.my-material input[type="text"]');
                    if (firstMat) firstMat.focus();
                }
            }
        });
    });

});

function formatPlaceholderWithCommas(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatedInputNumber(){
        document.addEventListener('input', function(e) {
            if (e.target.classList.contains('numeric-input')) {
                let inputValue = e.target.value;

                // Salli numerot, pilkut ja pisteet desimaaleille
                let numericValue = inputValue.replace(/[^0-9.,]/g, '');

                // Erottele desimaaliosa, jos sellainen on
                let parts = numericValue.split('.');
                let integerPart = parts[0].replace(/,/g, '');
                integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

                e.target.value = parts.length > 1 ? `${integerPart}.${parts[1]}` : integerPart;
            }
        });

}

function getQualityMultiplier(levelName) {
    const order = ['poor', 'common', 'fine', 'exquisite', 'epic', 'legendary'];
    const idx = order.indexOf(levelName.toLowerCase());
    return Math.pow(4, idx >= 0 ? idx : 0);
}


function setTemplateValues(templates) {
    // Tyhjennä ensin kaikki aikaisemmat valinnat
    document.querySelectorAll('#manualInput input[type="number"]').forEach(input => {
        input.value = ''; // Nollaa kaikki input-kentät
    });

    // Aseta sitten uudet arvot
    Object.entries(templates).forEach(([level, items]) => {
        Object.entries(items).forEach(([itemName, amount]) => {
            const slugName = slug(itemName);
            const inputElement = document.querySelector(`input[name^="${slugName}_"]`);
            if (inputElement) {
                inputElement.value = amount;
            }
        });
    });
}

function populateInputsFromShare(data) {
    // Fill material amounts
    if (data.initialMaterials) {
        Object.entries(data.initialMaterials).forEach(([name, amt]) => {
            const input = document.getElementById(`my-${slug(name)}`);
            if (input) {
                input.value = formatPlaceholderWithCommas(amt);
                const parent = input.closest('.my-material');
                if (parent) parent.classList.add('active');
            }
        });
    }

    if (data.templates) {
        const qualityMap = {
            1: 'poor',
            4: 'common',
            16: 'fine',
            64: 'exquisite',
            256: 'epic',
            1024: 'legendary'
        };

        Object.entries(data.templates).forEach(([level, items]) => {
            let total = 0;
            let quality = null;
            items.forEach(item => {
                const selector = `#level-${level}-items input[name="${slug(item.name)}_${item.season}_${slug(item.setName || 'no-set')}"]`;
                const el = document.querySelector(selector);
                if (el) {
                    el.value = item.amount;
                }
                total += item.amount;
                if (!quality && item.multiplier) {
                    quality = qualityMap[item.multiplier];
                }
            });
            if (total > 0) {
                const amountInput = document.getElementById(`templateAmount${level}`);
                if (amountInput) {
                    amountInput.value = total;
                    const wrap = document.querySelector(`.leveltmp${level} .templateAmountWrap`);
                    if (wrap) wrap.classList.add('active');
                }
            }
            if (quality) {
                const sel = document.getElementById(`temp${level}`);
                if (sel) {
                    sel.value = quality;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });

        // Estimate gear levels
        const gearLevels = [];
        Object.entries(data.templates).forEach(([lvl, items]) => {
            const levelNum = parseInt(lvl, 10);
            if (levelNum !== 1 && items.some(it => it.season !== 0 || it.warlord)) {
                gearLevels.push(levelNum);
            }
        });

        const select = document.getElementById('gearMaterialLevels');
        const dropdown = document.querySelector('#advMaterials .level-dropdown');
        if (select && dropdown) {
            Array.from(select.options).forEach(opt => {
                const isSel = gearLevels.includes(parseInt(opt.value, 10));
                opt.selected = isSel;
                const divOpt = dropdown.querySelector(`div[data-value="${opt.value}"]`);
                if (divOpt) divOpt.classList.toggle('selected', isSel);
            });
        }
    }
    if (history.replaceState) {
        const url = new URL(window.location);
        url.searchParams.delete('share');
        history.replaceState({}, '', url.pathname + url.search);
    }
}

// Oletetaan, että addCalculateButton-funktio on jo määritelty ja se lisää sekä Laske että Generoi 480 -napit
function addCalculateButton() {
    const manualInputDiv = document.getElementById('manualInput');
	const generatebychoice = document.getElementById('generatebychoice');
    
    const calculateBtn = document.createElement('button');
    calculateBtn.textContent = 'Calculate';
	calculateBtn.classList.add('calculate-button'); 
    calculateBtn.addEventListener('click', calculateMaterials);
    manualInputDiv.appendChild(calculateBtn);
}

// Funktio tulosten näyttämiseen (modifioi tämä toimimaan haluamallasi tavalla)
function showResults() {
        document.getElementById('results').style.display = 'block';
        document.getElementById('generatebychoice').style.display = 'none';
        window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });

    document.querySelector('.spinner-wrap').classList.remove('active');
    clearCalculationProgress();

}

function closeResults() {
	const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = ''; // Tyhjennä aiemmat tulokset
	document.getElementById('results').style.display = 'none';
	document.getElementById('generatebychoice').style.display = 'block';
	initialMaterials = {}; // Reset materials to allow fresh input values
}

function createCloseButton(parentElement) {
    const closeButton = document.createElement('button');
    closeButton.id = 'closeResults';
    closeButton.onclick = closeResults;
    closeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M345 137c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-119 119L73 103c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l119 119L39 375c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l119-119L311 409c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-119-119L345 137z"/></svg>`;
    parentElement.appendChild(closeButton);
}


function createLevelStructure() {
    const manualInputDiv = document.getElementById('manualInput');
    //manualInputDiv.style.display = 'block'; // Aseta näkyväksi

    LEVELS.forEach(level => {
        const levelHeader = document.createElement('h3');
        levelHeader.textContent = `Level ${level}`;
        levelHeader.style.cursor = 'pointer'; // Osoittaa, että elementtiä voi klikata
        manualInputDiv.appendChild(levelHeader);

        const itemsDiv = document.createElement('div');
        itemsDiv.id = `level-${level}-items`;
        // Aseta Level 1 näkyväksi ja muut piiloon
        if (level === 1) {
            itemsDiv.style.display = 'block'; // Aseta Level 1 itemit näkyviksi
        } else {
            itemsDiv.style.display = 'none'; // Muut tasot piiloon oletuksena
        }
        manualInputDiv.appendChild(itemsDiv);

        // Togglea itemsDivin näkyvyyttä klikattaessa
        levelHeader.addEventListener('click', () => {
            itemsDiv.style.display = itemsDiv.style.display === 'none' ? 'block' : 'none';
        });

        // Lisää kunkin tason itemit niiden containeriin
        const levelProducts = productsByLevel[level] || [];
        levelProducts.forEach(product => {
            const productDiv = document.createElement('div');
            const label = document.createElement('label');
            if (product.season === 0) {
                label.textContent = product.name;
            } else {
                label.textContent = `${product.name} - ${product.setName} (S${product.season})`;
            }
            const input = document.createElement('input');
            input.type = 'number';
            const nameSlug = slug(product.name);
            const setSlug = slug(product.setName || 'no-set');
            input.name = `${nameSlug}_${product.season}_${setSlug}`;
            input.dataset.productKey = getProductLookupKey(product);
            input.placeholder = 'amount';

            productDiv.appendChild(label);
            productDiv.appendChild(input);
            itemsDiv.appendChild(productDiv);
        });
    });
}

function calculateMaterials() {
	
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = ''; // Tyhjennä aiemmat tulokset

    const materialsDiv = document.createElement('div');
    materialsDiv.className = 'materials';

    // Täytä materialsDiv materiaalien tiedoilla...

    const templateCounts = { 1: [], 5: [], 10: [], 15: [], 20: [], 25: [], 30: [], 35: [], 40: [], 45: [] };
    const materialCounts = {};
    
    // Kerää tiedot kaikista syötetyistä itemeistä
    document.querySelectorAll('div[id^="level-"]').forEach(levelDiv => {
        const level = parseInt(levelDiv.id.split('-')[1]);
        levelDiv.querySelectorAll('input[type="number"]').forEach(input => {
            const amount = parseInt(input.value) || 0;
            const productKey = input.dataset.productKey;
            let product = productKey ? productLookup.get(productKey) : null;

            if (!product && input.name) {
                const [nameSlug, seasonStr, setSlug] = input.name.split('_');
                const season = parseInt(seasonStr, 10);
                product = (productsByLevel[level] || []).find(p =>
                    slug(p.name) === nameSlug &&
                    p.season === season &&
                    slug(p.setName || 'no-set') === setSlug
                ) || null;
            }

            if (product && amount > 0) {
                templateCounts[level].push({
                    name: product.name,
                    amount: amount,
                    img: product.img,
                    materials: product.materials,
                    multiplier: qualityMultipliers[level] || 1,
                    setName: product.setName,
                    season: product.season,
                    warlord: product.warlord || false
                });
                Object.entries(product.materials).forEach(([rawName, requiredAmount]) => {
                    const materialName = materialKeyMap[normalizeKey(rawName)] || rawName;

                    if (!materialCounts[materialName]) {
                        materialCounts[materialName] = {
                            amount: 0,
                            img: allMaterials[materialName] ? allMaterials[materialName].img : ''
                        };
                    }
                    const multiplier = qualityMultipliers[level] || 1;
                    materialCounts[materialName].amount += requiredAmount * amount * multiplier;
                });
            }
        });
    });
    renderResults(templateCounts, materialCounts);
}

function renderResults(templateCounts, materialCounts) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';

    const materialsDiv = document.createElement('div');
    materialsDiv.className = 'materials';

    const materialsShortage = failedLevels.length > 0 && failedLevels.some(level => (requestedTemplates[level] || 0) > 0);
    if (materialsShortage) {
        const warningBanner = document.createElement('div');
        warningBanner.className = 'materials-warning';
        warningBanner.innerHTML = '<strong>Materials depleted.</strong> Not every requested template could be generated with the available stock.';
        resultsDiv.appendChild(warningBanner);
    }

    const initialMaterialMap = getNormalizedKeyMap(initialMaterials);

    Object.entries(materialCounts)
        .sort(([aName], [bName]) => {
            const seasonA = materialToSeason[aName] || 0;
            const seasonB = materialToSeason[bName] || 0;
            if (seasonA !== seasonB) {
                return seasonA - seasonB;
            }
            return aName.localeCompare(bName);
        })
        .forEach(([materialName, data]) => {
            const materialContainer = document.createElement('div');
            const img = document.createElement('img');
            img.src = data.img;
            img.alt = materialName;
            materialContainer.appendChild(img);

            const pMatName = document.createElement('p');
            const pMatAmount = document.createElement('p');
            const pRemaining = document.createElement('p');
            const pAvailableMaterials = document.createElement('p');
            const pSeason = document.createElement('p');
            pMatName.className = 'material-name';
            pMatAmount.className = 'amount';
            pRemaining.className = 'remaining-to-use';
            pAvailableMaterials.className = 'available-materials';
            pSeason.className = 'season-id';

            let matText = allMaterials[materialName] ? allMaterials[materialName]["Original-name"] || materialName : materialName;
            const matSeason = materialToSeason[materialName] || 0;
            if (matSeason !== 0) {
                pSeason.textContent = `Season ${matSeason}`;
            }
            pMatName.textContent = matText;
            pMatAmount.textContent = `-${new Intl.NumberFormat('en-US').format(data.amount)}`;
            pRemaining.textContent = pMatAmount.textContent;
            remainingUse[materialName] = data.amount;
            const matchedKey = initialMaterialMap[normalizeKey(materialName)];
            const originalAmount = matchedKey ? initialMaterials[matchedKey] : 0;
            if (originalAmount > 0) {
                const remainingAmount = originalAmount - data.amount;
                pAvailableMaterials.textContent = `${new Intl.NumberFormat('en-US').format(Math.max(remainingAmount, 0))}`;
            }

            materialContainer.dataset.material = materialName;
            if (matSeason !== 0) {
                materialContainer.appendChild(pSeason);
            }
            materialContainer.appendChild(pMatName);
            materialContainer.appendChild(pMatAmount);
            materialContainer.appendChild(pRemaining);
            materialContainer.appendChild(pAvailableMaterials);

            materialsDiv.appendChild(materialContainer);
        });

    if (materialsDiv.children.length === 0) {
        const msg = document.createElement('h3');
        msg.textContent = 'No items could be crafted with the available materials';
        resultsDiv.appendChild(msg);
        createCloseButton(resultsDiv);
        showResults();
        return;
    }

    resultsDiv.appendChild(materialsDiv);

    const generateDiv = document.createElement('div');
    generateDiv.className = 'generate';
    materialsDiv.after(generateDiv);

    const levelItemCounts = calculateTotalItemsByLevel(templateCounts);
    const allSameCount = areAllCountsSame(levelItemCounts);
    const totalItems = Object.values(levelItemCounts).reduce((sum, c) => sum + c, 0);
    const allFailed = totalItems === 0;

    if (allFailed) {
        const msg = document.createElement('h3');
        msg.textContent = 'No items could be crafted with the available materials';
        resultsDiv.appendChild(msg);
        createCloseButton(resultsDiv);
        showResults();
        return;
    }

    if (allSameCount && levelItemCounts["1"] > 0) {
        const totalTemplatesHeader = document.createElement('h2');
        totalTemplatesHeader.textContent = `Total templates: ${new Intl.NumberFormat('en-US').format(levelItemCounts["1"])} pcs`;
        if (!isDebugMode){
            gtag('event', 'total_templates', {
                'event_total_templates': levelItemCounts,
                'value': 1
            });
        }
        materialsDiv.after(totalTemplatesHeader);
        totalTemplatesHeader.after(generateDiv);
    } else {
        materialsDiv.after(generateDiv);
    }

    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'items';

    const itemsInfoBtn = document.createElement('button');
    itemsInfoBtn.id = 'itemsInfoBtn';
    itemsInfoBtn.className = 'info-btn';
    itemsInfoBtn.setAttribute('aria-label', 'Items info');
    itemsInfoBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336c-13.3 0-24 10.7-24 24s10.7 24 24 24l80 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-8 0 0-88c0-13.3-10.7-24-24-24l-48 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l24 0 0 64-24 0zm40-144a32 32 0 1 0 0-64 32 32 0 1 0 0 64z"/></svg>`;

    const itemsInfoPopup = document.createElement('div');
    itemsInfoPopup.id = 'itemsInfoPopup';
    itemsInfoPopup.className = 'info-overlay';
    itemsInfoPopup.innerHTML = `<div class="info-content"><button class="close-popup" aria-label="Close"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M345 137c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-119 119L73 103c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l119 119L39 375c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l119-119L311 409c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-119-119L345 137z"/></svg></button><p>Click an item once it is crafted. Completed items fade, making it easy to see what is still missing.</p></div>`;

    itemsInfoBtn.addEventListener('click', () => {
        itemsInfoPopup.style.display = 'flex';
    });
    itemsInfoPopup.addEventListener('click', (e) => {
        if (e.target === itemsInfoPopup || e.target.closest('.close-popup')) {
            itemsInfoPopup.style.display = 'none';
        }
    });

    // itemsDiv placement adjusted later after copy button

    let firstLevelHeader = true;
    Object.entries(templateCounts).forEach(([level, templates]) => {
        const lvl = parseInt(level, 10);
        if (templates.length > 0 || (failedLevels.includes(lvl) && requestedTemplates[lvl] > 0)) {
            const levelHeader = document.createElement('h4');
            levelHeader.textContent = allSameCount ? `Level ${level}` : `Level ${level} (${new Intl.NumberFormat('en-US').format(levelItemCounts[level])} pcs)`;


            if (firstLevelHeader) {
                const headerWrap = document.createElement('div');
                headerWrap.className = 'items-header';
                headerWrap.appendChild(levelHeader);
                headerWrap.appendChild(itemsInfoBtn);
                itemsDiv.appendChild(headerWrap);
                firstLevelHeader = false;
            } else {
                itemsDiv.appendChild(levelHeader);
            }

            if (lvl === 20 && ctwMediumNotice && !level20OnlyWarlordsActive) {
                const extraInfo = document.createElement('p');
                extraInfo.className = 'craft-extra-info';
                extraInfo.textContent = "Medium odds items were used because otherwise no items would be generated. At level 20, Ceremonial Targaryen Warlord items are categorized as 'medium odds'.";
                itemsDiv.appendChild(extraInfo);
            }
            const levelGroup = document.createElement('div');
            levelGroup.className = 'level-group';
            itemsDiv.appendChild(levelGroup);

            if (templates.length > 0) {
                templates.forEach(template => {
                    const templateDiv = document.createElement('div');
                    templateDiv.classList.add('item');
                    if (template.warlord) {
                        templateDiv.classList.add('item-ctw');
                    }
                    const img = document.createElement('img');
                    img.src = template.img;
                    img.alt = template.name;
                    templateDiv.appendChild(img);

                    let pSeasonInfo;
                    let pSetName;
                    const displaySeason = template.warlord ? 3 : template.season;
                    if (displaySeason && displaySeason !== 0) {
                        pSeasonInfo = document.createElement('p');
                        pSeasonInfo.className = 'season-info';
                        pSeasonInfo.textContent = `Season ${displaySeason}`;

                        pSetName = document.createElement('p');
                        pSetName.className = 'set-name';
                        pSetName.textContent = template.setName || '';
                    }

                    const pTemplateName = document.createElement('p');
                    const pTemplateamount = document.createElement('p');
                    pTemplateName.className = 'name';
                    pTemplateamount.className = 'amount';

                    pTemplateName.textContent = `${template.name}`;
                    pTemplateamount.textContent = `${new Intl.NumberFormat('en-US').format(template.amount)}`;

                    if (displaySeason && displaySeason !== 0) {
                        templateDiv.appendChild(pSeasonInfo);
                        templateDiv.appendChild(pSetName);
                    }

                    templateDiv.appendChild(pTemplateName);
                    templateDiv.appendChild(pTemplateamount);

                    const matsDiv = document.createElement('div');
                    matsDiv.className = 'item-mats';
                    const materialUsage = {};
                    Object.entries(template.materials).forEach(([mat, amt]) => {
                        const totalAmt = amt * template.amount * (template.multiplier || 1);
                        materialUsage[mat] = totalAmt;
                        const pLine = document.createElement('p');
                        pLine.className = 'item-material';
                        pLine.innerHTML = `${mat} <span>${new Intl.NumberFormat('en-US').format(totalAmt)}</span>`;
                        matsDiv.appendChild(pLine);
                    });
                    templateDiv.dataset.materials = JSON.stringify(materialUsage);
                    templateDiv.appendChild(matsDiv);

                    templateDiv.addEventListener('click', function() {
                        this.classList.toggle('opacity');
                        const used = JSON.parse(this.dataset.materials);
                        const done = this.classList.contains('opacity');
                        Object.entries(used).forEach(([mat, amt]) => {
                            if (done) {
                                remainingUse[mat] -= amt;
                            } else {
                                remainingUse[mat] += amt;
                            }
                            const target = materialsDiv.querySelector(`div[data-material="${mat}"] .remaining-to-use`);
                            if (target) {
                                target.textContent = `-${new Intl.NumberFormat('en-US').format(remainingUse[mat])}`;
                            }
                        });
                    });

                    levelGroup.appendChild(templateDiv);
                });
            } else {
                const msg = document.createElement('p');
                msg.className = 'no-products';
                msg.textContent = 'No items could be crafted with the available materials';
                levelGroup.appendChild(msg);
            }
        }
    });

    // Prepare a lighter share payload containing only the user inputs
    const minimalTemplates = {};
    Object.entries(templateCounts).forEach(([lvl, items]) => {
        minimalTemplates[lvl] = items.map(({ name, amount, setName, season, multiplier, warlord }) => ({
            name,
            amount,
            setName,
            season,
            multiplier,
            warlord
        }));
    });

    generateDiv.after(itemsDiv);
    itemsDiv.after(itemsInfoPopup);
    createCloseButton(resultsDiv);

    const seasonTotals = {};
    let totalBasicMat = 0;
    let totalAllSeason = 0;
    Object.entries(materialCounts).forEach(([name, data]) => {
        const season = materialToSeason[name] || 0;
        if (season === 0) {
            totalBasicMat += data.amount;
        } else {
            seasonTotals[season] = (seasonTotals[season] || 0) + data.amount;
            totalAllSeason += data.amount;
        }
    });

    const nf = new Intl.NumberFormat('fi-FI');
    console.log(`Käytetty perusmateriaali: ${nf.format(totalBasicMat)}`);
    Object.keys(seasonTotals)
        .sort((a, b) => a - b)
        .forEach(season => {
            console.log(`Käytetty materiaali Season ${season}: ${nf.format(seasonTotals[season])}`);
        });
    console.log(`Käytetty Gear materiaali yhteensä: ${nf.format(totalAllSeason)}`);

    showResults();
}

function calculateTotalItemsByLevel(templateCounts) {
    let totalItemsByLevel = {};

    // Käydään läpi jokainen taso templateCounts-objektissa
    Object.keys(templateCounts).forEach(level => {
        // Laske tämän tason kaikkien templatejen määrät yhteen
        const totalItems = templateCounts[level].reduce((sum, template) => sum + template.amount, 0);
        totalItemsByLevel[level] = totalItems;
    });

    return totalItemsByLevel;
}

function areAllCountsSame(levelItemCounts) {
    const counts = Object.values(levelItemCounts);
    return counts.every(count => count === counts[0]);
}

function createMaterialImageElement(materialName, imgUrl, preference) {
    const imgElement = document.createElement('img');
    imgElement.src = imgUrl;
    imgElement.alt = materialName;
    imgElement.className = 'material-image';
    imgElement.dataset.materialName = materialName;
    imgElement.dataset.preference = preference;

    imgElement.addEventListener('click', function() {
        this.classList.toggle('selected');
        // Täällä voit lisätä logiikkaa valintojen tallentamiseen tai käsittelyyn
    });

    return imgElement;
}

async function calculateWithPreferences() {
    const templateAmountInputs = LEVELS.map(l => document.querySelector(`#templateAmount${l}`));
    let isValid = true;
        let hasValue = false;

        templateAmountInputs.forEach(input => {
		const val = parseInt(input.value.replace(/,/g, ''), 10);
		if (!isNaN(val)) {
				if (val > 0) {
						hasValue = true;
				}
				if (val < 0) {
						isValid = false;
						input.classList.add('missing-input');
						setTimeout(() => {
								input.classList.remove('missing-input');
						}, 3000);
				}
		}
	});

	 if (!hasValue) {
		isValid = false;
		templateAmountInputs.forEach(input => {
				input.classList.add('missing-input');
				setTimeout(() => {
						input.classList.remove('missing-input');
				}, 3000);
		});
        }
        if (!isValid) {
                return; // Estä laskennan suoritus
        }

        document.querySelector('.spinner-wrap').classList.add('active');
        await waitForNextFrame();

        try {
                let availableMaterials = gatherMaterialsFromInputs();
                availableMaterials = sanitizeGearMaterials(availableMaterials);
                if (Object.keys(initialMaterials).length === 0) {
                                initialMaterials = { ...availableMaterials };
                } else {
                                Object.entries(availableMaterials).forEach(([mat, amt]) => {
                                                if (!(mat in initialMaterials)) {
                                                                initialMaterials[mat] = amt;
                                                }
                                });
                }

                let templatesByLevel = {};
                let totalTemplates = 0;
                LEVELS.forEach(level => {
                                const val = parseInt(document.getElementById(`templateAmount${level}`).value.replace(/,/g, '')) || 0;
                                templatesByLevel[level] = val;
                                requestedTemplates[level] = val;
                                totalTemplates += val;
                                const quality = document.getElementById(`temp${level}`).value;
                                qualityMultipliers[level] = getQualityMultiplier(quality);
                });
                if (totalTemplates === 0) {
                                document.querySelector('.spinner-wrap').classList.remove('active');
                                clearCalculationProgress();
                                return;
                } else {
                                if (!isDebugMode){
                                                gtag('event', 'total_material_templates', {
                                                                'event_material_templates': totalTemplates,
                                                                'value': 1
                                                });
                                }
                }

                let materialAmounts = Object.values(availableMaterials).map(amount => {
                        if (typeof amount === 'string' && amount.includes(',')) {
                                return parseInt(amount.replace(/,/g, ''), 10);
                        } else {
                                return parseInt(amount, 10);
                        }
                });

                if (!isDebugMode){
                        let totalMaterialAmount = materialAmounts.reduce((total, amount) => total + amount, 0);
                        let averageMaterialAmount = materialAmounts.length > 0 ? totalMaterialAmount / materialAmounts.length : 0;
                        let maxMaterialAmount = Math.max(...materialAmounts);
                        let maxMaterialIndex = materialAmounts.findIndex(amount => amount === maxMaterialAmount);
                        let maxMaterialName = Object.keys(availableMaterials)[maxMaterialIndex];

                        gtag('event', 'material_analytics', {
                                'average_material_amount': parseInt(averageMaterialAmount),
                                'max_material_amount': maxMaterialAmount,
                                'max_material_name': maxMaterialName,
                                'value': 1
                        });
                }

                const progressTracker = createProgressTracker(totalTemplates);
                const resultPlan = await calculateProductionPlan(availableMaterials, templatesByLevel, progressTracker.tick);
                progressTracker.complete();
                failedLevels = resultPlan.failedLevels;

                document.querySelectorAll('#manualInput input[type="number"]').forEach(input => {
                        input.value = ''; // Nollaa kaikki input-kentät
                });
                listSelectedProducts(resultPlan.plan);
                const calculateBtn = document.querySelector('.calculate-button');
                if (calculateBtn) {
                        calculateBtn.click(); // Simuloi napin klikkausta
                } else {
                        document.querySelector('.spinner-wrap').classList.remove('active');
                        clearCalculationProgress();
                }
        } catch (error) {
                console.error('Failed to calculate templates with preferences:', error);
                displayUserMessage('Something went wrong while calculating templates. Please try again.');
                document.querySelector('.spinner-wrap').classList.remove('active');
                clearCalculationProgress();
        }
}

document.getElementById('calculateWithPreferences').addEventListener('click', calculateWithPreferences);

function gatherMaterialsFromInputs() {
    const scaleSelect = document.getElementById('scaleSelect');
    const scale = scaleSelect ? parseFloat(scaleSelect.value) || 1 : 1;
    let materialsInput = {};
    document.querySelectorAll('.my-material input[type="text"]').forEach(input => {
        const id = input.getAttribute('id').replace('my-', '');
        const materialName = materialKeyMap[normalizeKey(id)];
        const raw = input.value.replace(/,/g, '');
        const materialAmount = parseFloat(raw);
        if (!materialName) {
            return;
        }
        if (!isNaN(materialAmount)) {
            materialsInput[materialName] = materialAmount * scale;
        }
    });

    return materialsInput;
}

function sanitizeGearMaterials(materialsInput) {
    const cleaned = { ...materialsInput };
    Object.entries(materialsInput).forEach(([name, amount]) => {
        const season = materialToSeason[name] || 0;
        if (season !== 0 && (!amount || amount <= 0)) {
            delete cleaned[name];
        }
    });
    return cleaned;
}

function filterProductsByAvailableGear(products, availableMaterials, multiplier = 1) {
    const availableMap = getNormalizedKeyMap(availableMaterials);
    return products.filter(product => {
        return Object.entries(product.materials).every(([mat, amt]) => {
            const normalized = normalizeKey(mat);
            const season = materialToSeason[normalized] || materialToSeason[mat] || 0;
            if (season === 0) {
                return true;
            }
            const matchedKey = availableMap[normalized];
            return matchedKey && availableMaterials[matchedKey] >= amt * multiplier;
        });
    });
}

const SEASONAL_ODDS_LEVELS = new Set([15, 20, 25, 30, 35]);
const EXTENDED_ODDS_LEVELS = new Set([20]);

function shouldApplyOddsForProduct(product) {
    if (!product?.odds || product.odds === 'normal') {
        return false;
    }

    const level = product.level;
    const season = product.season;
    const isCeremonialTargaryenWarlord = product.setName === 'Ceremonial Targaryen Warlord';

    if ((season === 0 || isCeremonialTargaryenWarlord) && SEASONAL_ODDS_LEVELS.has(level)) {
        return true;
    }

    if ((season === 1 || season === 2) && EXTENDED_ODDS_LEVELS.has(level)) {
        return true;
    }

    return false;
}

async function calculateProductionPlan(availableMaterials, templatesByLevel, progressTick = async () => {}) {
    const productionPlan = { "1": [], "5": [], "10": [], "15": [], "20": [], "25": [], "30": [], "35": [], "40": [], "45": [] };
    const failed = new Set();
    const includeWarlords = document.getElementById('includeWarlords')?.checked ?? true;
    const level1OnlyWarlords = document.getElementById('level1OnlyWarlords')?.checked ?? false;
    const level20OnlyWarlords = document.getElementById('level20OnlyWarlords')?.checked ?? false;
    const includeLowOdds = document.getElementById('includeLowOdds')?.checked ?? true;
    const includeMediumOdds = document.getElementById('includeMediumOdds')?.checked ?? true;
    const seasonZeroPreference = getSeasonZeroPreference();
    const gearLevelSelect = document.getElementById('gearMaterialLevels');
    const allowedGearLevels = gearLevelSelect ? Array.from(gearLevelSelect.selectedOptions).map(o => parseInt(o.value, 10)) : [];
    const hasGearMaterials = Object.keys(availableMaterials).some(
        key => (materialToSeason[key] || materialToSeason[normalizeKey(key)] || 0) !== 0
    );
    const level20Allowed = hasGearMaterials && allowedGearLevels.includes(20);
    level20OnlyWarlordsActive = level20OnlyWarlords;
    ctwMediumNotice = includeWarlords && !includeMediumOdds && !level20Allowed && !level20OnlyWarlords;
    const progress = typeof progressTick === 'function' ? progressTick : async () => {};

    const getLevelProducts = (level, { requireCtwOnly = false } = {}) => {
        const baseList = productsByLevel[level] ? [...productsByLevel[level]] : [];
        if (requireCtwOnly) {
            return baseList.filter(p => p.warlord && p.setName === 'Ceremonial Targaryen Warlord');
        }
        if (level === 1 && level1OnlyWarlords) {
            return baseList.filter(p => p.warlord);
        }
        if (includeWarlords) {
            return baseList.slice();
        }
        return baseList.filter(p => !p.warlord);
    };

    const applyLevelFilters = (level, levelProducts, multiplier, { requireCtwOnly = false } = {}) => {
        let filtered = levelProducts;
        if (!allowedGearLevels.includes(level)) {
            filtered = filtered.filter(p => p.season == 0 || p.setName === ctwSetName);
        }
        const isLegendary = multiplier >= 1024;
        filtered = filtered.filter(p => {
            if (requireCtwOnly && p.setName === 'Ceremonial Targaryen Warlord') {
                return true;
            }
            const applyOdds = !isLegendary && shouldApplyOddsForProduct(p);
            if (!applyOdds) return true;
            if (p.odds === 'low') return includeLowOdds;
            if (p.odds === 'medium') return includeMediumOdds || (ctwMediumNotice && p.warlord && p.level === 20);
            return true;
        });
        filtered = filterProductsByAvailableGear(filtered, availableMaterials, multiplier);
        filtered = applySeasonZeroPreference(filtered, seasonZeroPreference);
        return filtered;
    };

    const processNormalOddsLevel = async (level) => {
        if (
            templatesByLevel[level] > 0 &&
            !includeLowOdds &&
			!includeMediumOdds &&
            seasonZeroPreference !== SeasonZeroPreference.OFF
        ) {
            let remaining = templatesByLevel[level];
            const multiplier = qualityMultipliers[level] || 1;
            const isLegendary = multiplier >= 1024;
			let produced = 0;

            while (remaining > 0) {
                const prefs = getUserPreferences(availableMaterials);
                let levelProducts = getLevelProducts(level);
                levelProducts = applySeasonZeroPreference(levelProducts, seasonZeroPreference);
                if (levelProducts.length === 0) {
                    break;
                }
                levelProducts = levelProducts.filter(p => {
                    const applyOdds = !isLegendary && shouldApplyOddsForProduct(p);
                    if (!applyOdds) return true;
                    if (p.odds === 'low') return includeLowOdds;
                    if (p.odds === 'medium') return includeMediumOdds;
                    return true;
                });
                levelProducts = filterProductsByAvailableGear(levelProducts, availableMaterials, multiplier);
                if (levelProducts.length === 0) {
                    break;
                }
                const selected = selectBestAvailableProduct(
                    levelProducts,
                    prefs.mostAvailableMaterials,
                    prefs.secondMostAvailableMaterials,
                    prefs.leastAvailableMaterials,
                    availableMaterials,
                    multiplier
                );

                if (selected && canProductBeProduced(selected, availableMaterials, multiplier)) {
                    productionPlan[level].push({ name: selected.name, season: selected.season, setName: selected.setName, warlord: selected.warlord });
                    updateAvailableMaterials(availableMaterials, selected, multiplier);
                    remaining--;
					produced++;
                    await progress();
                } else {
                    break;
                }
            }

            templatesByLevel[level] = remaining;

            if (produced > 0) {
                return;
            }
        }
    };

    const normalOddsPriorityLevels = [35, 30, 15];
    for (const level of normalOddsPriorityLevels) {
        await processNormalOddsLevel(level);
    }

    for (const level of LEVELS) {
        if (templatesByLevel[level] <= 0) continue;
        const requireCtwOnly = level === 20 && level20OnlyWarlords;
        let levelProducts = getLevelProducts(level, { requireCtwOnly });
        const multiplier = qualityMultipliers[level] || 1;
        levelProducts = applyLevelFilters(level, levelProducts, multiplier, { requireCtwOnly });
        if (levelProducts.length === 0) {
            failed.add(level);
            templatesByLevel[level] = 0;
        }
    }

    let remaining = { ...templatesByLevel };

    while (Object.values(remaining).some(v => v > 0)) {
        const preferences = getUserPreferences(availableMaterials);
        let anySelected = false;

        for (const level of LEVELS) {
            if (remaining[level] <= 0) continue;
            const requireCtwOnly = level === 20 && level20OnlyWarlords;
            let levelProducts = getLevelProducts(level, { requireCtwOnly });
            const multiplier = qualityMultipliers[level] || 1;
            levelProducts = applyLevelFilters(level, levelProducts, multiplier, { requireCtwOnly });

            const selectedProduct = selectBestAvailableProduct(
                levelProducts,
                preferences.mostAvailableMaterials,
                preferences.secondMostAvailableMaterials,
                preferences.leastAvailableMaterials,
                availableMaterials,
                multiplier
            );

            if (selectedProduct && canProductBeProduced(selectedProduct, availableMaterials, multiplier)) {
                productionPlan[level].push({ name: selectedProduct.name, season: selectedProduct.season, setName: selectedProduct.setName, warlord: selectedProduct.warlord });
                updateAvailableMaterials(availableMaterials, selectedProduct, multiplier);
                remaining[level]--;
                anySelected = true;
                await progress();
            } else {
                failed.add(level);
                remaining[level] = 0;
            }
        }

        if (!anySelected) {
            break;
        }
    }

    return { plan: productionPlan, failedLevels: Array.from(failed) };
}

function displayUserMessage(message) {
    const resultsDiv = document.getElementById('results');
    const messageElement = document.createElement('h3');
    messageElement.innerHTML = message;
    const generateDiv = resultsDiv.querySelector('.generate');

    // Lisää viesti ennen generateDiviä
    resultsDiv.insertBefore(messageElement, generateDiv);
}




function updateAvailableMaterials(availableMaterials, selectedProduct, multiplier = 1) {
    const availableMap = getNormalizedKeyMap(availableMaterials);
    Object.entries(selectedProduct.materials).forEach(([material, amountRequired]) => {
        const normalizedMaterial = normalizeKey(material);
        const matchedKey = availableMap[normalizedMaterial];

        if (matchedKey) {
            availableMaterials[matchedKey] -= amountRequired * multiplier;
        }
    });
}







function getUserPreferences(availableMaterials) {
	let sortedMaterials = Object.entries(availableMaterials).sort((a, b) => b[1] - a[1]);
    let uniqueAmounts = [...new Set(sortedMaterials.map(([_, amount]) => amount))];

    let mostAvailableMaterials = [], secondMostAvailableMaterials = [], leastAvailableMaterials = [];

    // Määritä materiaalit, joita on eniten
    let maxAmount = uniqueAmounts[0];
    mostAvailableMaterials = sortedMaterials.filter(([_, amount]) => amount === maxAmount).map(([material, _]) => material);

    if (mostAvailableMaterials.length < 4) {
        let nextAmountIndex = 1;
        while (secondMostAvailableMaterials.length < 4 - mostAvailableMaterials.length && nextAmountIndex < uniqueAmounts.length) {
            let currentAmount = uniqueAmounts[nextAmountIndex];
            let currentMaterials = sortedMaterials.filter(([_, amount]) => amount === currentAmount).map(([material, _]) => material);
            secondMostAvailableMaterials.push(...currentMaterials);
            nextAmountIndex++;
        }
        secondMostAvailableMaterials = secondMostAvailableMaterials.slice(0, 4 - mostAvailableMaterials.length);
    }

    // Määritä materiaalit, joita on vähiten, huomioiden most ja second
    if (mostAvailableMaterials.length + secondMostAvailableMaterials.length < 12) {
        let leastAmountsNeeded = 4;
        if (mostAvailableMaterials.length + secondMostAvailableMaterials.length > 8) {
            leastAmountsNeeded = 12 - (mostAvailableMaterials.length + secondMostAvailableMaterials.length);
        }

        let leastIndexStart = uniqueAmounts.length - leastAmountsNeeded;
        for (let i = leastIndexStart; i < uniqueAmounts.length; i++) {
            let currentAmount = uniqueAmounts[i];
            leastAvailableMaterials.push(...sortedMaterials.filter(([_, amount]) => amount === currentAmount).map(([material, _]) => material));
        }
        leastAvailableMaterials = leastAvailableMaterials.slice(0, leastAmountsNeeded);
    }

    return { mostAvailableMaterials, secondMostAvailableMaterials, leastAvailableMaterials };
}

function selectBestAvailableProduct(levelProducts, mostAvailableMaterials, secondMostAvailableMaterials, leastAvailableMaterials, availableMaterials, multiplier = 1) {
    // Järjestä tuotteet pisteiden mukaan
    const candidates = levelProducts
        .map(product => ({
            product,
            score: getMaterialScore(product, mostAvailableMaterials, secondMostAvailableMaterials, leastAvailableMaterials, availableMaterials, multiplier)
        }))
        .sort((a, b) => b.score - a.score); // suurimmasta pienimpään

    // Etsi ensimmäinen tuote, jonka materiaalit riittävät
    for (const { product } of candidates) {
        if (canProductBeProduced(product, availableMaterials, multiplier)) {
            return product;
        }
    }

    return null; // Mikään tuote ei kelpaa
}

function rollbackMaterials(availableMaterials, product, multiplier = 1) {
    const availableMap = getNormalizedKeyMap(availableMaterials);
    Object.entries(product.materials).forEach(([material, amountRequired]) => {
        const normalizedMaterial = normalizeKey(material);
        const matchedKey = availableMap[normalizedMaterial];

        if (matchedKey) {
            availableMaterials[matchedKey] += amountRequired * multiplier;
        }
    });
}

function computeBaseUsageStd(materialsState) {
    const remaining = [];
    const stateMap = getNormalizedKeyMap(materialsState);
    Object.entries(initialMaterials).forEach(([material, _]) => {
        const normalized = normalizeKey(material);
        const matchedKey = stateMap[normalized];
        if (matchedKey && materialToSeason[normalized] === 0) {
            remaining.push(materialsState[matchedKey]);
        }
    });
    if (remaining.length === 0) {
        return 0;
    }
    const mean = remaining.reduce((a, b) => a + b, 0) / remaining.length;
    const variance = remaining.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / remaining.length;
    return Math.sqrt(variance);
}

function computeBalancePenalty(product, availableMaterials, multiplier = 1) {
    const predicted = { ...availableMaterials };
    const predictedMap = getNormalizedKeyMap(predicted);
    Object.entries(product.materials).forEach(([material, amt]) => {
        const normalized = normalizeKey(material);
        const matchedKey = predictedMap[normalized];
        if (matchedKey) {
            predicted[matchedKey] -= amt * multiplier;
        }
    });
    return computeBaseUsageStd(predicted);
}

function getMaterialScore(product, mostAvailableMaterials, secondMostAvailableMaterials, leastAvailableMaterials, availableMaterials, multiplier = 1) {
    let score = 0;
    const availableMap = getNormalizedKeyMap(availableMaterials);
    const seasonZeroPreference = getSeasonZeroPreference();
    const shouldApplyGearBaselineBonus = true; // Season 0 slider should not modify non-season gear weighting
    Object.entries(product.materials).forEach(([material, _]) => {
        const season = materialToSeason[material] || 0;
        const isGear = season !== 0;
        if (mostAvailableMaterials.includes(material)) {
            score += isGear ? GEAR_MOST_WEIGHT : BASE_MOST_WEIGHT;
        }
        if (secondMostAvailableMaterials.includes(material)) {
            score += isGear ? GEAR_SECOND_WEIGHT : BASE_SECOND_WEIGHT;
        }
        if (leastAvailableMaterials.includes(material)) {
            score -= 10;
        }
        if (shouldApplyGearBaselineBonus && isGear) {
            score += GEAR_BASELINE_BONUS;
        }
    });
    if (product.warlord) {
        score -= WARLORD_PENALTY;
    }

    Object.entries(product.materials).forEach(([material, amount]) => {
        const normalizedMaterial = normalizeKey(material);
        const matchedKey = availableMap[normalizedMaterial];
        if (matchedKey) {
            const season = materialToSeason[normalizedMaterial] || 0;
            const weight = season === 0 ? LEFTOVER_WEIGHT_BASE : LEFTOVER_WEIGHT_GEAR;
            const available = availableMaterials[matchedKey];
            const remaining = available - amount * multiplier;
            if (available > 0) {
                score -= (remaining / available) * weight;
            }
        }
    });
	
    const balancePenalty = computeBalancePenalty(product, availableMaterials, multiplier);
    score -= balancePenalty * BALANCE_WEIGHT;

    const { seasonZero: seasonZeroAdjustment } = getSeasonZeroScoreAdjustments(seasonZeroPreference);

    if (product.season === 0) {
        score += seasonZeroAdjustment;
    }

    return score;
}

function canProductBeProduced(product, availableMaterials, multiplier = 1) {
    const availableMap = getNormalizedKeyMap(availableMaterials);
    return Object.entries(product.materials).every(([material, amountRequired]) => {
        const normalizedMaterial = normalizeKey(material);
        const matchedKey = availableMap[normalizedMaterial];

        if (!matchedKey) {
            return false;
        }

        return availableMaterials[matchedKey] >= amountRequired * multiplier;
    });
}





function listSelectedProducts(productionPlan) {
    Object.entries(productionPlan).forEach(([level, products]) => {
        products.forEach(({ name, season, setName }) => {
            const selector = `#level-${level}-items input[name="${slug(name)}_${season}_${slug(setName || 'no-set')}"]`;
            const inputElement = document.querySelector(selector);
            if (inputElement) {
                inputElement.value = (parseInt(inputElement.value) || 0) + 1;
            }
        });
    });
}


function inputActive(){

	document.addEventListener('click', (e) => {
        const clickedDiv = e.target.closest('.my-material');
        if (clickedDiv && !e.target.closest('.level-checkboxes')) {
            document.querySelectorAll('.my-material').forEach(div => {
                const inp = div.querySelector('.numeric-input');
                if (div !== clickedDiv && inp && inp.value === '') {
                    div.classList.remove('active');
                }
            });
            clickedDiv.classList.add('active');
            const input = clickedDiv.querySelector('.numeric-input');
            if (input) input.focus();
        }
    });

	document.addEventListener('focusout', (e) => {
        if (e.target.classList.contains('numeric-input')) {
            if (e.target.value === '') {
                const parent = e.target.closest('.my-material');
                if (parent) parent.classList.remove('active');
            }
        }
    }, true);
	
	document.addEventListener('focusin', (e) => {
        if (e.target.classList.contains('numeric-input')) {
            document.querySelectorAll('.my-material').forEach(div => {
                const inp = div.querySelector('.numeric-input');
                if (inp && inp.value === '' && div !== e.target.closest('.my-material')) {
                    div.classList.remove('active');
                }
            });
            e.target.closest('.my-material').classList.add('active');
        }
    });		

	// Uusi osa: käsittele kaikki templateAmount-inputit tasoittain (1,5,10,...)
        const levels = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45];
	levels.forEach(level => {
		const input = document.querySelector(`#templateAmount${level}`);
		const wrap = document.querySelector(`.leveltmp${level} .templateAmountWrap`);

		if (input && wrap) {
			input.addEventListener('focus', () => {
				wrap.classList.add('active');
			});

			input.addEventListener('blur', () => {
				if (!input.value) {
					wrap.classList.remove('active');
				}
			});
		}
	});
}

function initAdvMaterialSection() {
    const toggle = document.getElementById('toggleAdvMaterials');
    const container = document.getElementById('advMaterials');
    if (!toggle || !container || typeof seasons === 'undefined') return;

    toggle.addEventListener('click', () => {
        const isHidden = container.style.display === 'none';
        container.style.display = isHidden ? 'block' : 'none';
        toggle.classList.toggle('open', isHidden);
    });

    const seasonData = seasons.filter(s => s.season !== 0).sort((a, b) => b.season - a.season);

    const arrowSvg = '<svg class="toggle-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"/></svg>';

    seasonData.forEach(season => {
        const header = document.createElement('h4');
        header.innerHTML = `Season ${season.season}${arrowSvg}`;
        container.appendChild(header);

        const seasonDiv = document.createElement('div');
        seasonDiv.style.display = 'none';
        container.appendChild(seasonDiv);

        header.addEventListener('click', () => {
            const isHidden = seasonDiv.style.display === 'none';
            seasonDiv.style.display = isHidden ? 'block' : 'none';
            header.classList.toggle('open', isHidden);
        });

        season.sets.forEach(set => {
            const matKey = set.setMat
                .toLowerCase()
                .replace(/'s/g, '')
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');
            const matInfo = materials[season.season] && materials[season.season].mats[matKey];
            if (!matInfo) return;

            const matDiv = document.createElement('div');
            matDiv.className = `my-material ${matKey}`;

            const img = document.createElement('img');
            img.src = matInfo.img;
            matDiv.appendChild(img);

            const inner = document.createElement('div');
            const span = document.createElement('span');
            span.textContent = matInfo["Original-name"] || set.setMat;
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'numeric-input';
            input.id = `my-${matKey}`;
            input.name = `my-${matKey}`;
            input.placeholder = 'value';
            input.pattern = '[0-9]*';
            input.inputMode = 'numeric';
            inner.appendChild(span);
            inner.appendChild(input);
            matDiv.appendChild(inner);

            seasonDiv.appendChild(matDiv);
        });
    });

    const infoHeader = document.createElement('div');
    infoHeader.className = 'section-title';
    const infoInner = document.createElement('div');
    infoInner.className = 'checkbox-header';
    const infoSpan = document.createElement('span');
    infoSpan.textContent = 'Gear materials at levels';
    const infoBtn = document.createElement('button');
    infoBtn.id = 'gearLevelsInfoBtn';
    infoBtn.className = 'info-btn';
    infoBtn.setAttribute('aria-label', 'Gear materials info');
    infoBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336c-13.3 0-24 10.7-24 24s10.7 24 24 24l80 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-8 0 0-88c0-13.3-10.7-24-24-24l-48 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l24 0 0 64-24 0zm40-144a32 32 0 1 0 0-64 32 32 0 1 0 0 64z"/></svg>';
    infoInner.appendChild(infoSpan);
    infoInner.appendChild(infoBtn);
    infoHeader.appendChild(infoInner);
    container.appendChild(infoHeader);

    const infoPopup = document.createElement('div');
    infoPopup.id = 'gearLevelsInfoPopup';
    infoPopup.className = 'info-overlay';
    infoPopup.innerHTML = '<div class="info-content"><button class="close-popup" aria-label="Close"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M345 137c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-119 119L73 103c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l119 119L39 375c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l119-119L311 409c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-119-119L345 137z"></path></svg></button><p>Select the levels where gear set materials may be used. Other levels craft only with basic materials, allowing you to save gear materials for later levels. Levels with a dark background are active.</p></div>';
    container.appendChild(infoPopup);

    const levelWrap = document.createElement('div');
    levelWrap.className = 'level-select-container';

    const dropdown = document.createElement('div');
    dropdown.className = 'level-dropdown';
    const select = document.createElement('select');
    select.id = 'gearMaterialLevels';
    select.multiple = true;
    select.style.display = 'none';

    const defaultGearLevels = [20, 25, 30, 35, 40, 45];
    [5,10,15,20,25,30,35,40,45].forEach(l => {
        const optionDiv = document.createElement('div');
        optionDiv.dataset.value = l;
        optionDiv.textContent = l;
        if (defaultGearLevels.includes(l)) {
            optionDiv.classList.add('selected');
        }
        dropdown.appendChild(optionDiv);

        const opt = document.createElement('option');
        opt.value = l;
        opt.textContent = l;
        if (defaultGearLevels.includes(l)) {
            opt.selected = true;
        }
        select.appendChild(opt);
    });

    dropdown.addEventListener('click', e => {
        const value = e.target.dataset.value;
        if (!value) return;
        e.target.classList.toggle('selected');
        Array.from(select.options).forEach(opt => {
            if (opt.value === value) {
                opt.selected = !opt.selected;
            }
        });
    });

    levelWrap.appendChild(dropdown);
    levelWrap.appendChild(select);
    container.appendChild(levelWrap);

    const seasonZeroSection = document.querySelector('.season-zero-section');
    if (seasonZeroSection) {
        container.appendChild(seasonZeroSection);
    }
}
