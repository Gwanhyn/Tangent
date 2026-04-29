from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


ProviderType = Literal["dashscope", "deepseek", "openai", "gemini", "azure_openai", "custom"]


class ProviderBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    provider_type: ProviderType = "openai"
    base_url: str | None = None
    api_key: str | None = None
    model_name: str = Field(..., min_length=1, max_length=120)
    temperature: float = Field(0.7, ge=0, le=2)
    max_tokens: int = Field(1200, ge=1, le=128000)
    is_default: bool = False


class ProviderCreate(ProviderBase):
    pass


class ProviderUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=80)
    provider_type: ProviderType | None = None
    base_url: str | None = None
    api_key: str | None = None
    model_name: str | None = Field(None, min_length=1, max_length=120)
    temperature: float | None = Field(None, ge=0, le=2)
    max_tokens: int | None = Field(None, ge=1, le=128000)
    is_default: bool | None = None


class ProviderOut(ProviderBase):
    id: str
    has_api_key: bool
    created_at: str
    updated_at: str


class ConversationCreate(BaseModel):
    title: str = Field("新的平行对话", min_length=1, max_length=120)


class ConversationUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)


class ConversationOut(BaseModel):
    id: str
    title: str
    summary: str | None = None
    searchable_memory: str | None = None
    created_at: str
    updated_at: str


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    branch_id: str | None
    parent_id: str | None
    role: Literal["system", "user", "assistant"]
    content: str
    is_hidden: bool
    created_at: str


class ConversationDetail(BaseModel):
    conversation: ConversationOut
    messages: list[MessageOut]
    branches: list["BranchMarker"] = []
    hidden_memory_count: int
    open_branch_id: str | None = None


class ChatRequest(BaseModel):
    conversation_id: str
    content: str = Field(..., min_length=1)
    provider_id: str | None = None
    replace_from_message_id: str | None = None


class ChatResponse(BaseModel):
    conversation: ConversationDetail
    assistant: MessageOut


class BranchCreate(BaseModel):
    conversation_id: str
    parent_id: str | None = None
    sync_memory: bool = False
    selected_text: str | None = None


class BranchOut(BaseModel):
    id: str
    conversation_id: str
    parent_id: str | None
    parent_thread_id: str | None = None
    selected_text: str | None = None
    memory_summary: str | None = None
    sync_memory: bool
    status: Literal["open", "merged", "discarded"]
    created_at: str
    updated_at: str
    messages: list[MessageOut] = []


class BranchMarker(BaseModel):
    id: str
    conversation_id: str
    parent_id: str | None
    parent_thread_id: str | None = None
    selected_text: str | None = None
    memory_summary: str | None = None
    sync_memory: bool
    status: Literal["open", "merged", "discarded"]
    message_count: int
    created_at: str
    updated_at: str


class ParallelChatRequest(BaseModel):
    branch_id: str
    content: str = Field(..., min_length=1)
    provider_id: str | None = None
    replace_from_message_id: str | None = None


class BranchCloseRequest(BaseModel):
    sync_memory: bool
    provider_id: str | None = None


class ConversationSummaryRequest(BaseModel):
    provider_id: str | None = None


ConversationDetail.model_rebuild()


class ProviderTestResponse(BaseModel):
    ok: bool
    message: str
