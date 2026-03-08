"""
generate_readme.py

This script generates the repository's main `README.md` file dynamically.
It reads the single-source-of-truth `data.yml`, groups and sorts the records by 
machine categories and tool types, and renders a clean Markdown document 
with a responsive table of contents.
"""

from ruamel.yaml import YAML
import os
import sys

def generate_readme():
    try:
        yaml = YAML(typ='safe')
        with open('data.yml', 'r', encoding='utf-8') as f:
            data = yaml.load(f)
    except Exception as e:
        print(f"Error reading data.yml: {e}")
        sys.exit(1)

    info = data.get('project_info', {})
    records = data.get('records', [])
    records.sort(key=lambda x: x.get('date_added', ''), reverse=True) # Newest first

    # Organize records by machine type and then by tool type
    categorized = {}
    for record in records:
        machines = record.get('tags', {}).get('machine_type', ['Uncategorized'])
        if not machines:
            machines = ['Uncategorized']
            
        tools = record.get('tags', {}).get('machine_tool_type', ['General'])
        if not tools:
            tools = ['General']
            
        for m in machines:
            if m not in categorized:
                categorized[m] = {}
            for t in tools:
                if t not in categorized[m]:
                    categorized[m][t] = []
                categorized[m][t].append(record)

    with open('README.md', 'w', encoding='utf-8') as f:
        # Header
        f.write(f"# {info.get('title', 'Awesome Snapmaker List')}\n\n")
        f.write(f"![Hero Image]({info.get('hero_image', '')})\n\n")
        f.write(f"{info.get('description', '')}\n\n")
        f.write(f"Maintained by [{info.get('author_name', 'Author')}]({info.get('author_link', '#')}).\n\n")
        f.write("---\n\n")
        
        f.write("## 🌐 Interactive Website\n\n")
        f.write(f"**This list is best viewed on our interactive web interface with search and filters: [View Website]({info.get('site_url', 'https://awesome-sm-list.xyz/')})**\n\n")
        f.write("---\n\n")

        # Table of Contents
        f.write("## Table of Contents\n")
        for m in sorted(categorized.keys()):
            f.write(f"- [{m}](#{m.lower().replace('.', '')})\n")
        f.write("\n---\n\n")

        # Content
        for m in sorted(categorized.keys()):
            f.write(f"## {m}\n\n")
            
            for t in sorted(categorized[m].keys()):
                f.write(f"### {t}\n\n")
                
                for r in categorized[m][t]:
                    f.write(f"#### [{r.get('title')}]({r.get('original_link')})\n")
                    
                    if r.get('description'):
                        f.write(f"> {r.get('description')}\n\n")
                    
                    f.write(f"**Content Author:** {r.get('author_name')} | **Added:** {r.get('date_added', 'Unknown')}\n\n")
                    
                    tags = []
                    if r.get('difficulty') and r.get('difficulty') != 'N/A':
                        tags.append(r.get('difficulty'))
                    if r.get('cost') and r.get('cost') != 'N/A':
                        tags.append(r.get('cost'))
                        
                    t_dict = r.get('tags', {})
                    for k, v_list in t_dict.items():
                        if v_list:
                            tags.extend(v_list)
                            
                    if tags:
                        # Ensure all tags are cast to strings before joining to prevent TypeErrors from complex nested objects
                        str_tags = [str(tag) for tag in tags if isinstance(tag, str) or isinstance(tag, int)]
                        f.write(f"**Tags:** {', '.join(str_tags)}\n")
                        
                    f.write("\n---\n\n")

if __name__ == '__main__':
    generate_readme()
