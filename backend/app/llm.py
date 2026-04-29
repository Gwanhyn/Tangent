from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from litellm import completion
import json
import os
import requests
import shutil
import ssl
import subprocess
import tempfile
import time
from requests.adapters import HTTPAdapter

from .config import settings


TLS12_ONLY_HOSTS = ("new.lemonapi.site",)
CURL_RETRY_CODES = {28, 35, 52, 56}
CURL_MAX_ATTEMPTS = 16


class TLS12HttpAdapter(HTTPAdapter):
    """Some third-party OpenAI-compatible gateways reset TLS 1.3 handshakes."""

    def init_poolmanager(self, connections, maxsize, block=False, **pool_kwargs):
        context = ssl.create_default_context()
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.maximum_version = ssl.TLSVersion.TLSv1_2
        pool_kwargs["ssl_context"] = context
        return super().init_poolmanager(connections, maxsize, block=block, **pool_kwargs)


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


def requires_tls12(provider: dict[str, Any]) -> bool:
    api_base = normalize_api_base(provider.get("base_url")) or ""
    return any(host in api_base for host in TLS12_ONLY_HOSTS)


def should_call_native_openai_compatible(provider: dict[str, Any]) -> bool:
    api_base = normalize_api_base(provider.get("base_url"))
    if not api_base or provider.get("provider_type") == "azure_openai":
        return False
    if is_siliconflow_provider(provider):
        return True
    return provider.get("provider_type") in {"custom", "openai"}


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
    if should_call_native_openai_compatible(provider):
        return complete_openai_compatible(provider, safe_messages, max_tokens_override=max_tokens_override)
    try:
        response = completion(
            messages=safe_messages,
            **provider_kwargs(provider, max_tokens_override=max_tokens_override),
        )
    except Exception as exc:  # LiteLLM surfaces provider-specific errors here.
        if should_use_openai_compatible(provider, normalize_api_base(provider.get("base_url"))):
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
    if should_call_native_openai_compatible(provider):
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
        if should_use_openai_compatible(provider, normalize_api_base(provider.get("base_url"))):
            yield from stream_openai_compatible(provider, safe_messages)
            return
        raise HTTPException(status_code=502, detail=f"模型流式调用失败：{exc}") from exc


def test_provider(provider: dict[str, Any]) -> str:
    test_messages = [
        {"role": "system", "content": "You are a connectivity checker."},
        {"role": "user", "content": "Reply with exactly: ok"},
    ]
    if should_call_native_openai_compatible(provider):
        return complete_openai_compatible(provider, test_messages, max_tokens_override=16)
    try:
        response = completion(
            messages=test_messages,
            **provider_kwargs(provider, max_tokens_override=16),
        )
        content = response.choices[0].message.content or ""
    except Exception as exc:
        if should_use_openai_compatible(provider, normalize_api_base(provider.get("base_url"))):
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


def curl_executable() -> str:
    executable = shutil.which("curl.exe") or shutil.which("curl")
    if not executable:
        raise HTTPException(status_code=502, detail="当前系统未找到 curl，无法连接该 TLS 1.2 网关")
    return executable


def curl_command(provider: dict[str, Any], *, timeout: int, payload_path: str) -> list[str]:
    return [
        curl_executable(),
        "--silent",
        "--show-error",
        "--fail-with-body",
        "--http1.1",
        "--tlsv1.2",
        "--tls-max",
        "1.2",
        "--connect-timeout",
        "30",
        "--max-time",
        str(timeout),
        "-X",
        "POST",
        chat_completions_url(provider),
        "-H",
        f"Authorization: Bearer {provider.get('api_key') or ''}",
        "-H",
        "Content-Type: application/json",
        "--data-binary",
        f"@{payload_path}",
    ]


def curl_payload_bytes(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def write_curl_payload(payload: dict[str, Any]) -> str:
    handle = tempfile.NamedTemporaryFile(delete=False, suffix=".json")
    try:
        handle.write(curl_payload_bytes(payload))
        return handle.name
    finally:
        handle.close()


def curl_error_message(stderr: bytes, stdout: bytes) -> str:
    detail = "\n".join(
        part.strip()
        for part in (
            stderr.decode("utf-8", errors="ignore"),
            stdout.decode("utf-8", errors="ignore"),
        )
        if part.strip()
    )
    return detail[:800] or "curl 调用失败"


def can_retry_curl(returncode: int) -> bool:
    return returncode in CURL_RETRY_CODES


def curl_retry_pause(attempt: int) -> None:
    time.sleep(min(0.35 * (attempt + 1), 1.5))


def complete_openai_compatible_curl(
    provider: dict[str, Any],
    messages: list[dict[str, str]],
    *,
    max_tokens_override: int | None = None,
) -> str:
    payload = native_payload(provider, messages, max_tokens_override=max_tokens_override)
    payload_path = write_curl_payload(payload)
    try:
        result = None
        for attempt in range(CURL_MAX_ATTEMPTS):
            result = subprocess.run(
                curl_command(provider, timeout=90, payload_path=payload_path),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
                timeout=100,
            )
            if result.returncode == 0 or not can_retry_curl(result.returncode):
                break
            if attempt < CURL_MAX_ATTEMPTS - 1:
                curl_retry_pause(attempt)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI 兼容模型 curl 调用失败：{exc}") from exc
    finally:
        try:
            os.unlink(payload_path)
        except OSError:
            pass
    if result is None or result.returncode != 0:
        raise HTTPException(
            status_code=502,
            detail=f"OpenAI 兼容模型 curl 调用失败：{curl_error_message(result.stderr if result else b'', result.stdout if result else b'')}",
        )
    try:
        content = json.loads(result.stdout.decode("utf-8"))["choices"][0]["message"]["content"]
    except Exception as exc:
        raise HTTPException(status_code=502, detail="OpenAI 兼容模型 curl 返回格式异常") from exc
    if not content:
        raise HTTPException(status_code=502, detail="模型返回了空内容")
    return str(content).strip()


def stream_openai_compatible_curl(provider: dict[str, Any], messages: list[dict[str, str]]):
    payload = native_payload(provider, messages, stream=True)
    payload_path = write_curl_payload(payload)
    try:
        last_stderr = b""
        last_return_code = 0
        for attempt in range(CURL_MAX_ATTEMPTS):
            emitted = False
            process = subprocess.Popen(
                [*curl_command(provider, timeout=120, payload_path=payload_path), "--no-buffer"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            assert process.stdout is not None
            for raw_line in iter(process.stdout.readline, b""):
                if not raw_line:
                    continue
                line = raw_line.decode("utf-8", errors="ignore").strip()
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                except json.JSONDecodeError:
                    continue
                choices = chunk.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta", {}).get("content") or ""
                if delta:
                    emitted = True
                    yield str(delta)
            last_return_code = process.wait(timeout=5)
            last_stderr = process.stderr.read() if process.stderr else b""
            if last_return_code == 0:
                return
            if emitted or not can_retry_curl(last_return_code):
                break
            if attempt < CURL_MAX_ATTEMPTS - 1:
                curl_retry_pause(attempt)
        raise HTTPException(
            status_code=502,
            detail=f"OpenAI 兼容模型 curl 流式调用失败：{curl_error_message(last_stderr, b'')}",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI 兼容模型 curl 流式调用失败：{exc}") from exc
    finally:
        try:
            os.unlink(payload_path)
        except OSError:
            pass


def native_session(provider: dict[str, Any] | None = None) -> requests.Session:
    session = requests.Session()
    # Avoid local/system proxy settings breaking HTTPS handshakes for compatible gateways.
    session.trust_env = False
    if provider and requires_tls12(provider):
        session.mount("https://", TLS12HttpAdapter())
    return session


def complete_openai_compatible(
    provider: dict[str, Any],
    messages: list[dict[str, str]],
    *,
    max_tokens_override: int | None = None,
) -> str:
    if requires_tls12(provider):
        return complete_openai_compatible_curl(
            provider,
            messages,
            max_tokens_override=max_tokens_override,
        )
    try:
        response = native_session(provider).post(
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
    if requires_tls12(provider):
        yield from stream_openai_compatible_curl(provider, messages)
        return
    try:
        with native_session(provider).post(
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
                choices = chunk.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta", {}).get("content") or ""
                if delta:
                    yield str(delta)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI 兼容模型流式调用失败：{exc}") from exc
