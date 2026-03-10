/**
 * generate_og_tags.js
 * 
 * This script modifies `index.html` to inject dynamic Open Graph and Twitter Card 
 * SEO meta tags. It reads the total record count and site information from `data.yml` 
 * to provide highly relevant link previews on social media (e.g. "Currently tracking X mods...").
 */

const fs = require('fs');
const jsyaml = require('js-yaml');
const path = require('path');

const dataFile = path.join(__dirname, '..', '..', 'data.yml');
const indexFile = path.join(__dirname, '..', '..', 'index.html');

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
    <meta property="og:image" content="https://awesome-sm-list.xyz/images/AwesomeList_TopImage.jpg">
    <meta property="og:url" content="https://awesome-sm-list.xyz/">
    <meta property="og:type" content="website">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${info.title}">
    <meta name="twitter:description" content="${dynamicDescription}">
    <meta name="twitter:image" content="https://awesome-sm-list.xyz/images/AwesomeList_TopImage.jpg">
    <!-- End Auto-Generated Meta Tags -->
</head>`;

    // Replace the closing </head> with our tags + </head>
    // First, safely remove old tags if they exist to prevent duplicates on multiple runs
    const regex = /[\s]*<!-- Auto-Generated Open Graph Meta Tags -->([\s\S]*?)<!-- End Auto-Generated Meta Tags -->[\s]*/;
    if (regex.test(htmlContent)) {
        htmlContent = htmlContent.replace(regex, '\n    ');
    }
    
    htmlContent = htmlContent.replace('</head>', ogTags);

    fs.writeFileSync(indexFile, htmlContent, 'utf8');
    console.log('✅ Successfully injected SEO Open Graph meta tags into index.html');

} catch (e) {
    console.error('❌ Failed to inject Open Graph tags:', e);
    process.exit(1);
}
