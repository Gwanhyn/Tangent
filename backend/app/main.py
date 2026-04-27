from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import repository as repo
from .config import ROOT_DIR, settings
from .database import get_connection, init_db
from .llm import complete_chat, stream_chat, test_provider
from .schemas import (
    BranchCloseRequest,
    BranchCreate,
    BranchOut,
    ChatRequest,
    ChatResponse,
    ConversationCreate,
    ConversationDetail,
    ConversationSummaryRequest,
    ConversationOut,
    ParallelChatRequest,
    ProviderCreate,
    ProviderOut,
    ProviderTestResponse,
    ProviderUpdate,
)


app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def sse_event(event: str, data: dict) -> str:
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n"


def summarize_branch_for_memory(branch_id: str, provider_id: str | None) -> str:
    with get_connection() as conn:
        branch = repo.require_branch(conn, branch_id)
        transcript = repo.branch_transcript(conn, branch_id)
        fallback = repo.fallback_memory_summary(conn, branch_id)
        try:
            provider = repo.require_provider(conn, provider_id)
        except HTTPException:
            return fallback
    if not transcript:
        return fallback
    try:
        return complete_chat(
            provider,
            [
                {
                    "role": "system",
                    "content": "请将衍生窗口对话提炼成 100 字以内的主线隐藏记忆。只保留对后续回答有用的事实、结论和用户偏好。",
                },
                {
                    "role": "user",
                    "content": f"衍生窗口上下文：\n{transcript}",
                },
            ],
            max_tokens_override=220,
        ).strip()[:300]
    except HTTPException:
        return fallback


def summarize_conversation_intent(
    conversation_id: str,
    provider_id: str | None,
    seed_content: str | None = None,
    provider: dict | None = None,
) -> dict:
    with get_connection() as conn:
        repo.require_conversation(conn, conversation_id)
        if not repo.should_generate_conversation_summary(conn, conversation_id):
            return repo.require_conversation(conn, conversation_id)
        first_user = repo.first_visible_user_message(conn, conversation_id)
        source = seed_content or (first_user["content"] if first_user else "")
        fallback = repo.fallback_conversation_summary(source)
        if provider is None:
            try:
                provider = repo.require_provider(conn, provider_id)
            except HTTPException:
                provider = None

    summary = fallback
    if provider and source.strip():
        try:
            generated = complete_chat(
                provider,
                [
                    {
                        "role": "system",
                        "content": "你是 Tangent 的会话索引器。请把用户首轮意图提炼成 10 到 15 个中文字符或 3 到 6 个英文词。只输出摘要本身，不要引号、编号或解释。",
                    },
                    {
                        "role": "user",
                        "content": source,
                    },
                ],
                max_tokens_override=48,
            )
            summary = " ".join(generated.strip().split())[:40] or fallback
        except HTTPException:
            summary = fallback

    with get_connection() as conn:
        return repo.update_conversation_summary(conn, conversation_id, summary)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name}


@app.get("/api/providers", response_model=list[ProviderOut])
def list_providers() -> list[dict]:
    return repo.list_providers()


@app.post("/api/providers", response_model=ProviderOut)
def create_provider(payload: ProviderCreate) -> dict:
    return repo.create_provider(payload)


@app.put("/api/providers/{provider_id}", response_model=ProviderOut)
def update_provider(provider_id: str, payload: ProviderUpdate) -> dict:
    return repo.update_provider(provider_id, payload)


@app.delete("/api/providers/{provider_id}", status_code=204)
def delete_provider(provider_id: str) -> None:
    repo.delete_provider(provider_id)


@app.post("/api/providers/{provider_id}/test", response_model=ProviderTestResponse)
def test_provider_endpoint(provider_id: str) -> dict[str, str | bool]:
    with get_connection() as conn:
        provider = repo.require_provider(conn, provider_id)
    content = test_provider(provider)
    return {"ok": True, "message": content or "ok"}


@app.get("/api/conversations", response_model=list[ConversationOut])
def list_conversations() -> list[dict]:
    return repo.list_conversations()


@app.post("/api/conversations", response_model=ConversationOut)
def create_conversation(payload: ConversationCreate) -> dict:
    return repo.create_conversation(payload.title)


@app.get("/api/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(conversation_id: str) -> dict:
    return repo.conversation_detail(conversation_id)


@app.post("/api/conversations/{conversation_id}/summary", response_model=ConversationOut)
def summarize_conversation(conversation_id: str, payload: ConversationSummaryRequest) -> dict:
    return summarize_conversation_intent(conversation_id, payload.provider_id)


@app.delete("/api/conversations/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: str) -> None:
    repo.delete_conversation(conversation_id)


@app.post("/api/chat/main", response_model=ChatResponse)
def chat_main(payload: ChatRequest) -> dict:
    with get_connection() as conn:
        repo.require_conversation(conn, payload.conversation_id)
        if payload.replace_from_message_id:
            repo.truncate_main_from_message(
                conn,
                payload.conversation_id,
                payload.replace_from_message_id,
            )
        provider = repo.require_provider(conn, payload.provider_id)
        parent_id = repo.latest_visible_message_id(conn, payload.conversation_id)
        context = [
            {
                "role": "system",
                "content": "你是 Tangent 的主对话助手。请自然、准确地回答用户，并吸收隐藏记忆中的衍生讨论。",
            },
            *repo.model_context(conn, payload.conversation_id),
            {"role": "user", "content": payload.content},
        ]
    assistant_content = complete_chat(provider, context)
    with get_connection() as conn:
        repo.require_conversation(conn, payload.conversation_id)
        user_message = repo.add_message(
            conn,
            conversation_id=payload.conversation_id,
            role="user",
            content=payload.content,
            parent_id=parent_id,
        )
        assistant_message = repo.add_message(
            conn,
            conversation_id=payload.conversation_id,
            role="assistant",
            content=assistant_content,
            parent_id=user_message["id"],
        )
        repo.maybe_update_conversation_title(conn, payload.conversation_id, payload.content)
    summarize_conversation_intent(
        payload.conversation_id,
        payload.provider_id,
        seed_content=payload.content,
        provider=provider,
    )
    return {
        "conversation": repo.conversation_detail(payload.conversation_id),
        "assistant": assistant_message,
    }


@app.post("/api/chat/main/stream")
def chat_main_stream(payload: ChatRequest) -> StreamingResponse:
    def generate():
        full_content = ""
        assistant_message = None
        provider = None
        try:
            with get_connection() as conn:
                repo.require_conversation(conn, payload.conversation_id)
                if payload.replace_from_message_id:
                    repo.truncate_main_from_message(
                        conn,
                        payload.conversation_id,
                        payload.replace_from_message_id,
                    )
                provider = repo.require_provider(conn, payload.provider_id)
                parent_id = repo.latest_visible_message_id(conn, payload.conversation_id)
                context = [
                    {
                        "role": "system",
                        "content": "你是 Tangent 的主对话助手。请自然、准确地回答用户，并吸收隐藏记忆中的衍生讨论。",
                    },
                    *repo.model_context(conn, payload.conversation_id),
                    {"role": "user", "content": payload.content},
                ]
                user_message = repo.add_message(
                    conn,
                    conversation_id=payload.conversation_id,
                    role="user",
                    content=payload.content,
                    parent_id=parent_id,
                )
                assistant_message = repo.add_message(
                    conn,
                    conversation_id=payload.conversation_id,
                    role="assistant",
                    content="",
                    parent_id=user_message["id"],
                )
                repo.maybe_update_conversation_title(conn, payload.conversation_id, payload.content)
            yield sse_event("user", {"message": user_message})
            yield sse_event("assistant_start", {"message": assistant_message})
            for delta in stream_chat(provider, context):
                full_content += delta
                yield sse_event("delta", {"content": delta})
            with get_connection() as conn:
                if assistant_message:
                    assistant_message = repo.update_message_content(conn, assistant_message["id"], full_content)
            summarize_conversation_intent(
                payload.conversation_id,
                payload.provider_id,
                seed_content=payload.content,
                provider=provider,
            )
            yield sse_event(
                "done",
                {
                    "assistant": assistant_message,
                    "conversation": repo.conversation_detail(payload.conversation_id),
                },
            )
        except Exception as exc:
            if assistant_message and full_content:
                with get_connection() as conn:
                    repo.update_message_content(conn, assistant_message["id"], full_content)
            yield sse_event("error", {"message": str(exc)})

    return StreamingResponse(generate(), media_type="text/event-stream; charset=utf-8")


@app.post("/api/branches", response_model=BranchOut)
def create_branch(payload: BranchCreate) -> dict:
    return repo.create_branch(
        payload.conversation_id,
        payload.parent_id,
        payload.sync_memory,
        payload.selected_text,
    )


@app.get("/api/branches/{branch_id}", response_model=BranchOut)
def get_branch(branch_id: str) -> dict:
    return repo.branch_detail(branch_id)


@app.delete("/api/branches/{branch_id}", response_model=ConversationDetail)
def delete_branch(branch_id: str) -> dict:
    return repo.delete_branch(branch_id)


@app.post("/api/chat/parallel", response_model=BranchOut)
def chat_parallel(payload: ParallelChatRequest) -> dict:
    with get_connection() as conn:
        branch = repo.require_branch(conn, payload.branch_id)
        if branch["status"] != "open":
            raise HTTPException(status_code=400, detail="Branch is closed")
        if payload.replace_from_message_id:
            repo.truncate_branch_from_message(conn, payload.branch_id, payload.replace_from_message_id)
        provider = repo.require_provider(conn, payload.provider_id)
        parent_id = repo.latest_visible_message_id(conn, branch["conversation_id"])
        context = [
            *repo.branch_model_context(conn, branch),
            {"role": "user", "content": f"基于左侧讨论的内容，我有以下具体的追问：{payload.content}"},
        ]
    assistant_content = complete_chat(provider, context)
    with get_connection() as conn:
        branch = repo.require_branch(conn, payload.branch_id)
        user_message = repo.add_message(
            conn,
            conversation_id=branch["conversation_id"],
            branch_id=payload.branch_id,
            parent_id=parent_id,
            role="user",
            content=payload.content,
        )
        repo.add_message(
            conn,
            conversation_id=branch["conversation_id"],
            branch_id=payload.branch_id,
            parent_id=user_message["id"],
            role="assistant",
            content=assistant_content,
        )
    return repo.branch_detail(payload.branch_id)


@app.post("/api/chat/parallel/stream")
def chat_parallel_stream(payload: ParallelChatRequest) -> StreamingResponse:
    def generate():
        full_content = ""
        assistant_message = None
        try:
            with get_connection() as conn:
                branch = repo.require_branch(conn, payload.branch_id)
                if branch["status"] != "open":
                    raise HTTPException(status_code=400, detail="Branch is closed")
                if payload.replace_from_message_id:
                    repo.truncate_branch_from_message(conn, payload.branch_id, payload.replace_from_message_id)
                    branch = repo.require_branch(conn, payload.branch_id)
                provider = repo.require_provider(conn, payload.provider_id)
                parent_id = repo.latest_visible_message_id(conn, branch["conversation_id"])
                context = [
                    *repo.branch_model_context(conn, branch),
                    {"role": "user", "content": f"基于左侧讨论的内容，我有以下具体的追问：{payload.content}"},
                ]
                user_message = repo.add_message(
                    conn,
                    conversation_id=branch["conversation_id"],
                    branch_id=payload.branch_id,
                    parent_id=parent_id,
                    role="user",
                    content=payload.content,
                )
                assistant_message = repo.add_message(
                    conn,
                    conversation_id=branch["conversation_id"],
                    branch_id=payload.branch_id,
                    parent_id=user_message["id"],
                    role="assistant",
                    content="",
                )
            yield sse_event("user", {"message": user_message})
            yield sse_event("assistant_start", {"message": assistant_message})
            for delta in stream_chat(provider, context):
                full_content += delta
                yield sse_event("delta", {"content": delta})
            with get_connection() as conn:
                if assistant_message:
                    repo.update_message_content(conn, assistant_message["id"], full_content)
            yield sse_event("done", {"branch": repo.branch_detail(payload.branch_id)})
        except Exception as exc:
            if assistant_message and full_content:
                with get_connection() as conn:
                    repo.update_message_content(conn, assistant_message["id"], full_content)
            yield sse_event("error", {"message": str(exc)})

    return StreamingResponse(generate(), media_type="text/event-stream; charset=utf-8")


@app.post("/api/branches/{branch_id}/close", response_model=ConversationDetail)
def close_branch(branch_id: str, payload: BranchCloseRequest) -> dict:
    summary = summarize_branch_for_memory(branch_id, payload.provider_id) if payload.sync_memory else None
    return repo.close_branch(branch_id, payload.sync_memory, summary)


frontend_dist = ROOT_DIR / "frontend" / "dist"
if Path(frontend_dist).exists():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
