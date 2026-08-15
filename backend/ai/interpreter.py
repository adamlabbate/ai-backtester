from __future__ import annotations

from dataclasses import dataclass

from .client import MODEL, get_client
from .templates import TEMPLATES

SYSTEM_PROMPT = (
    "You map a plain-English trading strategy description onto exactly one of the "
    "provided strategy templates by calling its tool with extracted parameter values. "
    "Only override a parameter's default if the description actually specifies or "
    "clearly implies a value for it -- otherwise leave it at the schema default. Every "
    "template is long-only and defines risk as a percentage stop with a profit target "
    "expressed as a multiple of that risk (R)."
)


class InterpretationError(RuntimeError):
    """Raised when Claude's response can't be turned into a strategy match.

    tool_choice="any" (below) should make this unreachable in normal
    operation -- it's a defensive check, not an expected path.
    """


@dataclass
class StrategyMatch:
    template_id: str
    params: dict
    reasoning: str


def interpret_strategy(description: str) -> StrategyMatch:
    """Ask Claude to pick one of TEMPLATES and fill in its parameters from a
    plain-English description.

    Uses Claude's tool use with tool_choice="any": each template is exposed
    as a tool, and the model *must* call one of them -- there's no code path
    where it returns free-text or anything that needs executing. This is the
    Phase 3 boundary from the brief: template selection + parameter
    extraction only, zero code-execution risk.
    """
    tools = [
        {"name": template.id, "description": template.description, "input_schema": template.input_schema}
        for template in TEMPLATES.values()
    ]

    response = get_client().messages.create(
        model=MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        tools=tools,
        tool_choice={"type": "any"},
        messages=[{"role": "user", "content": description}],
    )

    tool_use = next((block for block in response.content if block.type == "tool_use"), None)
    if tool_use is None:
        raise InterpretationError("Claude did not select a strategy template.")

    params = dict(tool_use.input)
    reasoning = params.pop("reasoning", "")

    return StrategyMatch(template_id=tool_use.name, params=params, reasoning=reasoning)
