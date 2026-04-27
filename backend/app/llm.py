from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from litellm import completion

from .config import settings


def trim_messages(messages: list[dict[str, str]], char_budget: int | None = None) -> list[dict[str, str]]:
    budget = char_budget or settings.context_char_budget
    if sum(len(item.get("content", "")) for item in messages) <= budget:
        return messages

    system_messages = [item for item in messages if item["role"] == "system"]
    conversational = [item for item in messages if item["role"] != "system"]
    kept: list[dict[str, str]] = []
    total = sum(len(item.get("content", "")) for item in system_messages)
    for item in reversed(conversational):
        size = len(item.get("content", ""))
        if total + size > budget:
            break
        kept.append(item)
        total += size
    kept.reverse()
    omitted = len(conversational) - len(kept)
    if omitted > 0:
        system_messages.append(
            {
                "role": "system",
                "content": f"为控制上下文长度，较早的 {omitted} 条可见消息已被滑动窗口剪裁；请优先依据当前保留的上下文作答。",
            }
        )
    return [*system_messages, *kept]


def provider_kwargs(provider: dict[str, Any], *, max_tokens_override: int | None = None) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "model": provider["model_name"],
        "temperature": provider["temperature"],
        "max_tokens": max_tokens_override or provider["max_tokens"],
    }
    if provider.get("api_key"):
        kwargs["api_key"] = provider["api_key"]
    if provider.get("base_url"):
        kwargs["api_base"] = provider["base_url"]
    if provider.get("provider_type") == "azure_openai":
        kwargs["api_type"] = "azure"
    return kwargs


def complete_chat(provider: dict[str, Any], messages: list[dict[str, str]]) -> str:
    safe_messages = trim_messages(messages)
    try:
        response = completion(
            messages=safe_messages,
            **provider_kwargs(provider),
        )
    except Exception as exc:  # LiteLLM surfaces provider-specific errors here.
        raise HTTPException(status_code=502, detail=f"模型调用失败：{exc}") from exc
    try:
        content = response.choices[0].message.content
    except Exception as exc:
        raise HTTPException(status_code=502, detail="模型返回格式异常，未找到 assistant message") from exc
    if not content:
        raise HTTPException(status_code=502, detail="模型返回了空内容")
    return str(content)


def test_provider(provider: dict[str, Any]) -> str:
    try:
        response = completion(
            messages=[
                {"role": "system", "content": "You are a connectivity checker."},
                {"role": "user", "content": "Reply with exactly: ok"},
            ],
            **provider_kwargs(provider, max_tokens_override=16),
        )
        content = response.choices[0].message.content or ""
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Provider 测试失败：{exc}") from exc
    return content.strip()

