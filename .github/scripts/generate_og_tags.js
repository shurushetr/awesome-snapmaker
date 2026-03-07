const fs = require('fs');
const jsyaml = require('js-yaml');
const path = require('path');

const dataFile = path.join(__dirname, '..', 'data.yml');
const indexFile = path.join(__dirname, '..', 'index.html');

try {
    const fileContents = fs.readFileSync(dataFile, 'utf8');
    const data = jsyaml.load(fileContents);
    const info = data.project_info;

    // We'll calculate total resources from data.yml to embed in the description
    const totalResources = data.records ? data.records.length : 0;
    const dynamicDescription = `${info.description} Currently tracking ${totalResources} awesome mods, tools, and guides.`;

    // Read the current index.html
    let htmlContent = fs.readFileSync(indexFile, 'utf8');

    // The Open Graph meta tags to inject
    const ogTags = `
    <!-- Auto-Generated Open Graph Meta Tags -->
    <meta property="og:title" content="${info.title}">
    <meta property="og:description" content="${dynamicDescription}">
    <meta property="og:image" content="${info.repo_url}/raw/main/images/hero_img.webp">
    <meta property="og:url" content="${info.repo_url}">
    <meta property="og:type" content="website">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${info.title}">
    <meta name="twitter:description" content="${dynamicDescription}">
    <meta name="twitter:image" content="${info.repo_url}/raw/main/images/hero_img.webp">
    <!-- End Auto-Generated Meta Tags -->
</head>`;

    // Replace the closing </head> with our tags + </head>
    // First, remove old tags if they exist to prevent duplicates on multiple runs
    htmlContent = htmlContent.replace(/[\s\S]*?<!-- Auto-Generated Open Graph Meta Tags -->[\s\S]*?<!-- End Auto-Generated Meta Tags -->[\s\S]*?<\/head>/m, '</head>');
    htmlContent = htmlContent.replace('</head>', ogTags);

    fs.writeFileSync(indexFile, htmlContent, 'utf8');
    console.log('✅ Successfully injected SEO Open Graph meta tags into index.html');

} catch (e) {
    console.error('❌ Failed to inject Open Graph tags:', e);
    process.exit(1);
}
