#!/usr/bin/env python3
"""Read-only document baseline checks for document-driven target projects."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

STATUS_RE = re.compile(r'\b(draft|active|superseded|archived)\b', re.I)
MARKDOWN_LINK_RE = re.compile(r'\[[^\]]+\]\(([^)]+)\)')
PATH_LIKE_RE = re.compile(r'(?P<path>(?:docs|\.\/docs)[^\s`|)]*\.(?:md|markdown))')
ACTIVE_RE = re.compile(r'\bactive\b', re.I)
ARCHIVED_RE = re.compile(r'\b(superseded|archived)\b', re.I)

REQUIRED_ANCHORS = [
    'index.md',
    'current.md',
    'traceability-matrix.md',
]

LOCK_FILENAMES = {
    'document-baseline.md',
    'execution-baseline-lock.md',
}

SLOT_ALIASES = {
    'prd': {'prd', '项目需求详细说明书', '需求详细说明书'},
    'functional-spec': {'functional spec', '功能说明', '功能说明书'},
    'architecture': {'architecture', '架构', '架构设计', '系统架构'},
    'ui-prototype': {'ui', 'ui 原型', '原型', '交互'},
    'api-contract': {'api', '接口', '数据契约', '接口契约'},
    'acceptance': {'acceptance', '验收', '验收口径', '验收标准'},
}


@dataclass
class Finding:
    level: str
    message: str


def rel(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


def read(path: Path) -> str:
    return path.read_text(encoding='utf-8') if path.exists() else ''


def normalize_ref(raw: str) -> str:
    value = raw.strip().strip('`').strip()
    if '#' in value:
        value = value.split('#', 1)[0]
    return value


def extract_refs(text: str) -> list[str]:
    refs: list[str] = []
    for match in MARKDOWN_LINK_RE.finditer(text):
        refs.append(normalize_ref(match.group(1)))
    for match in PATH_LIKE_RE.finditer(text):
        refs.append(normalize_ref(match.group('path')))
    return [ref for ref in refs if ref and not ref.startswith(('http://', 'https://', 'mailto:'))]


def resolve_ref(project: Path, governance_dir: Path, ref: str) -> Path:
    path = Path(ref)
    if path.is_absolute():
        return path
    if ref.startswith('./'):
        return (governance_dir / path).resolve()
    if ref.startswith('docs/'):
        return (project / path).resolve()
    return (governance_dir / path).resolve()


def table_rows(text: str) -> list[list[str]]:
    rows: list[list[str]] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped.startswith('|') or not stripped.endswith('|'):
            continue
        cells = [cell.strip() for cell in stripped.strip('|').split('|')]
        if cells and all(set(cell) <= {'-', ':', ' '} for cell in cells):
            continue
        rows.append(cells)
    return rows


def slot_for_text(text: str) -> str | None:
    lower = text.lower()
    for slot, aliases in SLOT_ALIASES.items():
        if any(alias.lower() in lower for alias in aliases):
            return slot
    return None


def active_slots_from_current(text: str) -> dict[str, list[str]]:
    slots: dict[str, list[str]] = {}
    for row in table_rows(text):
        joined = ' | '.join(row)
        if not ACTIVE_RE.search(joined):
            continue
        if ARCHIVED_RE.search(joined.replace('active', '', 1)):
            # Rows that contain both active and archived are ambiguous; keep active
            # if active appears as a status, but avoid treating header text as data.
            pass
        slot = slot_for_text(row[0] if row else joined) or slot_for_text(joined)
        if not slot:
            continue
        slots.setdefault(slot, []).append(joined)
    return slots


def find_module_current_files(governance_dir: Path) -> list[Path]:
    modules_dir = governance_dir / '01-requirements' / 'modules'
    if not modules_dir.exists():
        return []
    return sorted(path for path in modules_dir.glob('*/current.md') if path.is_file())


def add_gate_gap(findings: list[Finding], warnings: list[Finding], message: str, advisory: bool) -> None:
    if advisory:
        warnings.append(Finding('WARN', message))
    else:
        findings.append(Finding('FAIL', message))


def check_project(project: Path, advisory: bool = False) -> tuple[list[Finding], list[Finding]]:
    findings: list[Finding] = []
    warnings: list[Finding] = []
    governance_dir = project / 'docs' / 'project-governance'

    if not governance_dir.exists():
        findings.append(Finding('FAIL', f'missing docs/project-governance directory under {project}'))
        return findings, warnings

    for anchor in REQUIRED_ANCHORS:
        path = governance_dir / anchor
        if not path.is_file():
            findings.append(Finding('FAIL', f'missing required anchor: {rel(path, project)}'))

    current = governance_dir / 'current.md'
    current_text = read(current)
    if current.exists():
        if 'active' not in current_text.lower():
            warnings.append(Finding('WARN', 'current.md has no explicit active status marker'))

        refs = extract_refs(current_text)
        missing_refs: list[str] = []
        stale_refs: list[str] = []
        for ref in refs:
            resolved = resolve_ref(project, governance_dir, ref)
            if not resolved.exists():
                missing_refs.append(ref)
                continue
            target_text = read(resolved)
            if ARCHIVED_RE.search(target_text[:1000]) and not ACTIVE_RE.search(target_text[:1000]):
                stale_refs.append(ref)
        for ref in sorted(set(missing_refs)):
            findings.append(Finding('FAIL', f'current.md references missing document: {ref}'))
        for ref in sorted(set(stale_refs)):
            findings.append(Finding('FAIL', f'current.md appears to reference superseded/archived document: {ref}'))

        active_slots = active_slots_from_current(current_text)
        for slot, rows in active_slots.items():
            if len(rows) > 1:
                findings.append(Finding('FAIL', f'multiple active current documents for slot {slot}: {len(rows)} rows'))

    traceability = governance_dir / 'traceability-matrix.md'
    trace_text = read(traceability)
    if traceability.exists():
        for marker in ['需求', '架构', 'UI', '开发', 'QA', 'reviewer']:
            if marker not in trace_text:
                warnings.append(Finding('WARN', f'traceability-matrix.md may be missing column/marker: {marker}'))

    module_current_files = find_module_current_files(governance_dir)
    if not module_current_files:
        add_gate_gap(
            findings,
            warnings,
            'missing module current files at 01-requirements/modules/<module-id>/current.md; use --advisory only for planning, non-module or explicitly simplified tasks',
            advisory,
        )
    for module_current in module_current_files:
        text = read(module_current)
        if 'active' not in text.lower():
            findings.append(Finding('FAIL', f'module current lacks active marker: {rel(module_current, project)}'))
        active_count = len(re.findall(r'\bactive\b', text, re.I))
        if active_count > 3 and 'superseded' not in text.lower():
            warnings.append(Finding('WARN', f'module current has many active markers; verify only one active requirement: {rel(module_current, project)}'))
        refs = extract_refs(text)
        if not refs:
            warnings.append(Finding('WARN', f'module current has no document reference: {rel(module_current, project)}'))
        for ref in refs:
            resolved = resolve_ref(project, module_current.parent, ref)
            if not resolved.exists():
                findings.append(Finding('FAIL', f'{rel(module_current, project)} references missing document: {ref}'))

    lock_candidates = [governance_dir / name for name in LOCK_FILENAMES]
    if (governance_dir / '07-baseline').exists():
        lock_candidates.extend(
            path
            for path in (governance_dir / '07-baseline').glob('*.md')
            if 'baseline' in path.stem.lower() or 'lock' in path.stem.lower()
        )
    if not any(path.exists() for path in lock_candidates):
        add_gate_gap(
            findings,
            warnings,
            'missing execution baseline lock; required before implementation/QA/diagnostician/reviewer gates unless --advisory is explicitly used for planning or simplified tasks',
            advisory,
        )

    index_text = read(governance_dir / 'index.md')
    if index_text and not STATUS_RE.search(index_text):
        warnings.append(Finding('WARN', 'index.md has no draft/active/superseded/archived status markers'))

    return findings, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description='Read-only check for project document current baseline drift')
    parser.add_argument('--project', required=True, help='Target project root containing docs/project-governance')
    parser.add_argument('--strict', action='store_true', help='Treat all warnings as failures')
    parser.add_argument('--advisory', action='store_true', help='Downgrade module/lock gate gaps to warnings for planning or explicitly simplified tasks; do not use for implementation/QA/diagnostician/reviewer gates')
    args = parser.parse_args()

    project = Path(args.project).expanduser().resolve()
    failures, warnings = check_project(project, advisory=args.advisory)

    for finding in failures:
        print(f'[{finding.level}] {finding.message}')
    for finding in warnings:
        print(f'[{finding.level}] {finding.message}')

    if failures or (args.strict and warnings):
        print(f'blocked: document baseline check found {len(failures)} failure(s) and {len(warnings)} warning(s)')
        return 1

    print(f'pass: document baseline check satisfied with {len(warnings)} warning(s)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
