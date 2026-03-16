import sys
from ruamel.yaml import YAML

def deduplicate_yaml(file_path):
    yaml = YAML()
    yaml.preserve_quotes = True
    yaml.indent(mapping=2, sequence=4, offset=2)
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = yaml.load(f)
        
    records = data.get('records', [])
    if not records:
        print("No records found to deduplicate.")
        return

    unique_records = []
    seen_ids = set()

    for record in records:
        record_id = record.get('id')
        if record_id not in seen_ids:
            unique_records.append(record)
            seen_ids.add(record_id)
        else:
            print(f"Removed duplicate record: {record_id} ({record.get('title')})")

    data['records'] = unique_records

    with open(file_path, 'w', encoding='utf-8') as f:
        yaml.dump(data, f)
        
    print(f"Deduplication complete. Kept {len(unique_records)} out of {len(records)} records.")

if __name__ == '__main__':
    deduplicate_yaml('s:/Documents/#SyncThing/Soft/Scripts/#GIT/awesome-snapmaker.xyz/data.yml')
