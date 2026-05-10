import os
import re
import glob
from ruamel.yaml import YAML

REVERSE_LABEL_MAP = None
REVERSE_TAG_MAP = None

def build_reverse_maps():
    global REVERSE_LABEL_MAP, REVERSE_TAG_MAP
    if REVERSE_LABEL_MAP is not None:
        return
        
    yaml = YAML(typ='safe')
    rev_label = {}
    rev_tag = {}
    
    # Use absolute paths or relative to the script
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    data_yml_path = os.path.join(base_dir, 'data.yml')
    locales_dir = os.path.join(base_dir, 'locales')
    
    try:
        with open(data_yml_path, 'r', encoding='utf-8') as f:
            data = yaml.load(f) or {}
    except Exception as e:
        print(f"Warning: Could not read data.yml for parsing maps: {e}")
        data = {}
        
    allowed_tags = []
    for category in ['difficulty', 'cost', 'language', 'machine_tool_type', 'record_type', 'machine_type']:
        allowed_tags.extend(data.get('allowed_tags', {}).get(category, []))
        
    for f in glob.glob(os.path.join(locales_dir, '*.yml')):
        try:
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
        except Exception as e:
            print(f"Warning: Could not process {f}: {e}")
                    
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
            if len(value) > 500:
                value = value[:500] + '...'
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
