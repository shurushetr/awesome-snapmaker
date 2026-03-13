"""
on_pr_merged.py

This script runs after a Pull Request is merged. It detects if the PR resolves an active community submission issue.
If so, it posts a localized "Thank you" comment on the original issue (based on its `lang:` label) and closes it.
"""

import os
import re
import sys
import subprocess
from ruamel.yaml import YAML

def get_translation(lang, key, default_en=''):
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    locales_dir = os.path.join(base_dir, 'locales')
    
    try:
        with open(os.path.join(locales_dir, 'en.yml'), 'r', encoding='utf-8') as f:
            en_str = YAML(typ='safe').load(f).get(key, default_en)
            
        if lang == 'en':
            return en_str
            
        lang_file = os.path.join(locales_dir, f"{lang}.yml")
        if not os.path.exists(lang_file):
            return en_str
            
        with open(lang_file, 'r', encoding='utf-8') as f:
            lang_str = YAML(typ='safe').load(f).get(key, en_str)
            
        if lang_str == en_str:
            return en_str
        return f"{en_str}\n\n---\n\n{lang_str}"
    except Exception:
        return default_en

def main():
    pr_body = os.environ.get('PR_BODY', '')
    if not pr_body:
        print("No PR body provided.")
        sys.exit(0)
        
    # Find all instances of "Closes #123"
    issues = set(re.findall(r'Closes #(\d+)', pr_body, re.IGNORECASE))
    
    if not issues:
        print("No related issues found in PR body.")
        sys.exit(0)
        
    print(f"Found issues: {', '.join(issues)}")
    
    for issue_num in issues:
        try:
            # Get labels from the issue using gh CLI
            lang = 'en'
            try:
                import json
                res = subprocess.run(['gh', 'issue', 'view', issue_num, '--json', 'labels'], capture_output=True, text=True, check=True)
                data = json.loads(res.stdout)
                for lbl in data.get('labels', []):
                    name = lbl.get('name', '')
                    if name.startswith('lang:'):
                        lang = name.split(':')[1]
                        break
            except Exception as e:
                print(f"Could not fetch labels for issue {issue_num}: {e}")
                
            # Construct body
            body = get_translation(lang, 'bot_merged', '🎉 Your submission has been successfully merged into the directory!')
            
            # Comment and close
            subprocess.run(['gh', 'issue', 'comment', issue_num, '--body', body])
            subprocess.run(['gh', 'issue', 'close', issue_num])
            
            print(f"Commented and closed issue #{issue_num}")
            
        except Exception as e:
            print(f"Failed to process issue #{issue_num}: {e}", file=sys.stderr)

if __name__ == '__main__':
    main()
