import sys
from ruamel.yaml import YAML

def update_issue_template():
    # 1. Load the allowed_tags from the main data source
    yaml = YAML()
    yaml.preserve_quotes = True
    yaml.explicit_start = False
    
    try:
        with open('data.yml', 'r', encoding='utf-8') as f:
            data = yaml.load(f)
            
        allowed_tags = data.get('allowed_tags', {})
        if not allowed_tags:
            print("No allowed_tags found in data.yml")
            sys.exit(0)
    except Exception as e:
        print(f"Error reading data.yml: {e}")
        sys.exit(1)

    # 2. Load the github issue template
    template_path = '.github/ISSUE_TEMPLATE/1-submit-resource.yml'
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            template = yaml.load(f)
    except Exception as e:
        print(f"Error reading {template_path}: {e}")
        sys.exit(1)

    # 3. Inject new options into the dropdowns
    body_items = template.get('body', [])
    updated = False
    
    for item in body_items:
        if item.get('type') in ['dropdown', 'checkboxes']:
            field_id = item.get('id')
            attr = item.get('attributes', {})
            
            # Map the issue form IDs to our allowed_tags dictionary keys
            tag_key = None
            if field_id == 'machine_type':
                tag_key = 'machine_type'
            elif field_id == 'machine_tool_type':
                tag_key = 'machine_tool_type'
            elif field_id == 'record_type':
                tag_key = 'record_type'
            elif field_id == 'difficulty':
                tag_key = 'difficulty'
            elif field_id == 'cost':
                tag_key = 'cost'
            elif field_id == 'language':
                tag_key = 'language'
                
            if tag_key and tag_key in allowed_tags:
                new_options = allowed_tags[tag_key]
                
                # Checkboxes require a specific schema [{'label': option}]
                if item.get('type') == 'checkboxes':
                    formatted_options = [{'label': opt} for opt in new_options]
                else:
                    formatted_options = new_options
                    
                if attr.get('options') != formatted_options:
                    attr['options'] = formatted_options
                    updated = True

    # 4. Save the updated template back if changes occurred
    if updated:
        with open(template_path, 'w', encoding='utf-8') as f:
            yaml.dump(template, f)
            print("Successfully updated issue template options.")
    else:
        print("Issue template is already up to date with data.yml.")

if __name__ == '__main__':
    update_issue_template()
