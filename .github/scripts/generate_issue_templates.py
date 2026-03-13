"""
generate_issue_templates.py

This script dynamically generates GitHub Issue Templates for submitting new resources.
It iterates through the active languages in the `locales/` directory to create a localized issue form for each supported language.
"""

import os
from ruamel.yaml import YAML
import glob

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_FILE = os.path.join(BASE_DIR, 'data.yml')
LOCALES_DIR = os.path.join(BASE_DIR, 'locales')
ISSUE_DIR = os.path.join(BASE_DIR, '.github', 'ISSUE_TEMPLATE')

def load_yaml(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return YAML(typ='safe').load(f)

def generate_templates():
    if not os.path.exists(DATA_FILE) or not os.path.exists(LOCALES_DIR):
        print("Missing required yaml files.")
        return

    data = load_yaml(DATA_FILE)
    en_dict = load_yaml(os.path.join(LOCALES_DIR, 'en.yml')) or {}
    
    allowed_tags = data.get('allowed_tags', {})

    # Delete old submit-resource templates to prevent duplicates
    old_files = glob.glob(os.path.join(ISSUE_DIR, '*-submit-resource*.yml'))
    for f in old_files:
        try:
            os.remove(f)
        except OSError:
            pass

    idx = 1
    # Ensure English is the first option in the GitHub issue chooser dropdown
    locales = [os.path.basename(f).split('.')[0] for f in glob.glob(os.path.join(LOCALES_DIR, '*.yml'))]
    langs = sorted(locales)
    if 'en' in langs:
        langs.remove('en')
        langs.insert(0, 'en')

    for lang in langs:
        dic = load_yaml(os.path.join(LOCALES_DIR, f"{lang}.yml")) or {}
        
        # Fallback to English dictionary for any missing keys
        def t(key, default=''):
            return dic.get(key, en_dict.get(key, default))
        
        template = {
            'name': f"{t('issue_submit_title', '👉 Add a New Resource')} ({lang.upper()})",
            'description': t('issue_submit_desc', 'Submit a new resource'),
            'labels': [f"lang:{lang}", "new-submission"],
            'body': [
                {
                    'type': 'markdown',
                    'attributes': {
                        'value': t('issue_submit_body', 'Thanks for taking the time to submit a new resource to the Awesome Snapmaker List!') + '\n\n'
                    }
                },
                {
                    'type': 'textarea',
                    'id': 'description',
                    'attributes': {
                        'label': t('issue_description_label', 'Resource Description'),
                        'description': t('issue_description_desc', ''),
                        'placeholder': t('issue_description_placeholder', '')
                    },
                    'validations': {'required': True}
                },
                {
                    'type': 'input',
                    'id': 'author_name',
                    'attributes': {
                        'label': t('issue_author_name_label', 'Author Name'),
                        'description': t('issue_author_name_desc', '')
                    },
                    'validations': {'required': True}
                },
                {
                    'type': 'input',
                    'id': 'author_link',
                    'attributes': {
                        'label': t('issue_author_link_label', 'Author Link'),
                        'description': t('issue_author_link_desc', '')
                    },
                    'validations': {'required': True}
                },
                {
                    'type': 'input',
                    'id': 'original_link',
                    'attributes': {
                        'label': t('issue_original_link_label', 'Content Link (Original URL)'),
                        'description': t('issue_original_link_desc', ''),
                        'placeholder': 'https://...'
                    },
                    'validations': {'required': True}
                },
                {
                    'type': 'dropdown',
                    'id': 'difficulty',
                    'attributes': {
                        'label': t('issue_difficulty_label', 'Difficulty Level'),
                        'options': allowed_tags.get('difficulty', [])
                    },
                    'validations': {'required': True}
                },
                {
                    'type': 'dropdown',
                    'id': 'cost',
                    'attributes': {
                        'label': t('issue_cost_label', 'Cost'),
                        'options': allowed_tags.get('cost', [])
                    },
                    'validations': {'required': True}
                },
                {
                    'type': 'dropdown',
                    'id': 'language',
                    'attributes': {
                        'label': t('issue_language_label', 'Language'),
                        'description': t('issue_language_desc', ''),
                        'options': allowed_tags.get('language', [])
                    },
                    'validations': {'required': True}
                },
                {
                    'type': 'checkboxes',
                    'id': 'machine_type',
                    'attributes': {
                        'label': t('issue_machine_type_label', 'Machine Type(s)'),
                        'description': t('issue_machine_type_desc', ''),
                        'options': [{'label': opt} for opt in allowed_tags.get('machine_type', [])]
                    }
                },
                {
                    'type': 'checkboxes',
                    'id': 'machine_tool_type',
                    'attributes': {
                        'label': t('issue_machine_tool_type_label', 'Machine Tool Type(s)'),
                        'description': t('issue_machine_tool_type_desc', ''),
                        'options': [{'label': opt} for opt in allowed_tags.get('machine_tool_type', [])]
                    }
                },
                {
                    'type': 'checkboxes',
                    'id': 'record_type',
                    'attributes': {
                        'label': t('issue_record_type_label', 'Record Type(s)'),
                        'description': t('issue_record_type_desc', ''),
                        'options': [{'label': opt} for opt in allowed_tags.get('record_type', [])]
                    }
                },
                {
                    'type': 'dropdown',
                    'id': 'official_resource',
                    'attributes': {
                        'label': t('issue_official_label', 'Official Snapmaker Resource?'),
                        'description': t('issue_official_desc', ''),
                        'options': [t('issue_official_no', 'No'), t('issue_official_yes', 'Yes')]
                    },
                    'validations': {'required': True}
                },
                {
                    'type': 'input',
                    'id': 'free_tags',
                    'attributes': {
                        'label': t('issue_free_tags_label', 'Free Tags'),
                        'description': t('issue_free_tags_desc', ''),
                        'placeholder': 'UNOFFICIAL, cooling, petg'
                    },
                    'validations': {'required': False}
                },
                {
                    'type': 'input',
                    'id': 'extra_button_1_label',
                    'attributes': {
                        'label': t('issue_extra_btn1_label', '(Optional) Extra Button 1 - Label'),
                        'description': t('issue_extra_btn1_desc', ''),
                        'placeholder': 'Download STL'
                    },
                    'validations': {'required': False}
                },
                {
                    'type': 'input',
                    'id': 'extra_button_1_link',
                    'attributes': {
                        'label': t('issue_extra_btn1_link', '(Optional) Extra Button 1 - Link'),
                        'placeholder': 'https://...'
                    },
                    'validations': {'required': False}
                },
                {
                    'type': 'markdown',
                    'attributes': {
                        'value': t('issue_confirm', 'By submitting this issue, you confirm the link is safe and valid.')
                    }
                }
            ]
        }
        
        filename = f"{idx:02d}-submit-resource-{lang}.yml"
        filepath = os.path.join(ISSUE_DIR, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            yml = YAML()
            yml.indent(mapping=2, sequence=4, offset=2)
            yml.preserve_quotes = True
            yml.dump(template, f)
            
        print(f"Generated {filepath}")
        idx += 1

if __name__ == "__main__":
    generate_templates()
