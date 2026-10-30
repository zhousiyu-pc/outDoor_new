#!/usr/bin/env python3
"""Read-only readiness check for dev-team governance activation in a target project.

The check is intentionally strict: production governance can only be considered
active for the *current task* when the caller provides the current OpenSpec
change id and that change contains substantive governance artifacts.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

REQUIRED_CHANGE_FILES = [
    'proposal.md',
    'design.md',
    'role-contract.md',
    'tasks.md',
    'kpi-events.md',
    'external-audit.md',
]

REQUIRED_SECTIONS = {
    'proposal.md': ['## Why', '## What Changes', '## Impact'],
    'design.md': ['## Context', '## Goals / Non-Goals', '## Decisions', '## Risks / Trade-offs'],
    'role-contract.md': [
        '## Change / Module',
        '## Global Goal',
        '## Role Boundaries',
        '## Stage Gates',
        '## Evidence Requirements',
        '## Drift Risks',
        '## KPI Recording Rules',
    ],
    'kpi-events.md': ['# KPI Events', '## Events'],
    'external-audit.md': [
        '# External Audit',
        '## Grok Audit Status',
        '## Trigger Reason',
        '## Tech Director Decision',
    ],
}

PLACEHOLDER_MARKERS = [
    '<!--',
    '-->',
    '<name>',
    '<brief description',
    '<existing-name>',
    '<what requirement',
    '<requirement name>',
    '<requirement text>',
    '<scenario name>',
    '<condition>',
    '<expected outcome>',
]


def run(cmd: list[str], cwd: Path) -> tuple[int, str, str]:
    proc = subprocess.run(cmd, cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return proc.returncode, proc.stdout, proc.stderr


def strip_comments(text: str) -> str:
    return re.sub(r'<!--.*?-->', '', text, flags=re.S)


def has_placeholder(text: str) -> bool:
    lowered = text.lower()
    return any(marker.lower() in lowered for marker in PLACEHOLDER_MARKERS)


def visible_body(text: str) -> str:
    body = strip_comments(text)
    body = re.sub(r'^\s*#+\s+.*$', '', body, flags=re.M)
    body = re.sub(r'^\s*\|[-:|\s]+\|\s*$', '', body, flags=re.M)
    return body.strip()


def evaluate_file(path: Path, rel: str) -> dict[str, object]:
    report: dict[str, object] = {
        'exists': path.is_file(),
        'substantive': False,
        'issues': [],
    }
    issues: list[str] = report['issues']  # type: ignore[assignment]
    if not path.is_file():
        issues.append('missing')
        return report

    text = path.read_text(encoding='utf-8', errors='replace')
    if not text.strip():
        issues.append('empty')
        return report

    if has_placeholder(text):
        issues.append('unresolved template placeholder')

    for section in REQUIRED_SECTIONS.get(rel, []):
        if section not in text:
            issues.append(f'missing section: {section}')

    body = visible_body(text)
    min_chars = {
        'proposal.md': 120,
        'design.md': 120,
        'role-contract.md': 250,
        'tasks.md': 20,
        'kpi-events.md': 2,
        'external-audit.md': 80,
    }.get(rel, 40)
    if len(body) < min_chars:
        issues.append('insufficient substantive content')

    if rel == 'tasks.md':
        has_real_task = re.search(r'^\s*-\s*\[[ xX]\]\s+\d+(?:\.\d+)*\s+\S+', text, re.M) is not None
        if not has_real_task:
            issues.append('missing concrete task checkbox')

    report['substantive'] = not issues
    return report


def evaluate_specs(specs_dir: Path) -> dict[str, object]:
    report: dict[str, object] = {
        'exists': specs_dir.is_dir(),
        'substantive': False,
        'files': {},
        'issues': [],
    }
    issues: list[str] = report['issues']  # type: ignore[assignment]
    if not specs_dir.is_dir():
        issues.append('missing specs directory')
        return report

    spec_files = sorted(p for p in specs_dir.glob('**/*.md') if p.is_file())
    file_reports: dict[str, dict[str, object]] = report['files']  # type: ignore[assignment]
    if not spec_files:
        issues.append('missing spec markdown file')
        return report

    for spec_file in spec_files:
        text = spec_file.read_text(encoding='utf-8', errors='replace')
        rel = str(spec_file.relative_to(specs_dir))
        spec_report: dict[str, object] = {'substantive': False, 'issues': []}
        spec_issues: list[str] = spec_report['issues']  # type: ignore[assignment]
        if not text.strip():
            spec_issues.append('empty')
        if has_placeholder(text):
            spec_issues.append('unresolved template placeholder')
        if '### Requirement:' not in text:
            spec_issues.append('missing Requirement section')
        if '#### Scenario:' not in text:
            spec_issues.append('missing Scenario section')
        if len(visible_body(text)) < 100:
            spec_issues.append('insufficient substantive content')
        spec_report['substantive'] = not spec_issues
        file_reports[rel] = spec_report

    if any(not item.get('substantive') for item in file_reports.values()):
        issues.append('one or more spec files are incomplete')

    report['substantive'] = not issues
    return report


def check_project(project: Path, change: str | None) -> dict[str, object]:
    project = project.resolve()
    openspec_dir = project / 'openspec'
    schema_dir = openspec_dir / 'schemas' / 'governance'
    result: dict[str, object] = {
        'project': str(project),
        'ready': False,
        'status': 'not_installed',
        'checks': {},
        'missing': [],
        'warnings': [],
        'recommended_next_step': '',
    }
    checks: dict[str, bool] = result['checks']  # type: ignore[assignment]
    missing: list[str] = result['missing']  # type: ignore[assignment]
    warnings: list[str] = result['warnings']  # type: ignore[assignment]

    checks['project_exists'] = project.is_dir()
    if not checks['project_exists']:
        result['status'] = 'project_missing'
        missing.append('target project directory')
        result['recommended_next_step'] = 'Provide an existing target project path.'
        return result

    checks['openspec_dir_exists'] = openspec_dir.is_dir()
    checks['governance_schema_exists'] = (schema_dir / 'schema.yaml').is_file()
    if not checks['openspec_dir_exists']:
        missing.append('openspec/')
    if not checks['governance_schema_exists']:
        missing.append('openspec/schemas/governance/schema.yaml')

    if checks['governance_schema_exists']:
        code, out, err = run(['openspec', 'schema', 'validate', 'governance'], project)
        checks['governance_schema_valid'] = code == 0
        if code != 0:
            warnings.append((out + err).strip())
    else:
        checks['governance_schema_valid'] = False

    if not checks['openspec_dir_exists']:
        result['status'] = 'not_installed'
        result['recommended_next_step'] = 'Initialize or bootstrap target OpenSpec governance after user approval.'
        return result

    if not checks['governance_schema_exists']:
        result['status'] = 'schema_missing'
        result['recommended_next_step'] = 'Run scripts/bootstrap-target-governance.py --project <path> --change <id> after user approval.'
        return result

    changes_dir = openspec_dir / 'changes'
    checks['changes_dir_exists'] = changes_dir.is_dir()
    if not checks['changes_dir_exists']:
        missing.append('openspec/changes')
        result['status'] = 'changes_dir_missing'
        result['recommended_next_step'] = 'Bootstrap or initialize OpenSpec changes directory.'
        return result

    active_changes = sorted(p.name for p in changes_dir.iterdir() if p.is_dir() and p.name != 'archive')
    result['active_changes'] = active_changes

    if not change:
        if not active_changes:
            result['status'] = 'change_missing'
            missing.append('active governance change')
            result['recommended_next_step'] = 'Create a governed change with openspec new change <id> --schema governance, then rerun with --change <id>.'
            return result
        result['status'] = 'change_required'
        missing.append('current governance change id (--change)')
        result['recommended_next_step'] = 'Rerun with --change <current-change-id>; readiness cannot be inferred from unrelated active changes.'
        return result

    change_dir = changes_dir / change
    if not change_dir.is_dir():
        result['status'] = 'change_missing'
        missing.append(f'openspec/changes/{change}')
        result['recommended_next_step'] = f'Create governed change {change} with openspec new change {change} --schema governance.'
        return result

    change_reports = []
    cfg = change_dir / '.openspec.yaml'
    report = {
        'change': change,
        'path': str(change_dir),
        'schema_governance': cfg.is_file() and 'schema: governance' in cfg.read_text(encoding='utf-8', errors='replace'),
        'files': {},
        'specs': {},
        'openspec_validate': False,
        'ready': False,
    }
    files: dict[str, dict[str, object]] = report['files']  # type: ignore[assignment]
    for rel in REQUIRED_CHANGE_FILES:
        files[rel] = evaluate_file(change_dir / rel, rel)
    report['specs'] = evaluate_specs(change_dir / 'specs')

    validate_code, validate_out, validate_err = run(['openspec', 'validate', change, '--strict'], project)
    report['openspec_validate'] = validate_code == 0
    if validate_code != 0:
        warnings.append((validate_out + validate_err).strip())

    report['ready'] = (
        bool(report['schema_governance'])
        and bool(report['openspec_validate'])
        and all(item.get('substantive') for item in files.values())
        and bool(report['specs'].get('substantive'))  # type: ignore[union-attr]
    )
    change_reports.append(report)
    result['change_reports'] = change_reports

    if not report['ready']:
        result['status'] = 'contract_incomplete'
        if not report['schema_governance']:
            missing.append(f'openspec/changes/{change}/.openspec.yaml with schema: governance')
        if not report['openspec_validate']:
            missing.append(f'valid OpenSpec change: {change}')
        for rel, file_report in files.items():
            if not file_report.get('substantive'):
                missing.append(f'substantive {rel}')
        if not report['specs'].get('substantive'):  # type: ignore[union-attr]
            missing.append('substantive specs/**/*.md')
        result['recommended_next_step'] = 'Fill real proposal/spec/design/role-contract/tasks/kpi-events/external-audit content for the current change before implementation.'
        return result

    result['status'] = 'ready'
    result['ready'] = True
    result['recommended_next_step'] = f'Proceed with diagnostician/reviewer gates for current change {change}; do not skip evidence collection.'
    return result


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description='Check target project governance activation readiness')
    parser.add_argument('--project', required=True, type=Path, help='Target project root containing openspec/')
    parser.add_argument('--change', help='Specific OpenSpec change id to inspect')
    parser.add_argument('--json', action='store_true', help='Output JSON only')
    args = parser.parse_args(argv)

    result = check_project(args.project, args.change)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"Project: {result['project']}")
        print(f"Status: {result['status']}")
        print(f"Ready: {result['ready']}")
        missing = result.get('missing') or []
        if missing:
            print('Missing:')
            for item in missing:
                print(f'- {item}')
        warnings = result.get('warnings') or []
        if warnings:
            print('Warnings:')
            for item in warnings:
                print(f'- {item}')
        print(f"Next: {result['recommended_next_step']}")
    return 0 if result.get('ready') else 2


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
