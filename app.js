/**
 * app.js
 * 
 * Core frontend logic for the Awesome Snapmaker List SPA.
 * Handles YAML data fetching, multi-lingual DOM mapping via HTML data-i18n attributes, 
 * dynamic search/filtering, local storage persistence, and URL state routing.
 */

// Global State
let allRecords = [];
let fuse;
let translations = {};
let currentLang = 'en';
let activeFilters = {
    machine: new Set(),
    tool: new Set(),
    type: new Set(),
    official: new Set(),
    difficulty: new Set(),
    cost: new Set(),
    language: new Set()
};
let excludedFilters = {
    machine: new Set(),
    tool: new Set(),
    type: new Set(),
    official: new Set(),
    difficulty: new Set(),
    cost: new Set(),
    language: new Set()
};

// DOM Elements
const DOM = {
    title: document.getElementById('site-title'),
    description: document.getElementById('site-description'),
    headerInfo: document.querySelector('.header-content'),
    authorLink: document.getElementById('author-link'),
    repoLink: document.getElementById('repo-link'),
    forumLink: document.getElementById('forum-link'),
    headerBg: document.getElementById('site-header'),
    recordsContainer: document.getElementById('records-container'),
    searchInput: document.getElementById('search-input'),
    sortSelect: document.getElementById('sort-select'),
    filterMachine: document.getElementById('filter-machine'),
    filterTool: document.getElementById('filter-tool'),
    filterType: document.getElementById('filter-type'),
    filterOfficial: document.getElementById('filter-official'),
    filterDifficulty: document.getElementById('filter-difficulty'),
    filterCost: document.getElementById('filter-cost'),
    filterLanguage: document.getElementById('filter-language'),
    showFavoritesBtn: document.getElementById('show-favorites'),
    limitInput: document.getElementById('limit-input'),
    clearFiltersBtn: document.getElementById('clear-filters'),
    shareViewBtn: document.getElementById('share-view-btn'),
    resultCount: document.getElementById('result-count'),
    jumpTopBtn: document.getElementById('jump-top'),
    replayTourBtn: document.getElementById('tour-btn')
};

// Available Tags (Based on Schema)
const TAGS = {
    machine: ["SM_2.0", "Artisan", "U1", "J1", "RAY", "Universal"],
    tool: ["FDM", "LASER", "CNC", "ROTARY", "COMBINED"],
    type: ["Watch", "Discuss", "Read", "Download", "Shop"],
    official: ["OFFICIAL", "UNOFFICIAL"],
    difficulty: [],
    cost: [],
    language: []
};

// Initialize the Application
async function init() {
    try {
        const prefix = document.querySelector('meta[name="is-localized"]') ? '../' : '';
        const [dataResponse, enResponse] = await Promise.all([
            fetch(prefix + 'data.yml'),
            fetch(prefix + 'locales/en.yml')
        ]);
        if (!dataResponse.ok) throw new Error('data.yml network response was not ok');
        if (!enResponse.ok) throw new Error('locales/en.yml network response was not ok');
        
        const dataYamlText = await dataResponse.text();
        const enYamlText = await enResponse.text();
        
        const data = jsyaml.load(dataYamlText);
        const enDict = jsyaml.load(enYamlText);
        translations['en'] = enDict || {};

        setupProjectInfo(data.project_info);

        // Dynamically set TAGS from data.yml so it's a single source of truth
        if (data.allowed_tags) {
            TAGS.machine = data.allowed_tags.machine_type || [];
            TAGS.tool = data.allowed_tags.machine_tool_type || [];
            TAGS.type = data.allowed_tags.record_type || [];
            TAGS.official = data.allowed_tags.official_flag || [];
            TAGS.difficulty = data.allowed_tags.difficulty || [];
            TAGS.cost = data.allowed_tags.cost || [];
            TAGS.language = data.allowed_tags.language || [];
        }

        allRecords = data.records || [];

        // Extract unique difficulty and cost as a fallback if not defined in allowed_tags
        if (TAGS.difficulty.length === 0 || TAGS.cost.length === 0) {
            let difficulties = new Set();
            let costs = new Set();
            allRecords.forEach(r => {
                if (r.difficulty && r.difficulty !== 'N/A') difficulties.add(r.difficulty);
                if (r.cost && r.cost !== 'N/A') costs.add(r.cost);
            });
            if (TAGS.difficulty.length === 0) TAGS.difficulty = Array.from(difficulties).sort();
            if (TAGS.cost.length === 0) TAGS.cost = Array.from(costs).sort();
        }

        // Detect Language & Fetch Target Locales
        const languageNames = {
            'en': '🌐 English (EN)', 'de': 'Deutsch (DE)', 'es': 'Español (ES)', 
            'it': 'Italiano (IT)', 'pl': 'Polski (PL)', 'fr': 'Français (FR)', 
            'he': 'עברית (HE)', 'ar': 'العربية (AR)', 'da': 'Dansk (DA)', 
            'ru': 'Русский (RU)', 'zh-CN': '简体中文 (ZH-CN)', 
            'zh-HK': '繁體中文 (ZH-HK)', 'en-pirate': 'English Pirate'
        };
        
        let detectedLang = 'en';
        const savedLang = localStorage.getItem('lang');
        const pathSegments = window.location.pathname.split('/').filter(Boolean);
        const pathLang = pathSegments.length > 0 && languageNames[pathSegments[0]] ? pathSegments[0] : null;

        if (pathLang) {
            detectedLang = pathLang;
            localStorage.setItem('lang', detectedLang);
        } else if (savedLang && languageNames[savedLang]) {
            detectedLang = savedLang;
        } else {
            const browserLang = navigator.language.split('-')[0].toLowerCase();
            if (languageNames[browserLang]) detectedLang = browserLang;
        }

        currentLang = detectedLang;

        // Redirect to localized subfolder if required
        if (currentLang !== 'en' && (window.location.pathname === '/' || window.location.pathname.endsWith('index.html'))) {
            if (window.location.protocol.startsWith('http')) {
                window.location.href = `/${currentLang.toLowerCase()}/` + window.location.hash + window.location.search;
                return; // Stop execution to redirect
            }
        }

        if (currentLang !== 'en') {
            try {
                const targetRes = await fetch(prefix + `locales/${currentLang.toLowerCase()}.yml`);
                if (targetRes.ok) {
                    const targetDict = jsyaml.load(await targetRes.text());
                    translations[currentLang] = Object.assign({}, enDict, targetDict || {});
                } else {
                    translations[currentLang] = enDict;
                }
            } catch (e) {
                console.warn(`Translation file locales/${currentLang.toLowerCase()}.yml missing, falling back to English.`);
                translations[currentLang] = enDict;
            }
        }

        setupI18n(languageNames);
        setupFilters();
        setupFuse();

        // Parse URL State before rendering
        loadStateFromURL();

        setupEventListeners();

        // Deep linking: Check if URL has hash to scroll to
        applyFiltersAndRender();

        // After initial render, process deep link
        if (window.location.hash) {
            setTimeout(() => {
                const targetId = window.location.hash.substring(1);
                // Temporarily disable filters if the target item exists but is filtered out
                const targetRecord = allRecords.find(r => r.id === targetId);
                if (targetRecord) {
                    clearAllFilters(); // Ensure it's visible by clearing filters
                    const element = document.getElementById(targetId);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        element.style.outline = '4px solid var(--primary-color)';
                        setTimeout(() => element.style.outline = 'none', 2000); // Remove highlight after 2s
                    }
                }
            }, 300); // Short delay to allow DOM to paint
        }
        
        // Launch Interactive Tour for First-time Visitors
        if (!localStorage.getItem('awesomeTourCompleted')) {
            setTimeout(initTour, 600);
        }

    } catch (error) {
        console.error("Error loading YAML data:", error);
        DOM.recordsContainer.innerHTML = `<p style="color: red;">Failed to load data. Please make sure data.yml and locales/en.yml exist and have valid YAML syntax.</p>`;
    }
}

// i18n Logic
function setupI18n(languageNames) {
    const langDropdown = document.getElementById('lang-dropdown');
    
    // Populate dropdown with available static languages
    if (langDropdown && languageNames) {
        langDropdown.innerHTML = '';
        for (const langKey in languageNames) {
            let displayName = languageNames[langKey] || langKey.toUpperCase();
            if (langKey === 'en-pirate') {
                displayName = '🏴‍☠️ ' + displayName;
            }
            const option = document.createElement('option');
            option.value = langKey;
            option.textContent = displayName;
            langDropdown.appendChild(option);
        }
    }

    // Set Dropdown state and attach change listener
    if (langDropdown) {
        langDropdown.value = currentLang;
        langDropdown.addEventListener('change', (e) => {
            const newLang = e.target.value;
            localStorage.setItem('lang', newLang);
            if (window.location.protocol.startsWith('http')) {
                const targetPath = newLang === 'en' ? '/' : `/${newLang.toLowerCase()}/`;
                window.location.href = targetPath + window.location.hash + window.location.search;
            } else {
                window.location.reload(); // Fallback for local file:// mode to reload the new JSON
            }
        });
    }

    // Apply strings to the shell once
    applyTranslationsDOM();
}

function applyTranslationsDOM() {
    if (!translations || !translations[currentLang]) return;
    const dict = translations[currentLang];

    // Set document direction for RTL support
    if (currentLang === 'ar' || currentLang === 'he') {
        document.documentElement.dir = 'rtl';
    } else {
        document.documentElement.dir = 'ltr';
    }

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) el.innerHTML = dict[key];
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (dict[key]) el.setAttribute('placeholder', dict[key]);
    });
}

function getTranslatedTag(tag, category) {
    if (category === 'machine' || !tag) return tag;
    const tagStr = String(tag);
    const key = 'tag_' + tagStr.toLowerCase().replace(/\s+/g, '_');
    const dict = translations[currentLang] || translations['en'] || {};
    return dict[key] || tagStr;
}

// Helper for URLs to ensure we don't accidentally treat hostnames as relative paths
function ensureAbsoluteUrl(url) {
    if (!url || url === '#') return '#';
    url = url.trim();
    if (/^(https?:\/\/|mailto:|tel:|tg:)/i.test(url)) {
        return url;
    }
    return 'https://' + url;
}

// Setup Header Info
function setupProjectInfo(info) {
    if (!info) return;
    const t = translations[currentLang] || translations['en'] || {};
    
    // Use translated strings if available, fallback to data.yml
    const titleText = t.ui_title || info.title;
    const descText = t.ui_subtitle || info.description;
    
    DOM.title.innerHTML = info.site_url ? `<a href="${ensureAbsoluteUrl(info.site_url)}" style="color: inherit; text-decoration: none;">${titleText}</a>` : titleText;
    DOM.description.textContent = descText;
    DOM.authorLink.href = ensureAbsoluteUrl(info.author_link);
    DOM.authorLink.textContent = t.ui_contact_author || `By ${info.author_name}`;
    DOM.repoLink.href = ensureAbsoluteUrl(info.repo_url);
    if (info.repo_text) {
        DOM.repoLink.textContent = t.ui_contribute || info.repo_text;
    }

    if (DOM.forumLink && info.forum_url) {
        DOM.forumLink.href = ensureAbsoluteUrl(info.forum_url);
        if (info.forum_text) {
            DOM.forumLink.textContent = t.ui_discuss || info.forum_text;
        }
    }

    DOM.headerBg.style.backgroundImage = `url('${info.hero_image}')`;

    // Dynamic Issue Template Linking for Submit Button
    const submitBtn = document.querySelector('a.submit-btn[data-i18n="ui_btn_submit"]');
    if (submitBtn && info.repo_url) {
        const templateMap = {
            'en': '01-submit-resource-en.yml',
            'ar': '02-submit-resource-ar.yml',
            'da': '03-submit-resource-da.yml',
            'de': '04-submit-resource-de.yml',
            'en-pirate': '05-submit-resource-en-pirate.yml',
            'es': '06-submit-resource-es.yml',
            'fr': '07-submit-resource-fr.yml',
            'he': '08-submit-resource-he.yml',
            'it': '09-submit-resource-it.yml',
            'pl': '10-submit-resource-pl.yml',
            'ru': '11-submit-resource-ru.yml',
            'zh-cn': '12-submit-resource-zh-cn.yml',
            'zh-hk': '13-submit-resource-zh-hk.yml'
        };
        const langKey = currentLang.toLowerCase();
        const templateFile = templateMap[langKey] || templateMap['en'];
        
        let baseRepo = info.repo_url;
        if (baseRepo.endsWith('/')) {
            baseRepo = baseRepo.slice(0, -1);
        }
        submitBtn.href = `${baseRepo}/issues/new?template=${templateFile}`;
    }
}

// Setup Checkbox Filters dynamically
function setupFilters() {
    createCheckboxGroup(DOM.filterMachine, 'machine', TAGS.machine);
    createCheckboxGroup(DOM.filterTool, 'tool', TAGS.tool);
    createCheckboxGroup(DOM.filterType, 'type', TAGS.type);
    createCheckboxGroup(DOM.filterOfficial, 'official', TAGS.official);
    createCheckboxGroup(DOM.filterDifficulty, 'difficulty', TAGS.difficulty);
    createCheckboxGroup(DOM.filterCost, 'cost', TAGS.cost);
    createCheckboxGroup(DOM.filterLanguage, 'language', TAGS.language);
}

function createCheckboxGroup(container, category, tags) {
    tags.forEach(tag => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-btn';
        btn.dataset.value = tag;
        btn.dataset.category = category;
        btn.textContent = getTranslatedTag(tag, category);

        btn.addEventListener('click', handleFilterClick);
        container.appendChild(btn);
    });
}

// Setup Fuse.js for searching
function setupFuse() {
    const options = {
        keys: [
            { name: 'title', weight: 4 },
            { name: 'description', weight: 2 },
            { name: 'author_name', weight: 1 },
            { name: 'tags.machine_type', weight: 1.5 },
            { name: 'tags.machine_tool_type', weight: 1.5 },
            { name: 'tags.record_type', weight: 1.5 },
            { name: 'tags.official_flag', weight: 1.5 },
            { name: 'tags.free_tags', weight: 2 },
            { name: 'difficulty', weight: 0.5 },
            { name: 'cost', weight: 0.5 },
            { name: 'links.label', weight: 1 },
            { name: 'links.link', weight: 0.5 }
        ],
        threshold: 0.3,
        ignoreLocation: true,
        useExtendedSearch: true,
        ignoreFieldNorm: false,
        includeScore: true
    };
    fuse = new Fuse(allRecords, options);
}

// Setup Event Listeners
function setupEventListeners() {
    DOM.searchInput.addEventListener('input', () => applyFiltersAndRender());
    DOM.sortSelect.addEventListener('change', () => applyFiltersAndRender());
    DOM.limitInput.addEventListener('input', () => applyFiltersAndRender());
    DOM.clearFiltersBtn.addEventListener('click', clearAllFilters);

    if (DOM.shareViewBtn) {
        DOM.shareViewBtn.addEventListener('click', () => {
            const url = window.location.href;
            const originalText = DOM.shareViewBtn.innerHTML;

            const triggerSuccess = () => {
                const originalBg = DOM.shareViewBtn.style.backgroundColor;
                const originalColor = DOM.shareViewBtn.style.color;
                const originalWidth = DOM.shareViewBtn.style.width;

                // Lock width before changing text so it doesn't jump
                DOM.shareViewBtn.style.width = DOM.shareViewBtn.offsetWidth + 'px';

                DOM.shareViewBtn.textContent = 'Copied!';
                DOM.shareViewBtn.style.backgroundColor = '#10b981';
                DOM.shareViewBtn.style.color = 'white';

                setTimeout(() => {
                    DOM.shareViewBtn.innerHTML = originalText;
                    DOM.shareViewBtn.style.backgroundColor = originalBg;
                    DOM.shareViewBtn.style.color = originalColor;
                    DOM.shareViewBtn.style.width = originalWidth; // Restore original width policy
                }, 2000);
            };

            if (navigator.clipboard) {
                navigator.clipboard.writeText(url).then(triggerSuccess).catch(err => console.error('Failed to copy link: ', err));
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = url;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                    triggerSuccess();
                } catch (err) {
                    console.error('Fallback clipboard copy failed', err);
                }
                document.body.removeChild(textArea);
            }
        });
    }

    if (DOM.showFavoritesBtn) {
        DOM.showFavoritesBtn.addEventListener('click', () => {
            const isActive = DOM.showFavoritesBtn.dataset.active === 'true';
            if (isActive) {
                DOM.showFavoritesBtn.dataset.active = 'false';
                DOM.showFavoritesBtn.classList.remove('primary-btn');
                DOM.showFavoritesBtn.classList.add('secondary-btn');
            } else {
                DOM.showFavoritesBtn.dataset.active = 'true';
                DOM.showFavoritesBtn.classList.remove('secondary-btn');
                DOM.showFavoritesBtn.classList.add('primary-btn');
            }
            applyFiltersAndRender();
        });
    }

    if (DOM.replayTourBtn) {
        DOM.replayTourBtn.addEventListener('click', () => {
            localStorage.removeItem('awesomeTourCompleted');
            clearAllFilters();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(initTour, 300);
        });
    }

    // Jump to top button
    window.addEventListener('scroll', () => {
        if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
            DOM.jumpTopBtn.style.display = "block";
        } else {
            DOM.jumpTopBtn.style.display = "none";
        }
    });

    DOM.jumpTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Theme Toggle Logic
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        // Check saved preference first
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        }

        themeBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            let newTheme;

            if (currentTheme === 'dark') {
                newTheme = 'light';
            } else if (currentTheme === 'light') {
                newTheme = 'dark';
            } else {
                // If no theme is set, check system preference
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                newTheme = prefersDark ? 'light' : 'dark';
            }

            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }
}

function handleFilterClick(e) {
    e.preventDefault();

    const btn = e.currentTarget;
    const category = btn.dataset.category;
    const value = btn.dataset.value;

    if (activeFilters[category].has(value)) {
        // State 1: Was Included -> Become Excluded
        activeFilters[category].delete(value);
        excludedFilters[category].add(value);
        btn.classList.remove('included');
        btn.classList.add('excluded');
    } else if (excludedFilters[category].has(value)) {
        // State 2: Was Excluded -> Become Neutral
        excludedFilters[category].delete(value);
        btn.classList.remove('excluded');
    } else {
        // State 0: Was Neutral -> Become Included
        activeFilters[category].add(value);
        btn.classList.add('included');
    }

    applyFiltersAndRender();
}

function clearAllFilters() {
    activeFilters.machine.clear();
    activeFilters.tool.clear();
    activeFilters.type.clear();
    activeFilters.official.clear();
    activeFilters.difficulty.clear();
    activeFilters.cost.clear();
    activeFilters.language.clear();

    excludedFilters.machine.clear();
    excludedFilters.tool.clear();
    excludedFilters.type.clear();
    excludedFilters.official.clear();
    excludedFilters.difficulty.clear();
    excludedFilters.cost.clear();
    excludedFilters.language.clear();

    document.querySelectorAll('.tag-filters button.filter-btn').forEach(btn => {
        btn.classList.remove('excluded');
        btn.classList.remove('included');
    });
    DOM.searchInput.value = '';
    DOM.sortSelect.value = 'newest';
    DOM.limitInput.value = '';

    if (DOM.showFavoritesBtn) {
        DOM.showFavoritesBtn.dataset.active = 'false';
        DOM.showFavoritesBtn.classList.remove('primary-btn');
        DOM.showFavoritesBtn.classList.add('secondary-btn');
    }

    applyFiltersAndRender();
}

// Main processing function
function applyFiltersAndRender() {
    let results = [...allRecords];
    const query = DOM.searchInput.value.trim();

    // 1. Search filtering
    if (query) {
        const searchResults = fuse.search(query);
        results = searchResults.map(result => result.item);
        
        // Auto-switch to relevance when searching
        if (DOM.sortSelect.value !== 'relevance') {
            DOM.sortSelect.value = 'relevance';
        }
    } else if (DOM.sortSelect.value === 'relevance') {
        // Revert to newest if search is cleared
        DOM.sortSelect.value = 'newest';
    }

    // 2. Tag Filtering (AND operation across categories, OR within categories)
    results = results.filter(record => {
        const t = record.tags || {};

        // Check Exclusions First
        const checkExclusion = (recordTags, excludedSet) => {
            if (excludedSet.size === 0 || !recordTags) return false;
            return recordTags.some(tag => excludedSet.has(tag));
        };
        const checkStringExclusion = (recordVal, excludedSet) => {
            if (excludedSet.size === 0 || !recordVal) return false;
            return excludedSet.has(recordVal);
        };

        if (
            checkExclusion(t.machine_type, excludedFilters.machine) ||
            checkExclusion(t.machine_tool_type, excludedFilters.tool) ||
            checkExclusion(t.record_type, excludedFilters.type) ||
            checkExclusion(t.official_flag, excludedFilters.official) ||
            checkStringExclusion(record.difficulty, excludedFilters.difficulty) ||
            checkStringExclusion(record.cost, excludedFilters.cost) ||
            checkStringExclusion(record.language, excludedFilters.language)
        ) {
            return false;
        }

        // Favorites Filter
        const showFavs = DOM.showFavoritesBtn && DOM.showFavoritesBtn.dataset.active === 'true';
        if (showFavs) {
            const savedFavorites = JSON.parse(localStorage.getItem('favorites') || '[]');
            if (!savedFavorites.includes(record.id)) return false;
        }

        // Machine Filter
        const machineMatch = activeFilters.machine.size === 0 ||
            (t.machine_type && t.machine_type.some(m => activeFilters.machine.has(m)));

        // Tool Filter
        const toolMatch = activeFilters.tool.size === 0 ||
            (t.machine_tool_type && t.machine_tool_type.some(tl => activeFilters.tool.has(tl)));

        // Type Filter
        const typeMatch = activeFilters.type.size === 0 ||
            (t.record_type && t.record_type.some(ty => activeFilters.type.has(ty)));

        // Official Filter
        const officialMatch = activeFilters.official.size === 0 ||
            (t.official_flag && t.official_flag.some(of => activeFilters.official.has(of)));

        // Difficulty Filter
        const diffMatch = activeFilters.difficulty.size === 0 ||
            (record.difficulty && activeFilters.difficulty.has(record.difficulty));

        // Cost Filter
        const costMatch = activeFilters.cost.size === 0 ||
            (record.cost && activeFilters.cost.has(record.cost));

        // Language Filter
        const languageMatch = activeFilters.language.size === 0 ||
            (record.language && activeFilters.language.has(record.language));

        return machineMatch && toolMatch && typeMatch && officialMatch && diffMatch && costMatch && languageMatch;
    });

    // 3. Sorting
    const sortOrder = DOM.sortSelect.value;
    if (sortOrder !== 'relevance') {
        results.sort((a, b) => {
            const dateA = new Date(a.date_added || 0);
            const dateB = new Date(b.date_added || 0);
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });
    }

    // 4. Limit count (Last N items)
    const limitStr = DOM.limitInput.value;
    const limit = parseInt(limitStr);
    if (!isNaN(limit) && limit > 0) {
        results = results.slice(0, limit);
    }

    const showFavs = DOM.showFavoritesBtn && DOM.showFavoritesBtn.dataset.active === 'true';
    updateURL(query, sortOrder, limitStr, showFavs);

    // Render resulting data
    renderRecords(results);
}

// URL State Management
function loadStateFromURL() {
    const params = new URLSearchParams(window.location.search);

    // Search
    if (params.has('q')) {
        DOM.searchInput.value = params.get('q');
    }
    // Sort
    if (params.has('sort')) {
        DOM.sortSelect.value = params.get('sort');
    }
    // Limit
    if (params.has('limit')) {
        DOM.limitInput.value = params.get('limit');
    }
    // Favorites
    if (params.has('fav') && params.get('fav') === 'true' && DOM.showFavoritesBtn) {
        DOM.showFavoritesBtn.dataset.active = 'true';
        DOM.showFavoritesBtn.classList.remove('secondary-btn');
        DOM.showFavoritesBtn.classList.add('primary-btn');
    }

    // Tags
    const categories = ['machine', 'tool', 'type', 'official', 'difficulty', 'cost', 'language'];
    categories.forEach(cat => {
        if (params.has('inc_' + cat)) {
            const vals = params.get('inc_' + cat).split('|');
            vals.forEach(v => activeFilters[cat].add(v));
        }
        if (params.has('exc_' + cat)) {
            const vals = params.get('exc_' + cat).split('|');
            vals.forEach(v => excludedFilters[cat].add(v));
        }
    });

    // Update the UI buttons to reflect the loaded state
    document.querySelectorAll('.tag-filters button.filter-btn').forEach(btn => {
        const cat = btn.dataset.category;
        const val = btn.dataset.value;
        if (activeFilters[cat] && activeFilters[cat].has(val)) {
            btn.classList.add('included');
        } else if (excludedFilters[cat] && excludedFilters[cat].has(val)) {
            btn.classList.add('excluded');
        }
    });
}

function updateURL(query, sortOrder, limitStr, showFavs) {
    const params = new URLSearchParams();

    if (query) params.set('q', query);
    if (sortOrder && sortOrder !== 'newest') params.set('sort', sortOrder);
    if (limitStr) params.set('limit', limitStr);
    if (showFavs) params.set('fav', 'true');

    const categories = ['machine', 'tool', 'type', 'official', 'difficulty', 'cost', 'language'];
    categories.forEach(cat => {
        if (activeFilters[cat].size > 0) {
            params.set('inc_' + cat, Array.from(activeFilters[cat]).join('|'));
        }
        if (excludedFilters[cat].size > 0) {
            params.set('exc_' + cat, Array.from(excludedFilters[cat]).join('|'));
        }
    });

    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
    window.history.replaceState(null, '', newUrl);
}

// Rendering Logic
function renderRecords(records) {
    const t = translations[currentLang] || translations['en'] || {};
    const itemsFoundTxt = t.ui_items_found || "items found";
    const itemFoundTxt = t.ui_item_found || "item found";
    const contentAuthorTxt = t.ui_content_author || "Content Author:";
    const addedTxt = t.ui_added || "Added:";
    const viewResourceTxt = t.ui_view_resource || "View Resource";
    DOM.resultCount.textContent = `${records.length} ${records.length !== 1 ? itemsFoundTxt : itemFoundTxt}`;
    DOM.recordsContainer.innerHTML = '';

    const savedFavorites = JSON.parse(localStorage.getItem('favorites') || '[]');

    if (records.length === 0) {
        DOM.recordsContainer.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--secondary-text);">No matching records found.</p>';
        return;
    }

    records.forEach(record => {
        const card = document.createElement('article');
        card.className = 'card';
        card.id = record.id;

        // Generate Tags HTML
        let tagsHtml = '';
        const t = record.tags || {};

        if (t.machine_type) t.machine_type.forEach(tag => tagsHtml += `<span class="tag machine">${tag}</span>`); // Do not translate
        if (t.machine_tool_type) t.machine_tool_type.forEach(tag => tagsHtml += `<span class="tag tool">${getTranslatedTag(tag, 'tool')}</span>`);
        if (t.record_type) t.record_type.forEach(tag => tagsHtml += `<span class="tag type">${getTranslatedTag(tag, 'type')}</span>`);

        if (t.official_flag) {
            t.official_flag.forEach(tag => {
                let tagClass = tag === 'UNOFFICIAL' ? 'unofficial' : tag.toLowerCase(); // it'll be 'official' or 'unofficial'
                tagsHtml += `<span class="tag ${tagClass}">${getTranslatedTag(tag, 'official')}</span>`;
            });
        }

        if (record.difficulty && record.difficulty !== 'N/A') tagsHtml += `<span class="tag difficulty">${getTranslatedTag(record.difficulty, 'difficulty')}</span>`;
        if (record.cost && record.cost !== 'N/A') tagsHtml += `<span class="tag cost">${getTranslatedTag(record.cost, 'cost')}</span>`;
        if (record.language && record.language !== 'N/A') tagsHtml += `<span class="tag language">${getTranslatedTag(record.language, 'language')}</span>`;

        if (t.free_tags) t.free_tags.forEach(tag => tagsHtml += `<span class="tag">${tag}</span>`); // Typically untranslated

        // Generate Buttons HTML
        let buttonsHtml = `<a href="${ensureAbsoluteUrl(record.original_link)}" class="btn primary-btn" target="_blank" rel="noopener noreferrer">${viewResourceTxt}</a>`;
        if (record.extra_buttons) {
            record.extra_buttons.forEach(btn => {
                buttonsHtml += `<a href="${ensureAbsoluteUrl(btn.link)}" class="btn secondary-btn" target="_blank" rel="noopener noreferrer">${btn.label}</a>`;
            });
        }

        let descHtml = '';
        if (record.description) {
            // Use marked.js to render markdown properly
            const parsedHtml = marked.parse(record.description);
            // Wrap the rendered markdown inside a container so we can control child tag margins via CSS
            descHtml = `<div class="card-description" style="color: var(--secondary-text);">${parsedHtml}</div>`;
        }

        // Deep link anchoring
        const anchorLink = `#${record.id}`;

        const isFav = savedFavorites.includes(record.id);
        const starClass = isFav ? 'favorite-btn is-active' : 'favorite-btn';

        card.innerHTML = `
                <div class="card-header">
                    <h3 class="card-title">
                        <button class="${starClass}" data-id="${record.id}" aria-label="Toggle Favorite" title="Bookmark this item">★</button>
                        <a href="${anchorLink}">${record.title}</a>
                        <button class="copy-link-btn" data-link="${window.location.origin}/r/${record.id}/" aria-label="Copy Share Link" title="Copy Share Link">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                        </button>
                    </h3>
                    <div class="card-meta">
                        ${contentAuthorTxt} <a href="${ensureAbsoluteUrl(record.author_link)}" target="_blank" rel="noopener noreferrer">${record.author_name}</a> | ${addedTxt} ${record.date_added}
                    </div>
                </div>
            ${descHtml}
            <div class="card-footer">
                <div class="card-tags">
                    ${tagsHtml}
                </div>
                <div class="card-actions">
                    ${buttonsHtml}
                </div>
            </div>
        `;

        DOM.recordsContainer.appendChild(card);
    });

    // Attach standard listeners to favorite buttons
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => toggleFavorite(e.currentTarget));
    });

    // Attach listeners to copy link buttons
    document.querySelectorAll('.copy-link-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const link = btn.dataset.link;

            const triggerSuccess = () => {
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '<span style="font-size:1.1rem;color:green;font-weight:bold;">&#x2713;</span>';
                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                }, 2000);
            };

            // Use modern clipboard API if available
            if (navigator.clipboard) {
                navigator.clipboard.writeText(link).then(triggerSuccess).catch(err => console.error('Failed to copy link: ', err));
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = link;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                    triggerSuccess();
                } catch (err) {
                    console.error('Fallback clipboard copy failed', err);
                }
                document.body.removeChild(textArea);
            }
        });
    });
}

function toggleFavorite(btnElement) {
    const id = btnElement.dataset.id;
    let savedFavorites = JSON.parse(localStorage.getItem('favorites') || '[]');

    if (savedFavorites.includes(id)) {
        savedFavorites = savedFavorites.filter(f => f !== id);
        btnElement.classList.remove('is-active');
        btnElement.setAttribute('aria-pressed', 'false');
    } else {
        savedFavorites.push(id);
        btnElement.classList.add('is-active');
        btnElement.setAttribute('aria-pressed', 'true');
    }

    localStorage.setItem('favorites', JSON.stringify(savedFavorites));
}

// UI Tour Animation Helpers
function simulateClickAnimation(element, callback) {
    if (!element) {
        if (callback) callback();
        return;
    }
    const originalTransition = element.style.transition;
    const originalTransform = element.style.transform;
    const originalFilter = element.style.filter;
    
    element.style.transition = 'transform 0.15s ease-in-out, filter 0.15s ease-in-out';
    element.style.transform = 'scale(0.9)';
    element.style.filter = 'brightness(0.8)';
    
    setTimeout(() => {
        element.style.transform = originalTransform;
        element.style.filter = originalFilter;
        setTimeout(() => {
            element.style.transition = originalTransition;
            if (callback) callback();
        }, 50);
    }, 150);
}

function simulateTypewriting(inputElement, text, callback) {
    if (!inputElement) return;
    inputElement.value = '';
    let i = 0;
    const interval = setInterval(() => {
        inputElement.value += text.charAt(i);
        i++;
        // Trigger input event so filters update dynamically
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        if (i >= text.length) {
            clearInterval(interval);
            if (callback) callback();
        }
    }, 120);
}

function initTour() {
    if (!window.driver) return; // safety net if CDN failed

    const dict = translations[currentLang] || translations['en'] || {};
    const t = (key) => dict[key] || key;

    const driverObj = window.driver.js.driver({
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],
        nextBtnText: t('tour_btn_next'),
        prevBtnText: t('tour_btn_prev'),
        doneBtnText: t('tour_btn_done'),
        closeBtnText: t('tour_btn_skip') || 'Skip',
        onHighlighted: () => {
            if (driverObj) {
                const state = driverObj.getState();
                const total = driverObj.getConfig().steps.length;
                const pct = ((state.activeIndex + 1) / total) * 100;
                const popover = document.querySelector('.driver-popover');
                if (popover) {
                    popover.style.setProperty('--progress-width', `${pct}%`);
                }
            }
        },
        onDestroyed: () => {
            localStorage.setItem('awesomeTourCompleted', 'true');
        },
        steps: [
            {
                popover: {
                    title: t('tour_step1_title'),
                    description: t('tour_step1_desc')
                },
                onHighlightStarted: () => {
                    clearAllFilters();
                }
            },
            {
                element: '#search-input',
                popover: {
                    title: t('tour_step2_title'),
                    description: t('tour_step2_desc'),
                    side: "bottom", 
                    align: 'start'
                },
                onHighlightStarted: () => {
                    clearAllFilters();
                    simulateTypewriting(DOM.searchInput, 'PAXX12', () => applyFiltersAndRender());
                }
            },
            {
                element: '#result-count',
                popover: {
                    title: t('tour_step2b_title') || 'Instant Results',
                    description: t('tour_step2b_desc') || 'The list updates instantly, showing exactly how many records match.',
                    side: "bottom", 
                    align: 'start'
                }
            },
            {
                element: '#paxx12-firmware-for-snapmaerk-u1-7',
                popover: {
                    title: t('tour_step2c_title') || 'Match Found',
                    description: t('tour_step2c_desc') || 'Here is the closest match to our search query!',
                    side: "top", 
                    align: 'start'
                }
            },
            {
                element: '#filter-machine button[data-value="U1"]',
                popover: {
                    title: t('tour_step3_title'),
                    description: t('tour_step3_desc'),
                    side: "bottom", 
                    align: 'start'
                },
                onPrevClick: () => {
                    clearAllFilters();
                    DOM.searchInput.value = 'PAXX12';
                    applyFiltersAndRender();
                    driverObj.movePrevious();
                },
                onHighlightStarted: () => {
                    // IDEMPOTENCY & SCROLL JUMP FIX
                    // Call clearAllFilters() directly. Using DOM.clearFiltersBtn.click() fires a literal href="#" anchor event, snapping the window to the top.
                    clearAllFilters();
                    window.scrollTo(0, 0);
                    
                    setTimeout(() => {
                        const u1Btn = document.querySelector('#filter-machine button[data-value="U1"]');
                        if (u1Btn && !u1Btn.classList.contains('included')) {
                            simulateClickAnimation(u1Btn, () => u1Btn.click());
                        }
                    }, 400);
                }
            },
            {
                element: '#filter-type button[data-value="FIRMWARE"]',
                popover: {
                    title: t('tour_step4_title'),
                    description: t('tour_step4_desc'),
                    side: "bottom", 
                    align: 'start'
                },
                onHighlightStarted: () => {
                    // Idempotent reset for back-button compatibility
                    clearAllFilters();
                    window.scrollTo(0, 0);
                    const u1Btn = document.querySelector('#filter-machine button[data-value="U1"]');
                    if (u1Btn) u1Btn.click();

                    setTimeout(() => {
                        const fwBtn = document.querySelector('#filter-type button[data-value="FIRMWARE"]');
                        if (fwBtn && !fwBtn.classList.contains('included')) {
                            simulateClickAnimation(fwBtn, () => fwBtn.click());
                        }
                    }, 400);
                }
            },
            {
                element: '#filter-machine',
                popover: {
                    title: t('tour_step5_title'),
                    description: t('tour_step5_desc'),
                    side: "bottom", 
                    align: 'start'
                },
                onHighlightStarted: () => {
                    clearAllFilters();
                    window.scrollTo(0, 0);
                    const u1Btn = document.querySelector('#filter-machine button[data-value="U1"]');
                    if (u1Btn) u1Btn.click();
                    const fwBtn = document.querySelector('#filter-type button[data-value="FIRMWARE"]');
                    if (fwBtn) fwBtn.click();

                    const machineBtns = document.querySelectorAll('#filter-machine .filter-btn');
                    let delay = 300;
                    machineBtns.forEach(btn => {
                        if (btn.dataset.value !== 'U1') {
                            if (!btn.classList.contains('excluded')) {
                                setTimeout(() => {
                                    simulateClickAnimation(btn, () => {
                                        btn.click(); // Select
                                        setTimeout(() => {
                                            simulateClickAnimation(btn, () => btn.click()); // Exclude
                                        }, 200);
                                    });
                                }, delay);
                                delay += 550; // Delay to accommodate double-click animation duration
                            }
                        }
                    });
                }
            },
            {
                element: '#paxx12-firmware-for-snapmaerk-u1-7',
                popover: {
                    title: t('tour_step5b_title') || 'Finding with Tags',
                    description: t('tour_step5b_desc') || 'By combining inclusions and exclusions, we have isolated the exact same PAXX12 firmware record without typing!',
                    side: "top", 
                    align: 'start'
                }
            },
            {
                element: '#paxx12-firmware-for-snapmaerk-u1-7 .favorite-btn',
                popover: {
                    title: t('tour_step6_title') || 'Save Favorites',
                    description: t('tour_step6_desc') || 'Click the ★ on any resource to securely save it to your local device.',
                    side: "top", 
                    align: 'start'
                },
                onHighlightStarted: () => {
                    setTimeout(() => {
                        const firstStar = document.querySelector('#paxx12-firmware-for-snapmaerk-u1-7 .favorite-btn');
                        if (firstStar && !firstStar.classList.contains('is-active')) {
                            simulateClickAnimation(firstStar, () => firstStar.click());
                        }
                    }, 400);
                }
            },
            {
                element: '#show-favorites',
                popover: {
                    title: t('tour_step6b_title') || 'View Favorites',
                    description: t('tour_step6b_desc') || "Then, click '★ Show Favorites' up here to filter the entire list down to just your saved items.",
                    side: "bottom", 
                    align: 'start'
                },
                onPrevClick: () => {
                    clearAllFilters();
                    const u1Btn = document.querySelector('#filter-machine button[data-value="U1"]');
                    if (u1Btn) u1Btn.click();
                    const fwBtn = document.querySelector('#filter-type button[data-value="FIRMWARE"]');
                    if (fwBtn) fwBtn.click();
                    driverObj.movePrevious();
                },
                onHighlightStarted: () => {
                    const fwBtn = document.querySelector('#filter-type button[data-value="FIRMWARE"]');
                    if (fwBtn && fwBtn.classList.contains('included')) {
                        // Ensure we use internal method to avoid href="#" window jump backwards
                        clearAllFilters(); 
                    }

                    setTimeout(() => {
                        if (DOM.showFavoritesBtn.dataset.active !== 'true') {
                            simulateClickAnimation(DOM.showFavoritesBtn, () => DOM.showFavoritesBtn.click());
                        }
                    }, 400);
                }
            },
            {
                element: '#share-view-btn',
                popover: {
                    title: t('tour_step7_title'),
                    description: t('tour_step7_desc'),
                    side: "bottom", 
                    align: 'start'
                },
                onHighlightStarted: () => {
                    setTimeout(() => {
                        if (DOM.shareViewBtn) {
                            simulateClickAnimation(DOM.shareViewBtn, () => DOM.shareViewBtn.click());
                        }
                    }, 400);
                }
            },
            {
                element: '#paxx12-firmware-for-snapmaerk-u1-7 .copy-link-btn',
                popover: {
                    title: t('tour_step8_title'),
                    description: t('tour_step8_desc'),
                    side: "top", 
                    align: 'start'
                },
                onHighlightStarted: () => {
                    setTimeout(() => {
                        const btn = document.querySelector('#paxx12-firmware-for-snapmaerk-u1-7 .copy-link-btn');
                        if (btn) simulateClickAnimation(btn, () => btn.click());
                    }, 400);
                }
            },
            {
                element: '#clear-filters',
                popover: {
                    title: t('tour_step9_title') || 'Clear Filters',
                    description: t('tour_step9_desc') || "You can quickly reset your view and see all resources by clicking 'Clear All Filters'. Enjoy exploring the list!",
                    side: "bottom",
                    align: 'start'
                },
                onPrevClick: () => {
                    clearAllFilters();
                    if (DOM.showFavoritesBtn && DOM.showFavoritesBtn.dataset.active !== 'true') {
                        DOM.showFavoritesBtn.click();
                    }
                    driverObj.movePrevious();
                },
                onHighlightStarted: () => {
                    setTimeout(() => {
                        if (DOM.clearFiltersBtn) {
                            // Call internal clearAllFilters() instead of .click() to prevent href="#" native window jumps
                            simulateClickAnimation(DOM.clearFiltersBtn, () => {
                                clearAllFilters();
                                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 2000);
                            });
                        }
                    }, 400);
                }
            }
        ]
    });

    driverObj.drive();
}

// Start application
document.addEventListener('DOMContentLoaded', init);
