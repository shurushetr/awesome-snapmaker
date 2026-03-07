import os
import sys
import yaml
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
    """Extracts the 'Content Link (Original URL)' from the issue body."""
    sections = re.split(r'###\s+(.+)\n', body)
    for i in range(1, len(sections), 2):
        label = sections[i].strip().lower()
        value = sections[i+1].strip() if i+1 < len(sections) else ""
        if value == "_No response_":
            value = ""
            
        if "content link" in label or "original url" in label:
            return value
    return None

def check_for_duplicates(new_url, data_file='data.yml'):
    """Checks if the normalized new_url exists in the data.yml file."""
    if not new_url:
        return False, None
        
    norm_new = normalize_url(new_url)
    if not norm_new:
        return False, None

    try:
        with open(data_file, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
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
        
    is_duplicate, existing_id = check_for_duplicates(submitted_url)
    
    if is_duplicate:
        # Output is read by bash script in the GitHub Action
        print("DUPLICATE")
        print(existing_id)
    else:
        print("UNIQUE")

if __name__ == '__main__':
    main()
