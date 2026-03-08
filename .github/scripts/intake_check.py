"""
intake_check.py

This script operates as a preliminary check when a user opens a new Issue via the `1-submit-resource.yml` template to submit a resource.
It extracts the provided "Content Link" and normalizes it by removing queries, trailing slashes, and `www.` prefixes. It then checks if the resource already exists in `data.yml`.
If a duplicate is found, the workflow uses this script's output to auto-comment and close the issue.
"""

import os
import sys
from ruamel.yaml import YAML
import re
from urllib.parse import urlparse, urlunparse

def normalize_url(url):
    """
    Normalizes a URL by converting to lowercase, stripping trailing slashes,
    removing www., and dropping query parameters/fragments (which are often
    used for tracking, e.g. ?u=...).
    """
    if not url:
        return ""
        
    # Basic cleanup
    url = url.strip().lower()
    
    # Ensure it has a scheme so urlparse works correctly
    if not url.startswith('http://') and not url.startswith('https://'):
        url = 'https://' + url
        
    parsed = urlparse(url)
    
    # Remove 'www.' from domain
    netloc = parsed.netloc
    if netloc.startswith('www.'):
        netloc = netloc[4:]
        
    # Reconstruct the core URL (scheme, domain, path) dropping params/queries/fragments
    core_url = urlunparse((parsed.scheme, netloc, parsed.path, '', '', ''))
    
    # Strip trailing slash for consistency
    return core_url.rstrip('/')

def parse_issue_for_url(body):
    """Extracts the 'Content Link (Original URL)' from the issue body robustly."""
    lines = body.split('\n')
    current_label = None
    aggregated_value = []
    
    sections = {}

    for line in lines:
        match = re.search(r'^###\s+(.+)$', line.strip())
        if match:
            if current_label:
                sections[current_label] = '\n'.join(aggregated_value).strip()
            current_label = match.group(1).lower().strip()
            aggregated_value = []
        elif current_label:
            aggregated_value.append(line)
            
    if current_label:
        sections[current_label] = '\n'.join(aggregated_value).strip()
        
    for label, value in sections.items():
        if value == "_No response_" or not value:
            continue
        if "content link" in label or "original url" in label:
            return value
            
    return None

def check_for_executable(url):
    """Checks if the URL points directly to an executable file."""
    if not url:
        return False
    parsed = urlparse(url)
    exts = ('.exe', '.msi', '.bat', '.cmd', '.sh', '.vbs', '.scr', '.dmg', '.pkg', '.apk')
    return parsed.path.lower().endswith(exts)

def check_for_duplicates(new_url, data_file='data.yml'):
    """Checks if the normalized new_url exists in the data.yml file."""
    if not new_url:
        return False, None
        
    norm_new = normalize_url(new_url)
    if not norm_new:
        return False, None

    try:
        yaml = YAML(typ='safe')
        with open(data_file, 'r', encoding='utf-8') as f:
            data = yaml.load(f)
    except Exception as e:
        print(f"Error reading data.yml: {e}")
        # Fail open (assume not duplicate if file cant be read)
        return False, None

    records = data.get('records', [])
    for record in records:
        existing_url = record.get('original_link', '')
        if not existing_url:
            continue
            
        if normalize_url(existing_url) == norm_new:
            return True, record.get('id', '')

    return False, None

def main():
    issue_body = os.environ.get('ISSUE_BODY', '')
    if not issue_body:
        print("UNIQUE") # Fallback to unique if no body
        sys.exit(0)
        
    submitted_url = parse_issue_for_url(issue_body)
    
    if not submitted_url:
        print("UNIQUE") # Can't check if there's no URL
        sys.exit(0)
        
    if check_for_executable(submitted_url):
        print("REJECT_EXECUTABLE")
        sys.exit(0)
        
    is_duplicate, existing_id = check_for_duplicates(submitted_url)
    
    if is_duplicate:
        # Output is read by bash script in the GitHub Action
        print("DUPLICATE")
        print(existing_id)
    else:
        print("UNIQUE")

if __name__ == '__main__':
    main()
