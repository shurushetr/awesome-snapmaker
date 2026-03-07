import yaml
import os
import sys

def generate_readme():
    try:
        with open('data.yml', 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
    except Exception as e:
        print(f"Error reading data.yml: {e}")
        sys.exit(1)

    info = data.get('project_info', {})
    records = data.get('records', [])
    records.sort(key=lambda x: x.get('date_added', ''), reverse=True) # Newest first

    # Organize records by machine type for the README
    categorized = {}
    for record in records:
        machines = record.get('tags', {}).get('machine_type', ['Uncategorized'])
        if not machines:
            machines = ['Uncategorized']
            
        for m in machines:
            if m not in categorized:
                categorized[m] = []
            categorized[m].append(record)

    with open('README.md', 'w', encoding='utf-8') as f:
        # Header
        f.write(f"# {info.get('title', 'Awesome Snapmaker List')}\n\n")
        f.write(f"![Hero Image]({info.get('hero_image', '')})\n\n")
        f.write(f"{info.get('description', '')}\n\n")
        f.write(f"Maintained by [{info.get('author_name', 'Author')}]({info.get('author_link', '#')}).\n\n")
        f.write("---\n\n")
        
        f.write("## 🌐 Interactive Website\n\n")
        f.write(f"**This list is best viewed on our interactive web interface with search and filters: [View Website](https://yourusername.github.io/awesome-snapmaker/)**\n\n")
        f.write("---\n\n")

        # Table of Contents
        f.write("## Table of Contents\n")
        for m in sorted(categorized.keys()):
            f.write(f"- [{m}](#{m.lower().replace('.', '')})\n")
        f.write("\n---\n\n")

        # Content
        for m in sorted(categorized.keys()):
            f.write(f"## {m}\n\n")
            
            for r in categorized[m]:
                f.write(f"### [{r.get('title')}]({r.get('original_link')})\n")
                f.write(f"- **Author:** {r.get('author_name')}\n")
                f.write(f"- **Difficulty:** {r.get('difficulty', 'N/A')} | **Cost:** {r.get('cost', 'N/A')}\n")
                
                tags = []
                t_dict = r.get('tags', {})
                for k, v_list in t_dict.items():
                    if v_list:
                        tags.extend(v_list)
                if tags:
                    f.write(f"- **Tags:** {', '.join(tags)}\n")
                    
                f.write("\n")

if __name__ == '__main__':
    generate_readme()
