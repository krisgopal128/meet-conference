#!/usr/bin/env python3
from __future__ import annotations

import ast
import builtins
import html.parser
import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


ROOT = Path("/opt")
EXCLUDED_DIRS = {
    "node_modules",
    "dist",
    ".git",
    "__pycache__",
    ".next",
    "coverage",
    "build",
}
TARGET_SUFFIXES = {".py", ".js", ".jsx", ".ts", ".tsx", ".html"}
PLACEHOLDER_PATTERNS = [
    re.compile(r"\bTODO\b", re.IGNORECASE),
    re.compile(r"\bFIXME\b", re.IGNORECASE),
    re.compile(r"\bXXX\b"),
    re.compile(r"NotImplemented(Error)?"),
    re.compile(r"throw new Error\((['\"])(?:not implemented|todo)\1\)", re.IGNORECASE),
]
SQL_TABLE_PATTERN = re.compile(
    r"\b(?:FROM|JOIN|UPDATE|INTO|DELETE\s+FROM)\s+([a-zA-Z_][a-zA-Z0-9_]*)",
    re.IGNORECASE,
)
ROUTE_MOUNT_PATTERN = re.compile(r"app\.use\(\s*['\"]([^'\"]+)['\"]\s*,\s*(\w+)\s*\)")
ROUTE_DEF_PATTERN = re.compile(r"\b\w+Router\.(get|post|put|patch|delete)\(\s*['\"]([^'\"]+)['\"]")
APP_ROUTE_DEF_PATTERN = re.compile(r"\bapp\.(get|post|put|patch|delete)\(\s*['\"]([^'\"]+)['\"]")
API_CALL_PATTERN = re.compile(
    r"api\.(get|post|put|patch|delete)\(\s*(?:`([^`]+)`|['\"]([^'\"]+)['\"])",
    re.MULTILINE,
)
INLINE_HANDLER_PATTERN = re.compile(r"\bon[a-zA-Z]+\s*=\s*['\"]\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(")
JSX_HANDLER_PATTERN = re.compile(r"\bon[A-Z][A-Za-z0-9_]*\s*=\s*\{([A-Za-z_$][\w$]*)\}")
CALLBACK_REF_PATTERN = re.compile(
    r"\b(?:setTimeout|setInterval|addEventListener|removeEventListener|on|off)\s*\([^,\n]+,\s*([A-Za-z_$][\w$]*)\b"
)
QUERY_STRING_PATTERN = re.compile(
    r"\b(?:query|queryOne)\s*(?:<[\s\S]*?>)?\s*\(\s*([`'\"])([\s\S]*?)\1",
    re.MULTILINE,
)


@dataclass
class Finding:
    category: str
    status: str
    target: str
    detail: str


def rel(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def iter_files(root: Path) -> Iterable[Path]:
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.resolve() == Path(__file__).resolve():
            continue
        if any(part in EXCLUDED_DIRS for part in path.parts):
            continue
        if path.suffix.lower() in TARGET_SUFFIXES:
            yield path


def run_command(cmd: list[str], cwd: Path) -> tuple[int, str]:
    try:
        completed = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except FileNotFoundError as exc:
        return 127, str(exc)
    except subprocess.TimeoutExpired:
        return 124, "Command timed out"

    output = "\n".join(part for part in [completed.stdout.strip(), completed.stderr.strip()] if part).strip()
    return completed.returncode, output


def add_command_result(findings: list[Finding], category: str, target: str, cmd: list[str], cwd: Path) -> None:
    code, output = run_command(cmd, cwd)
    if code == 0:
        findings.append(Finding(category, "PASS", target, "ok"))
    else:
        detail = output.splitlines()[0] if output else f"exit code {code}"
        findings.append(Finding(category, "FAIL", target, detail[:220]))


def check_project_commands(findings: list[Finding]) -> None:
    for project in [ROOT / "meet-backend", ROOT / "meet-frontend"]:
        package_json = project / "package.json"
        if not package_json.exists():
            continue
        package = json.loads(package_json.read_text())
        scripts = package.get("scripts", {})

        if "build" in scripts:
            add_command_result(findings, "build", rel(project), ["npm", "run", "build"], project)
        else:
            findings.append(Finding("build", "WARN", rel(project), "no build script"))

        if "lint" in scripts:
            add_command_result(findings, "lint", rel(project), ["npm", "run", "lint"], project)
        else:
            findings.append(Finding("lint", "WARN", rel(project), "no lint script"))


def check_python_syntax(findings: list[Finding], path: Path, content: str) -> None:
    try:
        ast.parse(content, filename=str(path))
    except SyntaxError as exc:
        findings.append(Finding("syntax", "FAIL", rel(path), f"python syntax error: {exc.msg} (line {exc.lineno})"))


class BasicHTMLParser(html.parser.HTMLParser):
    def error(self, message: str) -> None:  # pragma: no cover
        raise ValueError(message)


def check_html_syntax(findings: list[Finding], path: Path, content: str) -> None:
    parser = BasicHTMLParser()
    try:
        parser.feed(content)
        parser.close()
    except Exception as exc:
        findings.append(Finding("syntax", "FAIL", rel(path), f"html parse error: {exc}"))


def check_placeholders(findings: list[Finding], path: Path, content: str) -> None:
    for pattern in PLACEHOLDER_PATTERNS:
        match = pattern.search(content)
        if match:
            findings.append(Finding("incomplete", "WARN", rel(path), f"placeholder marker: {match.group(0)}"))
            return


class PythonFunctionAudit(ast.NodeVisitor):
    def __init__(self) -> None:
        self.defined: set[str] = set()
        self.imported: set[str] = set()
        self.called: list[tuple[str, int]] = []
        self.incomplete: list[tuple[str, int, str]] = []

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            self.imported.add(alias.asname or alias.name.split(".")[0])

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        for alias in node.names:
            self.imported.add(alias.asname or alias.name)

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self.defined.add(node.name)
        self._check_function_body(node.name, node.lineno, node.body)
        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        self.defined.add(node.name)
        self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self.defined.add(node.name)
        self._check_function_body(node.name, node.lineno, node.body)
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        if isinstance(node.func, ast.Name):
            self.called.append((node.func.id, node.lineno))
        self.generic_visit(node)

    def _check_function_body(self, name: str, lineno: int, body: list[ast.stmt]) -> None:
        if len(body) == 1 and isinstance(body[0], ast.Pass):
            self.incomplete.append((name, lineno, "pass-only function"))
            return
        if len(body) == 1 and isinstance(body[0], ast.Expr):
            value = body[0].value
            if isinstance(value, ast.Constant) and isinstance(value.value, str):
                self.incomplete.append((name, lineno, "docstring-only function"))
                return
        if body and isinstance(body[0], ast.Raise):
            self.incomplete.append((name, lineno, "raises immediately"))


def check_python_semantics(findings: list[Finding], path: Path, content: str) -> None:
    try:
        tree = ast.parse(content, filename=str(path))
    except SyntaxError:
        return

    audit = PythonFunctionAudit()
    audit.visit(tree)
    builtin_names = set(dir(builtins))
    for name, lineno, detail in audit.incomplete:
        findings.append(Finding("incomplete", "WARN", rel(path), f"{name} line {lineno}: {detail}"))

    known = audit.defined | audit.imported | builtin_names
    for name, lineno in audit.called:
        if name not in known:
            findings.append(Finding("missing_fn", "WARN", rel(path), f"call to unresolved name '{name}' at line {lineno}"))


def find_js_ts_incomplete(content: str) -> list[tuple[int, str]]:
    incomplete: list[tuple[str, int, str]] = []

    lines = content.splitlines()
    for lineno, line in enumerate(lines, start=1):
        stripped = line.strip()
        if re.search(r"throw new Error\((['\"])(?:not implemented|todo)\1\)", stripped, re.IGNORECASE):
            incomplete.append((lineno, "throws not implemented"))
        if re.fullmatch(r"//\s*(todo|fixme)\b.*", stripped, re.IGNORECASE):
            incomplete.append((lineno, "todo/fixme comment"))
    return incomplete


def collect_js_ts_known_names(content: str) -> set[str]:
    known: set[str] = {
        "console",
        "window",
        "document",
        "navigator",
        "setTimeout",
        "setInterval",
        "clearTimeout",
        "clearInterval",
        "useState",
        "useEffect",
        "useRef",
        "useMemo",
        "useCallback",
        "useContext",
    }

    for match in re.finditer(r"^\s*import\s*\{([^}]*)\}\s*from\b", content, re.MULTILINE):
        known.update(part.strip().split(" as ")[-1] for part in match.group(1).split(",") if part.strip())
    for match in re.finditer(r"^\s*import\s+([A-Za-z_$][\w$]*)\s+from\b", content, re.MULTILINE):
        known.add(match.group(1))
    for match in re.finditer(r"\bfunction\s+([A-Za-z_$][\w$]*)\s*\(", content):
        known.add(match.group(1))
    for match in re.finditer(r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=", content):
        known.add(match.group(1))
    for match in re.finditer(r"\b(?:const|let|var)\s*\{([^}]*)\}\s*=", content):
        for part in match.group(1).split(","):
            name = part.strip().split(":")[0].strip()
            if name:
                known.add(name)
    for match in re.finditer(r"\bconst\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\]\s*=\s*useState\b", content):
        known.update(match.groups())
    return known


def check_js_ts_missing_functions(findings: list[Finding], path: Path, content: str) -> None:
    known = collect_js_ts_known_names(content)
    unresolved: set[str] = set()

    for pattern in [JSX_HANDLER_PATTERN, CALLBACK_REF_PATTERN]:
        for match in pattern.finditer(content):
            name = match.group(1)
            if name not in known:
                unresolved.add(name)

    for name in sorted(unresolved):
        findings.append(Finding("missing_fn", "WARN", rel(path), f"referenced callback '{name}' has no local definition/import"))


def check_js_ts_semantics(findings: list[Finding], path: Path, content: str) -> None:
    for lineno, detail in find_js_ts_incomplete(content):
        findings.append(Finding("incomplete", "WARN", rel(path), f"line {lineno}: {detail}"))

    check_js_ts_missing_functions(findings, path, content)


def check_react_state_issues(findings: list[Finding], path: Path, content: str) -> None:
    if path.suffix not in {".ts", ".tsx", ".js"}:
        return
    for match in re.finditer(r"\bconst\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\]\s*=\s*useState\b", content):
        state_name, setter_name = match.groups()
        if len(re.findall(rf"\b{re.escape(state_name)}\b", content)) <= 1:
            findings.append(Finding("state", "WARN", rel(path), f"state '{state_name}' appears unused"))
        if len(re.findall(rf"\b{re.escape(setter_name)}\b", content)) <= 1:
            findings.append(Finding("state", "WARN", rel(path), f"state setter '{setter_name}' appears unused"))


def check_html_handlers(findings: list[Finding], path: Path, content: str) -> None:
    handlers = {match.group(1) for match in INLINE_HANDLER_PATTERN.finditer(content)}
    if not handlers:
        return
    defined = {match.group(1) for match in re.finditer(r"\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(", content)}
    for handler in sorted(handlers - defined):
        findings.append(Finding("missing_fn", "WARN", rel(path), f"inline handler '{handler}' has no local function definition"))


def parse_schema_tables(schema_path: Path) -> set[str]:
    content = schema_path.read_text() if schema_path.exists() else ""
    return {
        match.group(1)
        for match in re.finditer(r"CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-zA-Z_][a-zA-Z0-9_]*)", content, re.IGNORECASE)
    }


def check_schema_matches(findings: list[Finding]) -> None:
    schema_tables = parse_schema_tables(ROOT / "meet-backend" / "src" / "db" / "schema.sql")
    migration_dir = ROOT / "meet-backend" / "migrations"
    for migration in migration_dir.glob("*.sql"):
        schema_tables.update(
            match.group(1)
            for match in re.finditer(r"CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-zA-Z_][a-zA-Z0-9_]*)", migration.read_text(), re.IGNORECASE)
        )

    lower_schema = {name.lower() for name in schema_tables}
    for path in (ROOT / "meet-backend" / "src").rglob("*.ts"):
        if any(part in EXCLUDED_DIRS for part in path.parts):
            continue
        content = path.read_text()
        referenced: set[str] = set()
        for query_match in QUERY_STRING_PATTERN.finditer(content):
            referenced.update(match.group(1) for match in SQL_TABLE_PATTERN.finditer(query_match.group(2)))
        for table in sorted(referenced):
            if table.lower() not in lower_schema:
                findings.append(Finding("schema", "FAIL", rel(path), f"references unknown table '{table}'"))


def normalize_path_template(template: str) -> str:
    template = template.strip()
    template = re.sub(r"\$\{[^}]+\}", ":param", template)
    template = re.sub(r":\w+", ":param", template)
    template = re.sub(r"\?.*$", "", template)
    template = re.sub(r"/+", "/", template)
    if template != "/" and template.endswith("/"):
        template = template[:-1]
    return template


def collect_backend_routes() -> set[tuple[str, str]]:
    index_path = ROOT / "meet-backend" / "src" / "index.ts"
    mounts: dict[str, str] = {}
    routes: set[tuple[str, str]] = set()
    if index_path.exists():
        index_content = index_path.read_text()
        for prefix, router_name in ROUTE_MOUNT_PATTERN.findall(index_content):
            mounts[router_name] = prefix
        for method, route in APP_ROUTE_DEF_PATTERN.findall(index_content):
            routes.add((method.upper(), normalize_path_template(route)))

    for path in (ROOT / "meet-backend" / "src" / "routes").glob("*.ts"):
        content = path.read_text()
        router_name = path.stem + "Router"
        prefix = mounts.get(router_name, "")
        for method, route in ROUTE_DEF_PATTERN.findall(content):
            full_path = normalize_path_template(f"{prefix}{route}")
            routes.add((method.upper(), full_path))
    return routes


def collect_frontend_api_calls() -> set[tuple[str, str, str]]:
    api_path = ROOT / "meet-frontend" / "src" / "services" / "api.ts"
    calls: set[tuple[str, str, str]] = set()
    if not api_path.exists():
        return calls
    content = api_path.read_text()
    for match in API_CALL_PATTERN.finditer(content):
        method = match.group(1).upper()
        raw_path = match.group(2) or match.group(3) or ""
        calls.add((method, normalize_path_template(raw_path), rel(api_path)))
    return calls


def check_api_connections(findings: list[Finding]) -> None:
    backend_routes = collect_backend_routes()
    frontend_calls = collect_frontend_api_calls()

    for method, path, source in sorted(frontend_calls):
        if (method, path) not in backend_routes:
            findings.append(Finding("api", "FAIL", source, f"{method} {path} has no matching backend route"))


def scan_source_files(findings: list[Finding]) -> None:
    for path in iter_files(ROOT):
        content = path.read_text(errors="replace")
        check_placeholders(findings, path, content)

        if path.suffix == ".py":
            check_python_syntax(findings, path, content)
            check_python_semantics(findings, path, content)
        elif path.suffix in {".js", ".jsx", ".ts", ".tsx"}:
            check_js_ts_semantics(findings, path, content)
            check_react_state_issues(findings, path, content)
        elif path.suffix == ".html":
            check_html_syntax(findings, path, content)
            check_html_handlers(findings, path, content)


def format_table(rows: list[list[str]]) -> str:
    headers = ["Category", "Status", "Target", "Detail"]
    widths = [len(header) for header in headers]
    normalized: list[list[str]] = []
    for row in rows:
        cleaned = [cell.replace("\n", " ").strip() for cell in row]
        normalized.append(cleaned)
        widths = [max(width, len(cell)) for width, cell in zip(widths, cleaned)]

    def fmt(row: list[str]) -> str:
        return " | ".join(cell.ljust(width) for cell, width in zip(row, widths))

    line = "-+-".join("-" * width for width in widths)
    output = [fmt(headers), line]
    output.extend(fmt(row) for row in normalized)
    return "\n".join(output)


def summarize(findings: list[Finding]) -> list[Finding]:
    if not findings:
        return [Finding("summary", "PASS", ".", "no issues detected by scripted checks")]
    findings.sort(key=lambda item: (item.status, item.category, item.target, item.detail))
    return findings


def main() -> int:
    findings: list[Finding] = []
    check_project_commands(findings)
    scan_source_files(findings)
    check_schema_matches(findings)
    check_api_connections(findings)

    summary = summarize(findings)
    rows = [[finding.category, finding.status, finding.target, finding.detail] for finding in summary]
    print(format_table(rows))
    return 0 if all(f.status == "PASS" for f in summary) else 1


if __name__ == "__main__":
    raise SystemExit(main())
