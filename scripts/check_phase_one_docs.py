#!/usr/bin/env python3
from pathlib import Path

required_files = [
    'docs/product/phase-one-prd.md',
    'docs/architecture/phase-one-microservice-architecture.md',
    'docs/design/phase-one-miniprogram-design.md',
    'docs/testing/phase-one-test-plan.md',
    'docs/project-governance/product-phase-one-scope.md',
    'docs/project-governance/data-source-and-recommendation-framework.md',
]
required_terms = [
    '一句自然语言',
    '候选',
    '明确采纳',
    '正式路线资产',
    '来源',
]
missing = []
for file in required_files:
    path = Path(file)
    if not path.exists():
        missing.append(f'missing file: {file}')
        continue
    text = path.read_text(encoding='utf-8')
    for term in required_terms:
        if term not in text and file.endswith('phase-one-prd.md'):
            missing.append(f'{file} missing term: {term}')
if missing:
    print('\n'.join(missing))
    raise SystemExit(1)
print('phase-one docs: PASS')
