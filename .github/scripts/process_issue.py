import os
import sys
import yaml
import re
from datetime import datetime

def parse_issue_body(body):
    """Parses the GitHub Issue body based on the template structure."""
    record = {}
    
    # Simple regex to extract sections: ### Label\n\nValue
    sections = re.split(r'###\s+(.+)\n', body)
    
    # Sections usually starts with a blank or introductory string at sections[0]
    for i in range(1, len(sections), 2):
        label = sections[i].strip()
        value = sections[i+1].strip() if i+1 < len(sections) else ""
        
        # Clean value from "No response"
        if value == "_No response_":
            value = ""
            
        label = label.lower()
        
        if "title" in label:
            record["title"] = value
        elif "author name" in label:
            record["author_name"] = value
        elif "author link" in label:
            record["author_link"] = value
        elif "content link" in label:
            record["original_link"] = value
        elif "difficulty" in label:
            record["difficulty"] = value if value and value != "N/A" else None
        elif "cost" in label:
            record["cost"] = value if value and value != "N/A" else None
        elif "machine type" in label:
            record["machine_type"] = [x.strip() for x in value.split(',')] if value else []
        elif "machine tool type" in label:
            record["machine_tool"] = [x.strip() for x in value.split(',')] if value else []
        elif "record type" in label:
            record["record_type"] = [x.strip() for x in value.split(',')] if value else []
        elif "official snapmaker resource" in label or "official flag" in label:
            val = value.lower().strip()
            if val == 'yes' or val == 'true' or val == '1':
                record["official_flag"] = ["OFFICIAL"]
            else:
                record["official_flag"] = ["UNOFFICIAL"]
        elif "free tags" in label:
            record["free_tags"] = [x.strip() for x in value.split(',') if x.strip()] if value else []
        elif "extra button 1 - label" in label:
            record["btn1_label"] = value
        elif "extra button 1 - link" in label:
            record["btn1_link"] = value

    return record

def main():
    issue_body = os.environ.get('ISSUE_BODY', '')
    if not issue_body:
        print("No issue body provided.")
        sys.exit(1)
        
    parsed = parse_issue_body(issue_body)
    
    # Construct complete record
    new_record = {
        "id": re.sub(r'[^a-z0-9]+', '-', parsed.get('title', 'new-item').lower()).strip('-'),
        "title": parsed.get("title"),
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
    
    # Extract official flag if it exists, otherwise default to UNOFFICIAL
    if parsed.get("official_flag"): 
        tags["official_flag"] = parsed.get("official_flag")
    else:
        tags["official_flag"] = ["UNOFFICIAL"]
        
    if parsed.get("free_tags"): tags["free_tags"] = parsed.get("free_tags")
    new_record["tags"] = tags
    
    extra_buttons = []
    if parsed.get("btn1_label") and parsed.get("btn1_link"):
        extra_buttons.append({"label": parsed.get("btn1_label"), "link": parsed.get("btn1_link")})
    if extra_buttons:
        new_record["extra_buttons"] = extra_buttons

    # Append to data.yml
    try:
        with open('data.yml', 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
    except FileNotFoundError:
        data = {"records": []}
        
    data.setdefault('records', []).append(new_record)
    
    with open('data.yml', 'w', encoding='utf-8') as f:
        yaml.dump(data, f, sort_keys=False, default_flow_style=False, allow_unicode=True)

if __name__ == '__main__':
    main()
