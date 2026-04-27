from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from litellm import completion
import json
import requests

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
    api_base = normalize_api_base(provider.get("base_url"))
    kwargs: dict[str, Any] = {
        "model": provider["model_name"],
        "temperature": provider["temperature"],
        "max_tokens": max_tokens_override or provider["max_tokens"],
    }
    if provider.get("api_key"):
        kwargs["api_key"] = provider["api_key"]
    if api_base:
        kwargs["api_base"] = api_base
    if provider.get("provider_type") == "azure_openai":
        kwargs["api_type"] = "azure"
    elif should_use_openai_compatible(provider, api_base):
        kwargs["custom_llm_provider"] = "openai"
    return kwargs


def is_siliconflow_provider(provider: dict[str, Any]) -> bool:
    api_base = normalize_api_base(provider.get("base_url")) or ""
    return "siliconflow.cn" in api_base


def normalize_api_base(base_url: str | None) -> str | None:
    if not base_url:
        return None
    normalized = base_url.rstrip("/")
    if normalized == "https://api.siliconflow.cn":
        return f"{normalized}/v1"
    return normalized


def chat_completions_url(provider: dict[str, Any]) -> str:
    api_base = normalize_api_base(provider.get("base_url"))
    if not api_base:
        raise HTTPException(status_code=400, detail="OpenAI 兼容调用缺少 Base URL")
    return f"{api_base.rstrip('/')}/chat/completions"


def should_use_openai_compatible(provider: dict[str, Any], api_base: str | None) -> bool:
    if not api_base:
        return False
    if provider.get("provider_type") == "custom":
        return True
    if "siliconflow.cn" in api_base:
        return True
    model_name = str(provider.get("model_name") or "")
    return not any(
        model_name.startswith(prefix)
        for prefix in ("openai/", "deepseek/", "dashscope/", "gemini/", "azure/")
    )


def complete_chat(
    provider: dict[str, Any],
    messages: list[dict[str, str]],
    *,
    max_tokens_override: int | None = None,
) -> str:
    safe_messages = trim_messages(messages)
    if is_siliconflow_provider(provider):
        return complete_openai_compatible(provider, safe_messages, max_tokens_override=max_tokens_override)
    try:
        response = completion(
            messages=safe_messages,
            **provider_kwargs(provider, max_tokens_override=max_tokens_override),
        )
    except Exception as exc:  # LiteLLM surfaces provider-specific errors here.
        if is_siliconflow_provider(provider):
            return complete_openai_compatible(provider, safe_messages, max_tokens_override=max_tokens_override)
        raise HTTPException(status_code=502, detail=f"模型调用失败：{exc}") from exc
    try:
        content = response.choices[0].message.content
    except Exception as exc:
        raise HTTPException(status_code=502, detail="模型返回格式异常，未找到 assistant message") from exc
    if not content:
        raise HTTPException(status_code=502, detail="模型返回了空内容")
    return str(content)


def stream_chat(provider: dict[str, Any], messages: list[dict[str, str]]):
    safe_messages = trim_messages(messages)
    if is_siliconflow_provider(provider):
        yield from stream_openai_compatible(provider, safe_messages)
        return
    try:
        response = completion(
            messages=safe_messages,
            stream=True,
            **provider_kwargs(provider),
        )
        for chunk in response:
            delta = ""
            try:
                delta = chunk.choices[0].delta.content or ""
            except Exception:
                delta = ""
            if delta:
                yield str(delta)
    except Exception as exc:
        if is_siliconflow_provider(provider):
            yield from stream_openai_compatible(provider, safe_messages)
            return
        raise HTTPException(status_code=502, detail=f"模型流式调用失败：{exc}") from exc


def test_provider(provider: dict[str, Any]) -> str:
    test_messages = [
        {"role": "system", "content": "You are a connectivity checker."},
        {"role": "user", "content": "Reply with exactly: ok"},
    ]
    if is_siliconflow_provider(provider):
        return complete_openai_compatible(provider, test_messages, max_tokens_override=16)
    try:
        response = completion(
            messages=test_messages,
            **provider_kwargs(provider, max_tokens_override=16),
        )
        content = response.choices[0].message.content or ""
    except Exception as exc:
        if is_siliconflow_provider(provider):
            return complete_openai_compatible(
                provider,
                [
                    {"role": "system", "content": "You are a connectivity checker."},
                    {"role": "user", "content": "Reply with exactly: ok"},
                ],
                max_tokens_override=16,
            )
        raise HTTPException(status_code=502, detail=f"Provider 测试失败：{exc}") from exc
    return content.strip()


def native_payload(
    provider: dict[str, Any],
    messages: list[dict[str, str]],
    *,
    stream: bool = False,
    max_tokens_override: int | None = None,
) -> dict[str, Any]:
    return {
        "model": provider["model_name"],
        "messages": messages,
        "temperature": provider["temperature"],
        "max_tokens": max_tokens_override or provider["max_tokens"],
        "stream": stream,
    }


def native_session() -> requests.Session:
    session = requests.Session()
    # Avoid local/system proxy settings breaking HTTPS handshakes for SiliconFlow.
    session.trust_env = False
    return session


def complete_openai_compatible(
    provider: dict[str, Any],
    messages: list[dict[str, str]],
    *,
    max_tokens_override: int | None = None,
) -> str:
    try:
        response = native_session().post(
            chat_completions_url(provider),
            headers={
                "Authorization": f"Bearer {provider.get('api_key') or ''}",
                "Content-Type": "application/json",
            },
            json=native_payload(provider, messages, max_tokens_override=max_tokens_override),
            timeout=90,
        )
        response.raise_for_status()
        content = json.loads(response.content.decode("utf-8"))["choices"][0]["message"]["content"]
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI 兼容模型调用失败：{exc}") from exc
    if not content:
        raise HTTPException(status_code=502, detail="模型返回了空内容")
    return str(content).strip()


def stream_openai_compatible(provider: dict[str, Any], messages: list[dict[str, str]]):
    try:
        with native_session().post(
            chat_completions_url(provider),
            headers={
                "Authorization": f"Bearer {provider.get('api_key') or ''}",
                "Content-Type": "application/json",
            },
            json=native_payload(provider, messages, stream=True),
            timeout=120,
            stream=True,
        ) as response:
            response.raise_for_status()
            for raw_line in response.iter_lines(decode_unicode=False):
                if not raw_line:
                    continue
                line = raw_line.decode("utf-8")
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                except json.JSONDecodeError:
                    continue
                delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content") or ""
                if delta:
                    yield str(delta)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI 兼容模型流式调用失败：{exc}") from exc
