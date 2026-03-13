import os
import re
from ruamel.yaml import YAML
import html

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_FILE = os.path.join(BASE_DIR, 'data.yml')
R_DIR = os.path.join(BASE_DIR, 'r')

DEFAULT_IMAGE = "https://awesome-sm-list.xyz/images/AwesomeList_TopImage.jpg"

def load_yaml(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return YAML(typ='safe').load(f)

def clean_description(markdown_text):
    if not markdown_text:
        return "Awesome Snapmaker Resource"
    # Remove images
    text = re.sub(r'!\[.*?\]\((.*?)\)', '', markdown_text)
    # Remove html tags
    text = re.sub(r'<[^>]+>', '', text)
    # Remove markdown links but keep text
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    # Remove bold/italics
    text = re.sub(r'[\*_]{1,3}([^\*_]+)[\*_]{1,3}', r'\1', text)
    # Remove newlines
    text = text.replace('\n', ' ').strip()
    text = re.sub(r'\s+', ' ', text)
    # Truncate
    if len(text) > 160:
        text = text[:157] + '...'
    return text

def extract_image(markdown_text):
    if not markdown_text:
        return DEFAULT_IMAGE
    
    # Match ![alt](url)
    img_match = re.search(r'!\[.*?\]\((.*?)\)', markdown_text)
    if img_match:
        url = img_match.group(1).split()[0] # clean up potential title attributes
        return url
    
    # Match <img src="url">
    html_match = re.search(r'<img[^>]+src=["\'](.*?)["\']', markdown_text, re.IGNORECASE)
    if html_match:
        return html_match.group(1)

    return DEFAULT_IMAGE

def generate_record_pages():
    if not os.path.exists(DATA_FILE):
        print("data.yml not found.")
        return

    data = load_yaml(DATA_FILE)
    records = data.get('records', [])
    
    if not records:
        print("No records found.")
        return

    os.makedirs(R_DIR, exist_ok=True)

    for record in records:
        rid = record.get('id')
        if not rid:
            continue
            
        title = record.get('title', 'Unknown Resource')
        raw_desc = record.get('description', '')
        
        clean_desc = clean_description(raw_desc)
        img_url = extract_image(raw_desc)
        
        # Escape for HTML attributes
        safe_title = html.escape(title, quote=True)
        safe_desc = html.escape(clean_desc, quote=True)
        safe_img = html.escape(img_url, quote=True)
        
        # Generate HTML
        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{safe_title} - Awesome Snapmaker List</title>
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="{safe_title}">
    <meta property="og:description" content="{safe_desc}">
    <meta property="og:image" content="{safe_img}">
    <meta property="og:url" content="https://awesome-sm-list.xyz/r/{rid}/">
    <meta property="og:type" content="website">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{safe_title}">
    <meta name="twitter:description" content="{safe_desc}">
    <meta name="twitter:image" content="{safe_img}">
</head>
<body>
    <p>Redirecting to <a href="/#{rid}">{safe_title}</a>...</p>
    <script>
        window.location.replace("/#{rid}");
    </script>
</body>
</html>"""

        out_dir = os.path.join(R_DIR, rid)
        os.makedirs(out_dir, exist_ok=True)
        out_file = os.path.join(out_dir, 'index.html')
        
        with open(out_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
            
    print(f"[SUCCESS] Generated {len(records)} Open Graph redirect pages in /r/")

if __name__ == "__main__":
    generate_record_pages()
