"""
generate_localized_pages.py

This script generates language-specific static HTML shells for the Awesome Snapmaker List during GitHub Actions deployment.
It reads the base HTML template (`index.html`) and applies translations dynamically from the `locales/` directory.
"""

import os
import re
from ruamel.yaml import YAML
import shutil

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOCALES_DIR = os.path.join(BASE_DIR, 'locales')
INDEX_FILE = os.path.join(BASE_DIR, 'index.html')

def load_yaml(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return YAML(typ='safe').load(f)

def replace_placeholder(match, replacement):
    tag = match.group(0)
    tag = re.sub(r'placeholder="[^"]+"', f'placeholder="{replacement}"', tag)
    return tag

def replace_inner(match, replacement):
    return match.group(1) + replacement + match.group(3)

def generate_pages():
    import glob
    if not os.path.exists(LOCALES_DIR):
        print("No locales folder found, skipping.")
        return

    en_file = os.path.join(LOCALES_DIR, 'en.yml')
    if not os.path.exists(en_file):
        print("Base en.yml not found.")
        return
        
    en_dict = load_yaml(en_file)

    with open(INDEX_FILE, 'r', encoding='utf-8') as f:
        html_template = f.read()

    for locale_file in glob.glob(os.path.join(LOCALES_DIR, '*.yml')):
        lang_code = os.path.basename(locale_file).split('.')[0]
        if lang_code == 'en':
            continue # English is root index.html

        print(f"Generating localized page for: {lang_code}")
        dict_vals = en_dict.copy()
        dict_vals.update(load_yaml(locale_file) or {})
        lang_html = html_template
        
        # Update <html lang="en"> to <html lang="xx">
        lang_html = re.sub(r'<html lang="en">', f'<html lang="{lang_code}">', lang_html)
        
        # Rewrite asset paths to properly resolve relatively from their subdirectories.
        lang_html = re.sub(r'href="(styles\.css|favicon\.ico)"', r'href="../\1"', lang_html)
        lang_html = re.sub(r'src="(app\.js)"', r'src="../\1"', lang_html)
        
        # Inject metadata tag so app.js knows to fetch data.yml from parent directory
        lang_html = re.sub(r'<head>', '<head>\n    <meta name="is-localized" content="true">', lang_html)
        
        for key, text in dict_vals.items():
            if not isinstance(text, str):
                text = str(text)

            # Replace inner HTML of elements with data-i18n tag
            pattern_inner = re.compile(rf'(<[^>]+data-i18n="{key}"[^>]*>)(.*?)(</[^>]+>)', re.IGNORECASE | re.DOTALL)
            lang_html = pattern_inner.sub(lambda m, rep=text: replace_inner(m, rep), lang_html)

            # Replace placeholder attribute of elements with data-i18n-placeholder tag
            pattern_ph = re.compile(rf'<[^>]+data-i18n-placeholder="{key}"[^>]*>', re.IGNORECASE)
            lang_html = pattern_ph.sub(lambda m, rep=text: replace_placeholder(m, rep), lang_html)
            
        out_dir = os.path.join(BASE_DIR, lang_code)
        os.makedirs(out_dir, exist_ok=True)
        out_file = os.path.join(out_dir, 'index.html')
        
        # In GitHub Actions, we could be building directly to a deployment artifact folder,
        # but for now we generate in-place in the repo root so actions/upload-pages-artifact picks it up.
        with open(out_file, 'w', encoding='utf-8') as f:
            f.write(lang_html)
            
        print(f"Saved: {out_file}")

if __name__ == "__main__":
    generate_pages()
