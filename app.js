// Global State
let allRecords = [];
let fuse;
let activeFilters = {
    machine: new Set(),
    tool: new Set(),
    type: new Set()
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
    clearFiltersBtn: document.getElementById('clear-filters'),
    resultCount: document.getElementById('result-count'),
    jumpTopBtn: document.getElementById('jump-top')
};

// Available Tags (Based on Schema)
const TAGS = {
    machine: ["SM_2.0", "Artisan", "U1", "J1", "RAY", "Universal"],
    tool: ["FDM", "LASER", "CNC", "ROTARY", "COMBINED"],
    type: ["Watch", "Discuss", "Read", "Download", "Shop"]
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
        }

        allRecords = data.records || [];
        
        setupFilters();
        setupFuse();
        setupEventListeners();
        
        // Deep linking: Check if URL has hash to scroll to
        applyFiltersAndRender();
        
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
            'tags.free_tags'
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
    DOM.clearFiltersBtn.addEventListener('click', clearAllFilters);
    
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
}

function handleFilterChange(e) {
    const { category, value, checked } = e.target;
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
    
    document.querySelectorAll('.tag-filters input[type="checkbox"]').forEach(cb => cb.checked = false);
    DOM.searchInput.value = '';
    DOM.sortSelect.value = 'newest';
    
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

    // 2. Tag Filtering (AND operation within categories, OR across)
    results = results.filter(record => {
        const t = record.tags || {};
        const machineMatch = activeFilters.machine.size === 0 || 
            (t.machine_type && t.machine_type.some(m => activeFilters.machine.has(m)));
            
        const toolMatch = activeFilters.tool.size === 0 || 
            (t.machine_tool_type && t.machine_tool_type.some(tl => activeFilters.tool.has(tl)));
            
        const typeMatch = activeFilters.type.size === 0 || 
            (t.record_type && t.record_type.some(ty => activeFilters.type.has(ty)));

        return machineMatch && toolMatch && typeMatch;
    });

    // 3. Sorting
    const sortOrder = DOM.sortSelect.value;
    results.sort((a, b) => {
        const dateA = new Date(a.date_added || 0);
        const dateB = new Date(b.date_added || 0);
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    // Render resulting data
    renderRecords(results);
}

// Rendering Logic
function renderRecords(records) {
    DOM.resultCount.textContent = `${records.length} item${records.length !== 1 ? 's' : ''} found`;
    DOM.recordsContainer.innerHTML = '';

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
        if (t.free_tags) t.free_tags.forEach(tag => tagsHtml += `<span class="tag">${tag}</span>`);

        // Generate Buttons HTML
        let buttonsHtml = `<a href="${record.original_link}" class="btn primary-btn" target="_blank" rel="noopener noreferrer">View Original</a>`;
        if (record.extra_buttons) {
            record.extra_buttons.slice(0, 2).forEach(btn => {
                buttonsHtml += `<a href="${btn.link}" class="btn secondary-btn" target="_blank" rel="noopener noreferrer">${btn.label}</a>`;
            });
        }
        
        // Deep link anchoring
        const anchorLink = `#${record.id}`;

        card.innerHTML = `
            <div class="card-header">
                <h3 class="card-title"><a href="${anchorLink}">${record.title}</a></h3>
                <div class="card-meta">
                    Added: ${record.date_added} | By <a href="${record.author_link}" target="_blank" rel="noopener noreferrer">${record.author_name}</a>
                    <br>
                    Difficulty: ${record.difficulty || 'N/A'} | Cost: ${record.cost || 'N/A'}
                </div>
            </div>
            <div class="card-tags">
                ${tagsHtml}
            </div>
            <div class="card-actions">
                ${buttonsHtml}
            </div>
        `;

        DOM.recordsContainer.appendChild(card);
    });

    // Handle deep linking hash scroll after render
    if (window.location.hash) {
        setTimeout(() => {
            const el = document.querySelector(window.location.hash);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }
}

// Start application
document.addEventListener('DOMContentLoaded', init);
