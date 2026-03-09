"""
intake_check.py

This script operates as a preliminary check when a user opens a new Issue via the `1-submit-resource.yml` template to submit a resource.
It extracts the provided "Content Link" and normalizes it by removing queries, trailing slashes, and `www.` prefixes. It then checks if the resource already exists in `data.yml`.
If a duplicate is found, the workflow uses this script's output to auto-comment and close the issue.
"""

import os
import sys
import json
import subprocess
from ruamel.yaml import YAML
import re
from urllib.parse import urlparse
from url_utils import normalize_url

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

def check_for_duplicate_issues(new_url):
    """Checks if there's an existing open issue with the same normalized URL."""
    if not new_url:
        return False, None
        
    norm_new = normalize_url(new_url)
    if not norm_new:
        return False, None
        
    try:
        # Fetch open issues with pending-content-review or pending-review label
        # We check both to be safe during the transition
        cmd = ['gh', 'issue', 'list', '--state', 'open', '--json', 'number,body', '--limit', '100']
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        issues = json.loads(result.stdout)
        
        for issue in issues:
            # We skip comparing against the current issue by looking at the environment var for the current issue body?
            # Actually github actions triggers on 'opened', the current issue is already open!
            # Let's get the current issue number from GITHUB context if passed, or just ignore if it matches the exact same body verbatim.
            # Even better: pass ISSUE_NUMBER to the script to skip it.
            current_issue = os.environ.get('ISSUE_NUMBER', '')
            if current_issue and str(issue.get('number', '')) == str(current_issue):
                continue
                
            issue_url = parse_issue_for_url(issue.get('body', ''))
            if issue_url and normalize_url(issue_url) == norm_new:
                return True, f"issue #{issue['number']}"
                
    except Exception as e:
        print(f"Error checking active issues: {e}", file=sys.stderr)
        
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
        sys.exit(0)
        
    # Check against other open issues
    is_dup_issue, issue_id = check_for_duplicate_issues(submitted_url)
    
    if is_dup_issue:
        print("DUPLICATE_ISSUE")
        print(issue_id)
        sys.exit(0)
        
    print("UNIQUE")

if __name__ == '__main__':
    main()
