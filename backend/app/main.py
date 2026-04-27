from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import repository as repo
from .config import ROOT_DIR, settings
from .database import get_connection, init_db
from .llm import complete_chat, test_provider
from .schemas import (
    BranchCloseRequest,
    BranchCreate,
    BranchOut,
    ChatRequest,
    ChatResponse,
    ConversationCreate,
    ConversationDetail,
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


@app.delete("/api/conversations/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: str) -> None:
    repo.delete_conversation(conversation_id)


@app.post("/api/chat/main", response_model=ChatResponse)
def chat_main(payload: ChatRequest) -> dict:
    with get_connection() as conn:
        repo.require_conversation(conn, payload.conversation_id)
        provider = repo.require_provider(conn, payload.provider_id)
        parent_id = repo.latest_visible_message_id(conn, payload.conversation_id)
        context = [
            {
                "role": "system",
                "content": "你是 AI Parallel Chat 的主对话助手。请自然、准确地回答用户，并吸收隐藏记忆中的衍生讨论。",
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
    return {
        "conversation": repo.conversation_detail(payload.conversation_id),
        "assistant": assistant_message,
    }


@app.post("/api/branches", response_model=BranchOut)
def create_branch(payload: BranchCreate) -> dict:
    return repo.create_branch(payload.conversation_id, payload.parent_id, payload.sync_memory)


@app.get("/api/branches/{branch_id}", response_model=BranchOut)
def get_branch(branch_id: str) -> dict:
    return repo.branch_detail(branch_id)


@app.post("/api/chat/parallel", response_model=BranchOut)
def chat_parallel(payload: ParallelChatRequest) -> dict:
    with get_connection() as conn:
        branch = repo.require_branch(conn, payload.branch_id)
        if branch["status"] != "open":
            raise HTTPException(status_code=400, detail="Branch is closed")
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


@app.post("/api/branches/{branch_id}/close", response_model=ConversationDetail)
def close_branch(branch_id: str, payload: BranchCloseRequest) -> dict:
    return repo.close_branch(branch_id, payload.sync_memory)


frontend_dist = ROOT_DIR / "frontend" / "dist"
if Path(frontend_dist).exists():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
