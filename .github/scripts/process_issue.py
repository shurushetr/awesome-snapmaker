import os
import sys
import re
from datetime import datetime
from ruamel.yaml import YAML
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
        
        if "resource description" in label or "description" in label:
            record["description"] = value
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
            if "- [" in value:
                record["machine_type"] = [line.replace('- [X]', '').replace('- [x]', '').strip() for line in value.split('\n') if '- [x]' in line.lower()]
            else:
                record["machine_type"] = [x.strip() for x in value.split(',')] if value else []
        elif "machine tool type" in label:
            if "- [" in value:
                record["machine_tool"] = [line.replace('- [X]', '').replace('- [x]', '').strip() for line in value.split('\n') if '- [x]' in line.lower()]
            else:
                record["machine_tool"] = [x.strip() for x in value.split(',')] if value else []
        elif "record type" in label:
            if "- [" in value:
                record["record_type"] = [line.replace('- [X]', '').replace('- [x]', '').strip() for line in value.split('\n') if '- [x]' in line.lower()]
            else:
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
        
    issue_title = os.environ.get('ISSUE_TITLE', 'Unknown Resource')
    issue_number = os.environ.get('ISSUE_NUMBER', '')
    
    # Strip the [Resource]: prefix if it exists
    if issue_title.startswith('[Resource]:'):
        issue_title = issue_title.replace('[Resource]:', '').strip()
        
    parsed = parse_issue_body(issue_body)
    
    # Generate unique ID by combining title slug and github issue number
    id_slug = re.sub(r'[^a-z0-9]+', '-', issue_title.lower()).strip('-')
    final_id = f"{id_slug}-{issue_number}" if issue_number else id_slug
    
    # Construct complete record
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

    # Append to data.yml directly without overwriting existing formatting
    from io import StringIO
    yaml = YAML()
    yaml.preserve_quotes = True
    yaml.explicit_start = False
    
    # Dump just the new record as a list item to a string
    buf = StringIO()
    yaml.dump([new_record], buf)
    yaml_string = buf.getvalue()
    
    # Check if the file ends with a newline
    try:
        with open('data.yml', 'r', encoding='utf-8') as f:
            content = f.read()
            needs_newline = not content.endswith('\n')
    except FileNotFoundError:
        needs_newline = False
        
    # Append the new record string to the end of the file
    with open('data.yml', 'a', encoding='utf-8') as f:
        if needs_newline:
            f.write('\n')
        f.write(yaml_string)

if __name__ == '__main__':
    main()
