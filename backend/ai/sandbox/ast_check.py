from __future__ import annotations

import ast

# getattr/setattr/delattr aren't in the brief's literal list ("block imports,
# eval/exec, file I/O, dunder attribute access"), but they're the standard
# way to dodge a purely-syntactic dunder check: `x.__class__` is caught below
# as an ast.Attribute node, but `getattr(x, "__class__")` is just a function
# call with a string argument -- same effect, invisible to that check. This
# closes that gap rather than leaving the rule trivially bypassable.
FORBIDDEN_CALL_NAMES = {
    "eval",
    "exec",
    "compile",
    "open",
    "__import__",
    "getattr",
    "setattr",
    "delattr",
    "globals",
    "locals",
    "vars",
    "input",
}


def check_strategy_code(code: str) -> list[str]:
    """Static safety check on AI-generated strategy code, run before any
    execution -- even inside Docker. Returns a list of human-readable
    violations; empty means the code passed.

    This is deliberately not the only line of defense (Docker's --network
    none, resource limits, and read-only filesystem hold even if something
    slips past this), but it's a free, instant rejection for obviously
    unsafe code, and its messages are what get fed back to Claude in the
    codegen retry loop -- a clear "imports aren't allowed" is more useful
    feedback than a container failure would be.
    """
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return [f"Syntax error at line {exc.lineno}: {exc.msg}"]

    violations: list[str] = []

    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            violations.append(f"Line {node.lineno}: imports are not allowed.")
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in FORBIDDEN_CALL_NAMES:
            violations.append(f"Line {node.lineno}: calling '{node.func.id}' is not allowed.")
        elif isinstance(node, ast.Attribute) and node.attr.startswith("__") and node.attr.endswith("__"):
            violations.append(f"Line {node.lineno}: accessing '{node.attr}' (a dunder attribute) is not allowed.")

    return violations
