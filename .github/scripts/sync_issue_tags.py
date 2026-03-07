import yaml
import sys

def update_issue_template():
    # 1. Load the allowed_tags from the main data source
    try:
        with open('data.yml', 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
            
        allowed_tags = data.get('allowed_tags', {})
        if not allowed_tags:
            print("No allowed_tags found in data.yml")
            sys.exit(0)
    except Exception as e:
        print(f"Error reading data.yml: {e}")
        sys.exit(1)

    # 2. Load the github issue template
    template_path = '.github/ISSUE_TEMPLATE/submit-resource.yml'
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            # We use pyyaml to parse and dump. 
            # Note: pyyaml might drop comments and reformats slightly, but the schema remains valid.
            template = yaml.safe_load(f)
    except Exception as e:
        print(f"Error reading {template_path}: {e}")
        sys.exit(1)

    # 3. Inject new options into the dropdowns
    body_items = template.get('body', [])
    updated = False
    
    for item in body_items:
        if item.get('type') == 'dropdown':
            dropdown_id = item.get('id')
            attr = item.get('attributes', {})
            
            # Map the issue form IDs to our allowed_tags dictionary keys
            tag_key = None
            if dropdown_id == 'machine_type':
                tag_key = 'machine_type'
            elif dropdown_id == 'machine_tool_type':
                tag_key = 'machine_tool_type'
            elif dropdown_id == 'record_type':
                tag_key = 'record_type'
                
            if tag_key and tag_key in allowed_tags:
                new_options = allowed_tags[tag_key]
                if attr.get('options') != new_options:
                    attr['options'] = new_options
                    updated = True

    # 4. Save the updated template back if changes occurred
    if updated:
        with open(template_path, 'w', encoding='utf-8') as f:
            # sort_keys=False preserves the general layout
            yaml.dump(template, f, sort_keys=False, default_flow_style=False, allow_unicode=True)
            print("Successfully updated issue template options.")
    else:
        print("Issue template is already up to date with data.yml.")

if __name__ == '__main__':
    update_issue_template()
