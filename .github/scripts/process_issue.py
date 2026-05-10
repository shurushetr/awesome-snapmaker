import os
import sys
import re
import json
import subprocess
import glob
from datetime import datetime
from ruamel.yaml import YAML
from intake_check import check_for_duplicates
from issue_parser import parse_issue_body
from url_utils import normalize_url

def run_gh_command(cmd_list):
    """Utility to run gh CLI commands"""
    try:
        result = subprocess.run(
            ['gh'] + cmd_list, 
            capture_output=True, 
            text=True, 
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"GH Command failed: {' '.join(cmd_list)}")
        print(f"Error: {e.stderr}")
        return None

def fetch_approved_issues():
    """Fetches all open issues with both 'approved' and 'new-submission' labels."""
    print("Fetching approved issues...")
    output = run_gh_command([
        'issue', 'list', 
        '--state', 'open',
        '--label', 'approved',
        '--label', 'new-submission',
        '--json', 'number,title,body'
    ])
    
    if not output:
        return []
        
    try:
        issues = json.loads(output)
        return issues
    except json.JSONDecodeError:
        print("Failed to parse gh CLI output as JSON.")
        return []

def comment_on_issue(issue_number, body):
    run_gh_command(['issue', 'comment', str(issue_number), '--body', body])

def remove_label(issue_number, label):
    run_gh_command(['issue', 'edit', str(issue_number), '--remove-label', label])

def add_label(issue_number, label):
    run_gh_command(['issue', 'edit', str(issue_number), '--add-label', label])

def close_issue(issue_number):
    run_gh_command(['issue', 'close', str(issue_number)])

def get_env_file_path(env_var_name):
    path = os.environ.get(env_var_name)
    if not path:
        print(f"Warning: {env_var_name} environment variable not set.")
    return path

def append_to_env_file(env_var_name, key, value):
    path = get_env_file_path(env_var_name)
    if path:
        with open(path, 'a') as f:
            f.write(f"{key}={value}\n")

def main():
    issues = fetch_approved_issues()
    
    if not issues:
        print("No approved issues found to process.")
        append_to_env_file('GITHUB_ENV', 'ISSUES_PROCESSED', 'false')
        return
        
    processed_count = 0
    pr_body_lines = []
    new_records = []
    processed_urls = set()
    
    # Process each issue and track valid ones
    for issue in issues:
        issue_number = issue['number']
        issue_title = issue.get('title', f"Resource from Issue #{issue_number}")
        issue_body = issue.get('body', "")
        
        print(f"\n--- Processing Issue #{issue_number}: {issue_title} ---")
        
        if issue_title.startswith('[Resource]:'):
            issue_title = issue_title.replace('[Resource]:', '').strip()
            
        parsed = parse_issue_body(issue_body)
        
        # Build ID
        id_slug = re.sub(r'[^a-z0-9]+', '-', issue_title.lower()).strip('-')
        final_id = f"{id_slug}-{issue_number}"
        
        # Build record
        new_record = {
            "id": final_id,
            "title": issue_title,
            "description": parsed.get("description", ""),
            "author_name": parsed.get("author_name"),
            "author_link": parsed.get("author_link"),
            "original_link": parsed.get("original_link"),
            "date_added": datetime.now().strftime("%Y-%m-%d"),
        }
        
        if parsed.get("difficulty"): new_record["difficulty"] = parsed.get("difficulty")
        if parsed.get("cost"): new_record["cost"] = parsed.get("cost")
        
        tags = {}
        if parsed.get("machine_type"): tags["machine_type"] = parsed.get("machine_type")
        if parsed.get("machine_tool"): tags["machine_tool_type"] = parsed.get("machine_tool")
        if parsed.get("record_type"): tags["record_type"] = parsed.get("record_type")
        if parsed.get("official_flag"): tags["official_flag"] = parsed.get("official_flag")
        else: tags["official_flag"] = ["UNOFFICIAL"]
        if parsed.get("free_tags"): tags["free_tags"] = parsed.get("free_tags")
        new_record["tags"] = tags
        
        if parsed.get("extra_buttons"):
            new_record["extra_buttons"] = parsed.get("extra_buttons")

        # Validation
        original_link = new_record.get("original_link")
        if not original_link or not original_link.strip():
            print(f"Warning: No Original URL provided for issue #{issue_number}. Skipping.")
            comment_on_issue(issue_number, "Failed to process: No Original URL provided.")
            remove_label(issue_number, "approved")
            continue

        is_duplicate, _ = check_for_duplicates(original_link, 'data.yml')
        norm_link = normalize_url(original_link)
        
        if is_duplicate or (norm_link and norm_link in processed_urls):
             print(f"Duplicate found for {original_link}.")
             comment_on_issue(issue_number, "This resource has already been submitted and exists in the database. Closing as duplicate.")
             add_label(issue_number, "duplicate")
             close_issue(issue_number)
             remove_label(issue_number, "pending-content-review")
             remove_label(issue_number, "approved")
             continue 

        if norm_link:
            processed_urls.add(norm_link)

        # Valid record
        new_records.append(new_record)
        processed_count += 1
        pr_body_lines.append(f"Closes #{issue_number}")
        
        comment_on_issue(issue_number, "Thanks for your submission! A Pull Request has been automatically created to add your resource into the database.")
        remove_label(issue_number, "pending-content-review")
        remove_label(issue_number, "approved") 

    if processed_count > 0:
        # Append all new valid records to data.yml
        from io import StringIO
        yaml = YAML()
        yaml.preserve_quotes = True
        yaml.explicit_start = False
        
        buf = StringIO()
        yaml.dump(new_records, buf)
        yaml_string = buf.getvalue()
        
        needs_newline = False
        try:
            with open('data.yml', 'r', encoding='utf-8') as f:
                content = f.read()
                if content and not content.endswith('\n'):
                    needs_newline = True
        except FileNotFoundError:
            pass
            
        with open('data.yml', 'a', encoding='utf-8') as f:
            if needs_newline:
                f.write('\n')
            f.write(yaml_string)
            
        # Write PR body text
        with open('pr_body.txt', 'w') as f:
            f.write("\n".join(pr_body_lines) + "\n")
            
        print(f"Successfully appended {processed_count} approved issues to data.yml.")
        append_to_env_file('GITHUB_ENV', 'ISSUES_PROCESSED', 'true')
    else:
        print("No valid, unique issues were processed.")
        append_to_env_file('GITHUB_ENV', 'ISSUES_PROCESSED', 'false')

if __name__ == '__main__':
    main()
