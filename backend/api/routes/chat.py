from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ...ai.interpreter import InterpretationError, interpret_strategy
from ...ai.templates import TEMPLATES
from ..schemas import InterpretRequest, InterpretResponse, TemplateInfo, TemplateParamInfo

router = APIRouter()


@router.get("/templates", response_model=list[TemplateInfo])
def list_templates() -> list[TemplateInfo]:
    """Every strategy template the AI can pick from, with its parameter
    schema -- lets the frontend build a manual template/param picker without
    hardcoding a second copy of this information in TypeScript. The backend
    registry (ai/templates.py) stays the single source of truth.
    """
    templates = []
    for template in TEMPLATES.values():
        params = [
            TemplateParamInfo(
                name=name,
                type=prop["type"],
                description=prop.get("description", ""),
                default=prop.get("default"),
            )
            for name, prop in template.input_schema["properties"].items()
            if name != "reasoning"  # internal to the AI call, not a real strategy param
        ]
        templates.append(
            TemplateInfo(id=template.id, label=template.label, description=template.description, params=params)
        )
    return templates


@router.post("/interpret-strategy", response_model=InterpretResponse)
def interpret_strategy_endpoint(request: InterpretRequest) -> InterpretResponse:
    """Phase 3: map a plain-English strategy description to a template +
    params via Claude tool use. Returns the match for the frontend to show
    the user *before* anything runs -- interpretation and execution are two
    separate steps on purpose, so a bad match is visible and correctable
    rather than silently backtested.
    """
    try:
        match = interpret_strategy(request.description)
    except InterpretationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return InterpretResponse(
        template=match.template_id,
        label=TEMPLATES[match.template_id].label,
        params=match.params,
        reasoning=match.reasoning,
    )
