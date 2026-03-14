import os
import sys
import re
import json
import subprocess
import glob
from datetime import datetime
from ruamel.yaml import YAML
from intake_check import check_for_duplicates

REVERSE_LABEL_MAP = None
REVERSE_TAG_MAP = None

def build_reverse_maps():
    global REVERSE_LABEL_MAP, REVERSE_TAG_MAP
    if REVERSE_LABEL_MAP is not None:
        return
        
    yaml = YAML(typ='safe')
    rev_label = {}
    rev_tag = {}
    
    with open('data.yml', 'r', encoding='utf-8') as f:
        data = yaml.load(f)
        
    allowed_tags = []
    for category in ['difficulty', 'cost', 'language', 'machine_tool_type', 'record_type', 'machine_type']:
        allowed_tags.extend(data.get('allowed_tags', {}).get(category, []))
        
    for f in glob.glob('locales/*.yml'):
        with open(f, 'r', encoding='utf-8') as loc_f:
            dic = yaml.load(loc_f) or {}
            for key, val in dic.items():
                if key.startswith('issue_') and key.endswith('_label') and isinstance(val, str):
                    rev_label[val.strip().lower()] = key
            
            for en_opt in allowed_tags:
                tag_key = f"tag_{en_opt.lower().replace(' ', '_')}"
                translated = dic.get(tag_key)
                if translated:
                    clean_translated = translated.split(' (')[0].strip()
                    rev_tag[clean_translated.lower()] = en_opt
                    rev_tag[translated.lower()] = en_opt
                    
            yes_val = dic.get('issue_official_yes')
            if yes_val: rev_tag[yes_val.lower()] = "OFFICIAL"
            no_val = dic.get('issue_official_no')
            if no_val: rev_tag[no_val.lower()] = "UNOFFICIAL"
                    
    for en_opt in allowed_tags:
        rev_tag[en_opt.lower()] = en_opt
        
    REVERSE_LABEL_MAP = rev_label
    REVERSE_TAG_MAP = rev_tag

def map_tags(extracted_list):
    build_reverse_maps()
    mapped = []
    for item in extracted_list:
        clean_item = item.strip()
        if clean_item.lower() in REVERSE_TAG_MAP:
            mapped.append(REVERSE_TAG_MAP[clean_item.lower()])
        else:
            mapped.append(clean_item)
    return mapped

def parse_issue_body(body):
    """Parses the GitHub Issue body based on the original or translated template structure."""
    build_reverse_maps()
    record = {}
    lines = body.split('\n')
    current_raw_label = None
    aggregated_value = []
    
    sections = {}

    for line in lines:
        match = re.search(r'^###\s+(.+)$', line.strip())
        if match:
            if current_raw_label:
                mapped_key = REVERSE_LABEL_MAP.get(current_raw_label, current_raw_label)
                sections[mapped_key] = '\n'.join(aggregated_value).strip()
            # Clean up trailing asterisks or markdown in titles
            current_raw_label = match.group(1).lower().replace('(*)', '').replace('*', '').strip()
            aggregated_value = []
        elif current_raw_label:
            aggregated_value.append(line)
            
    if current_raw_label:
        mapped_key = REVERSE_LABEL_MAP.get(current_raw_label, current_raw_label)
        sections[mapped_key] = '\n'.join(aggregated_value).strip()

    for label, value in sections.items():
        value = value.strip()
        if value == "_No response_" or value == "":
            continue
            
        if label == "issue_description_label" or "description" in label:
            record["description"] = value
        elif label == "issue_author_name_label" or "author name" in label:
            record["author_name"] = value
        elif label == "issue_author_link_label" or "author link" in label:
            record["author_link"] = value
        elif label == "issue_original_link_label" or "content link" in label:
            record["original_link"] = value
        elif label == "issue_difficulty_label" or "difficulty" in label:
            if value and value != "N/A" and value != "None":
                record["difficulty"] = map_tags([value])[0]
        elif label == "issue_cost_label" or "cost" in label:
            if value and value != "N/A" and value != "None":
                record["cost"] = map_tags([value])[0]
        elif label == "issue_language_label" or "language" in label:
            if value and value != "N/A" and value != "None":
                record["language"] = map_tags([value])[0]
        elif label == "issue_machine_type_label" or "machine type" in label:
            if "- [" in value:
                extracted = [v.replace('- [X]', '').replace('- [x]', '').strip() for v in value.split('\n') if '- [x]' in v.lower()]
                record["machine_type"] = map_tags(extracted)
            else:
                record["machine_type"] = map_tags([x.strip() for x in value.split(',')] if value else [])
        elif label == "issue_machine_tool_type_label" or "machine tool type" in label:
            if "- [" in value:
                extracted = [v.replace('- [X]', '').replace('- [x]', '').strip() for v in value.split('\n') if '- [x]' in v.lower()]
                record["machine_tool"] = map_tags(extracted)
            else:
                record["machine_tool"] = map_tags([x.strip() for x in value.split(',')] if value else [])
        elif label == "issue_record_type_label" or "record type" in label:
            if "- [" in value:
                extracted = [v.replace('- [X]', '').replace('- [x]', '').strip() for v in value.split('\n') if '- [x]' in v.lower()]
                record["record_type"] = map_tags(extracted)
            else:
                record["record_type"] = map_tags([x.strip() for x in value.split(',')] if value else [])
        elif label == "issue_official_label" or "official snapmaker resource" in label or "official flag" in label:
            extracted = map_tags([value])
            if extracted and extracted[0] == "OFFICIAL":
                record["official_flag"] = ["OFFICIAL"]
            elif extracted and extracted[0] == "UNOFFICIAL":
                record["official_flag"] = ["UNOFFICIAL"]
            else:
                val = value.lower().strip()
                record["official_flag"] = ["OFFICIAL"] if val in ['yes', 'true', '1'] else ["UNOFFICIAL"]
        elif label == "issue_free_tags_label" or "free tags" in label:
            record["free_tags"] = [x.strip() for x in value.split(',') if x.strip()] if value else []
        elif label == "issue_extra_btn1_label" or re.search(r'extra button (\d+)\s*-\s*label', label):
            idx = '1'
            record.setdefault("extra_buttons_dict", {}).setdefault(idx, {})["label"] = value
        elif label == "issue_extra_btn1_link" or re.search(r'extra button (\d+)\s*-\s*link', label):
            idx = '1'
            record.setdefault("extra_buttons_dict", {}).setdefault(idx, {})["link"] = value

    if "extra_buttons_dict" in record:
        extra_buttons = []
        for idx in sorted(record["extra_buttons_dict"].keys(), key=int):
            btn = record["extra_buttons_dict"][idx]
            if btn.get("label") and btn.get("link"):
                extra_buttons.append({"label": btn["label"], "link": btn["link"]})
        if extra_buttons:
            record["extra_buttons"] = extra_buttons
        del record["extra_buttons_dict"]

    return record

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
        if is_duplicate:
             print(f"Duplicate found for {original_link}.")
             comment_on_issue(issue_number, "This resource has already been submitted and exists in the database. Closing as duplicate.")
             add_label(issue_number, "duplicate")
             close_issue(issue_number)
             remove_label(issue_number, "pending-content-review")
             remove_label(issue_number, "approved")
             continue 

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
