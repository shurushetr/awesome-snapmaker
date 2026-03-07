// Global State
let allRecords = [];
let fuse;
let activeFilters = {
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
    resultCount: document.getElementById('result-count'),
    jumpTopBtn: document.getElementById('jump-top')
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
        const response = await fetch('data.yml');
        if (!response.ok) throw new Error('Network response was not ok');
        const yamlText = await response.text();
        const data = jsyaml.load(yamlText);

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
        
        setupFilters();
        setupFuse();
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
        
    } catch (error) {
        console.error("Error loading YAML data:", error);
        DOM.recordsContainer.innerHTML = `<p style="color: red;">Failed to load data. Please make sure data.yml exists and is valid.</p>`;
    }
}

// Setup Header Info
function setupProjectInfo(info) {
    if (!info) return;
    DOM.title.textContent = info.title;
    DOM.description.textContent = info.description;
    DOM.authorLink.href = info.author_link;
    DOM.authorLink.textContent = `By ${info.author_name}`;
    DOM.repoLink.href = info.repo_url;
    DOM.headerBg.style.backgroundImage = `url('${info.hero_image}')`;
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
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = tag;
        checkbox.dataset.category = category;
        checkbox.addEventListener('change', handleFilterChange);
        
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(tag));
        container.appendChild(label);
    });
}

// Setup Fuse.js for searching
function setupFuse() {
    const options = {
        keys: [
            'title',
            'author_name',
            'tags.machine_type',
            'tags.machine_tool_type',
            'tags.record_type',
            'tags.official_flag',
            'tags.free_tags',
            'difficulty',
            'cost'
        ],
        threshold: 0.3,
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

function handleFilterChange(e) {
    const category = e.target.dataset.category;
    const value = e.target.value;
    const checked = e.target.checked;
    
    if (checked) {
        activeFilters[category].add(value);
    } else {
        activeFilters[category].delete(value);
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
    
    document.querySelectorAll('.tag-filters input[type="checkbox"]').forEach(cb => cb.checked = false);
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
    }

    // 2. Tag Filtering (AND operation across categories, OR within categories)
    results = results.filter(record => {
        const t = record.tags || {};
        
        // Favorites Filter
        const showFavs = DOM.showFavoritesBtn && DOM.showFavoritesBtn.dataset.active === 'true';
        if (showFavs) {
            const savedFavorites = JSON.parse(localStorage.getItem('favorites') || '[]');
            if (!savedFavorites.includes(record.id)) return false;
        }
        
        // Machine Filter: if no machine filters active, it passes. If active, the record MUST have at least one of the active machine tags.
        const machineMatch = activeFilters.machine.size === 0 || 
            (t.machine_type && t.machine_type.some(m => activeFilters.machine.has(m)));
            
        // Tool Filter: if no tool filters active, it passes. If active, the record MUST have at least one of the active tool tags.
        const toolMatch = activeFilters.tool.size === 0 || 
            (t.machine_tool_type && t.machine_tool_type.some(tl => activeFilters.tool.has(tl)));
            
        // Type Filter: if no type filters active, it passes. If active, the record MUST have at least one of the active type tags.
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
            (t.language && t.language.some(lang => activeFilters.language.has(lang)));

        // Free Tags / Flags Filter: if we add free tags filtering later

        return machineMatch && toolMatch && typeMatch && officialMatch && diffMatch && costMatch && languageMatch;
    });

    // 3. Sorting
    const sortOrder = DOM.sortSelect.value;
    results.sort((a, b) => {
        const dateA = new Date(a.date_added || 0);
        const dateB = new Date(b.date_added || 0);
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    // 4. Limit count (Last N items)
    const limit = parseInt(DOM.limitInput.value);
    if (!isNaN(limit) && limit > 0) {
        results = results.slice(0, limit);
    }

    // Render resulting data
    renderRecords(results);
}

// Rendering Logic
function renderRecords(records) {
    DOM.resultCount.textContent = `${records.length} item${records.length !== 1 ? 's' : ''} found`;
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
        
        if (t.machine_type) t.machine_type.forEach(tag => tagsHtml += `<span class="tag machine">${tag}</span>`);
        if (t.machine_tool_type) t.machine_tool_type.forEach(tag => tagsHtml += `<span class="tag tool">${tag}</span>`);
        if (t.record_type) t.record_type.forEach(tag => tagsHtml += `<span class="tag type">${tag}</span>`);
        
        if (t.official_flag) {
            t.official_flag.forEach(tag => {
                let tagClass = tag === 'UNOFFICIAL' ? 'unofficial' : tag.toLowerCase(); // it'll be 'official' or 'unofficial'
                tagsHtml += `<span class="tag ${tagClass}">${tag}</span>`;
            });
        }
        
        if (record.difficulty && record.difficulty !== 'N/A') tagsHtml += `<span class="tag difficulty">${record.difficulty}</span>`;
        if (record.cost && record.cost !== 'N/A') tagsHtml += `<span class="tag cost">${record.cost}</span>`;
        if (t.language) t.language.forEach(tag => tagsHtml += `<span class="tag language">${tag}</span>`);
        
        if (t.free_tags) t.free_tags.forEach(tag => tagsHtml += `<span class="tag">${tag}</span>`);

        // Generate Buttons HTML
        let buttonsHtml = `<a href="${record.original_link}" class="btn primary-btn" target="_blank" rel="noopener noreferrer">View Resource</a>`;
        if (record.extra_buttons) {
            record.extra_buttons.slice(0, 2).forEach(btn => {
                buttonsHtml += `<a href="${btn.link}" class="btn secondary-btn" target="_blank" rel="noopener noreferrer">${btn.label}</a>`;
            });
        }
        
        let descHtml = '';
        if (record.description) {
            descHtml = `<div class="card-description"><p style="margin-bottom: 0px; margin-top: 10px; color: var(--secondary-text);">${record.description}</p></div>`;
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
                        <button class="copy-link-btn" data-link="${window.location.origin}${window.location.pathname}${anchorLink}" aria-label="Copy Share Link" title="Copy Share Link">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                        </button>
                    </h3>
                    <div class="card-meta">
                        Content Author: <a href="${record.author_link}" target="_blank" rel="noopener noreferrer">${record.author_name}</a> | Added: ${record.date_added}
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
            const link = e.currentTarget.dataset.link;
            
            const triggerSuccess = () => {
                const originalHtml = e.currentTarget.innerHTML;
                e.currentTarget.innerHTML = '<span style="font-size:1.1rem;color:green;font-weight:bold;">✓</span>';
                setTimeout(() => {
                    e.currentTarget.innerHTML = originalHtml;
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

// Start application
document.addEventListener('DOMContentLoaded', init);
