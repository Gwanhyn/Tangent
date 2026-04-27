from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from .database import get_connection
from .schemas import ProviderCreate, ProviderUpdate


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="microseconds")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def row_to_dict(row: Any) -> dict[str, Any]:
    data = dict(row)
    for key in ("is_default", "is_hidden", "sync_memory"):
        if key in data:
            data[key] = bool(data[key])
    if "api_key" in data:
        data["has_api_key"] = bool(data["api_key"])
    return data


def public_provider(row: Any) -> dict[str, Any]:
    data = row_to_dict(row)
    data.pop("api_key", None)
    return data


def require_conversation(conn, conversation_id: str) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return row_to_dict(row)


def require_provider(conn, provider_id: str | None = None) -> dict[str, Any]:
    if provider_id:
        row = conn.execute("SELECT * FROM providers WHERE id = ?", (provider_id,)).fetchone()
    else:
        row = conn.execute(
            "SELECT * FROM providers ORDER BY is_default DESC, updated_at DESC LIMIT 1"
        ).fetchone()
    if not row:
        raise HTTPException(status_code=400, detail="请先在设置中添加并选择一个模型 Provider")
    return row_to_dict(row)


def list_providers() -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM providers ORDER BY is_default DESC, updated_at DESC").fetchall()
    return [public_provider(row) for row in rows]


def create_provider(payload: ProviderCreate) -> dict[str, Any]:
    now = utc_now()
    provider_id = new_id("provider")
    with get_connection() as conn:
        count = conn.execute("SELECT COUNT(*) FROM providers").fetchone()[0]
        is_default = payload.is_default or count == 0
        if is_default:
            conn.execute("UPDATE providers SET is_default = 0")
        conn.execute(
            """
            INSERT INTO providers (
                id, name, provider_type, base_url, api_key, model_name,
                temperature, max_tokens, is_default, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                provider_id,
                payload.name,
                payload.provider_type,
                payload.base_url,
                payload.api_key,
                payload.model_name,
                payload.temperature,
                payload.max_tokens,
                int(is_default),
                now,
                now,
            ),
        )
        row = conn.execute("SELECT * FROM providers WHERE id = ?", (provider_id,)).fetchone()
    return public_provider(row)


def update_provider(provider_id: str, payload: ProviderUpdate) -> dict[str, Any]:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        with get_connection() as conn:
            row = conn.execute("SELECT * FROM providers WHERE id = ?", (provider_id,)).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Provider not found")
            return public_provider(row)

    allowed = {
        "name",
        "provider_type",
        "base_url",
        "api_key",
        "model_name",
        "temperature",
        "max_tokens",
        "is_default",
    }
    now = utc_now()
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM providers WHERE id = ?", (provider_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Provider not found")
        if updates.get("is_default") is True:
            conn.execute("UPDATE providers SET is_default = 0")
        fields = [key for key in updates if key in allowed]
        values = [int(updates[key]) if key == "is_default" else updates[key] for key in fields]
        values.extend([now, provider_id])
        set_clause = ", ".join([f"{field} = ?" for field in fields] + ["updated_at = ?"])
        conn.execute(f"UPDATE providers SET {set_clause} WHERE id = ?", values)
        row = conn.execute("SELECT * FROM providers WHERE id = ?", (provider_id,)).fetchone()
    return public_provider(row)


def delete_provider(provider_id: str) -> None:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM providers WHERE id = ?", (provider_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Provider not found")
        was_default = bool(row["is_default"])
        conn.execute("DELETE FROM providers WHERE id = ?", (provider_id,))
        if was_default:
            next_row = conn.execute("SELECT id FROM providers ORDER BY updated_at DESC LIMIT 1").fetchone()
            if next_row:
                conn.execute("UPDATE providers SET is_default = 1 WHERE id = ?", (next_row["id"],))


def list_conversations() -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM conversations ORDER BY updated_at DESC").fetchall()
    return [row_to_dict(row) for row in rows]


def create_conversation(title: str) -> dict[str, Any]:
    now = utc_now()
    conversation_id = new_id("conv")
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (conversation_id, title, now, now),
        )
        row = conn.execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
    return row_to_dict(row)


def delete_conversation(conversation_id: str) -> None:
    with get_connection() as conn:
        require_conversation(conn, conversation_id)
        conn.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))


def list_visible_messages(conn, conversation_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT * FROM messages
        WHERE conversation_id = ?
          AND branch_id IS NULL
          AND is_hidden = 0
        ORDER BY created_at, rowid
        """,
        (conversation_id,),
    ).fetchall()
    return [row_to_dict(row) for row in rows]


def count_hidden_memory(conn, conversation_id: str) -> int:
    return conn.execute(
        "SELECT COUNT(*) FROM messages WHERE conversation_id = ? AND is_hidden = 1",
        (conversation_id,),
    ).fetchone()[0]


def get_open_branch_id(conn, conversation_id: str) -> str | None:
    row = conn.execute(
        """
        SELECT id FROM branches
        WHERE conversation_id = ? AND status = 'open'
        ORDER BY created_at DESC LIMIT 1
        """,
        (conversation_id,),
    ).fetchone()
    return row["id"] if row else None


def conversation_detail(conversation_id: str) -> dict[str, Any]:
    with get_connection() as conn:
        conversation = require_conversation(conn, conversation_id)
        return {
            "conversation": conversation,
            "messages": list_visible_messages(conn, conversation_id),
            "hidden_memory_count": count_hidden_memory(conn, conversation_id),
            "open_branch_id": get_open_branch_id(conn, conversation_id),
        }


def add_message(
    conn,
    *,
    conversation_id: str,
    role: str,
    content: str,
    branch_id: str | None = None,
    parent_id: str | None = None,
    is_hidden: bool = False,
) -> dict[str, Any]:
    now = utc_now()
    message_id = new_id("msg")
    conn.execute(
        """
        INSERT INTO messages (
            id, conversation_id, branch_id, parent_id, role, content, is_hidden, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (message_id, conversation_id, branch_id, parent_id, role, content, int(is_hidden), now),
    )
    conn.execute(
        "UPDATE conversations SET updated_at = ? WHERE id = ?",
        (now, conversation_id),
    )
    if branch_id:
        conn.execute("UPDATE branches SET updated_at = ? WHERE id = ?", (now, branch_id))
    row = conn.execute("SELECT * FROM messages WHERE id = ?", (message_id,)).fetchone()
    return row_to_dict(row)


def maybe_update_conversation_title(conn, conversation_id: str, user_content: str) -> None:
    row = conn.execute("SELECT title FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
    if not row:
        return
    if row["title"] in {"新的平行对话", "New Parallel Chat"}:
        title = user_content.strip().replace("\n", " ")
        if len(title) > 36:
            title = title[:36] + "..."
        conn.execute(
            "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
            (title or "新的平行对话", utc_now(), conversation_id),
        )


def model_context(conn, conversation_id: str) -> list[dict[str, str]]:
    rows = conn.execute(
        """
        SELECT role, content FROM messages
        WHERE conversation_id = ?
          AND (branch_id IS NULL OR is_hidden = 1)
        ORDER BY created_at, rowid
        """,
        (conversation_id,),
    ).fetchall()
    return [{"role": row["role"], "content": row["content"]} for row in rows]


def latest_visible_message_id(conn, conversation_id: str) -> str | None:
    row = conn.execute(
        """
        SELECT id FROM messages
        WHERE conversation_id = ? AND branch_id IS NULL AND is_hidden = 0
        ORDER BY created_at DESC, rowid DESC LIMIT 1
        """,
        (conversation_id,),
    ).fetchone()
    return row["id"] if row else None


def create_branch(conversation_id: str, parent_id: str | None, sync_memory: bool) -> dict[str, Any]:
    now = utc_now()
    branch_id = new_id("branch")
    with get_connection() as conn:
        require_conversation(conn, conversation_id)
        if parent_id:
            parent = conn.execute(
                "SELECT id FROM messages WHERE id = ? AND conversation_id = ?",
                (parent_id, conversation_id),
            ).fetchone()
            if not parent:
                raise HTTPException(status_code=404, detail="Parent message not found")
        base_context_json = json.dumps(model_context(conn, conversation_id), ensure_ascii=False)
        conn.execute(
            """
            INSERT INTO branches (
                id, conversation_id, parent_id, base_context_json,
                sync_memory, status, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, 'open', ?, ?)
            """,
            (branch_id, conversation_id, parent_id, base_context_json, int(sync_memory), now, now),
        )
        row = conn.execute("SELECT * FROM branches WHERE id = ?", (branch_id,)).fetchone()
    branch = row_to_dict(row)
    branch["messages"] = []
    return branch


def require_branch(conn, branch_id: str) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM branches WHERE id = ?", (branch_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Branch not found")
    return row_to_dict(row)


def list_branch_messages(conn, branch_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM messages WHERE branch_id = ? ORDER BY created_at, rowid",
        (branch_id,),
    ).fetchall()
    return [row_to_dict(row) for row in rows]


def branch_detail(branch_id: str) -> dict[str, Any]:
    with get_connection() as conn:
        branch = require_branch(conn, branch_id)
        branch["messages"] = list_branch_messages(conn, branch_id)
        return branch


def branch_model_context(conn, branch: dict[str, Any]) -> list[dict[str, str]]:
    base_context = json.loads(branch["base_context_json"])
    branch_rows = conn.execute(
        "SELECT role, content FROM messages WHERE branch_id = ? ORDER BY created_at, rowid",
        (branch["id"],),
    ).fetchall()
    branch_context = [{"role": row["role"], "content": row["content"]} for row in branch_rows]
    return [
        {
            "role": "system",
            "content": "你正在衍生窗口中回答。请基于主对话快照做深入追问，不要假设这些分支内容已经显示在主窗口。",
        },
        *base_context,
        {
            "role": "system",
            "content": "以下是衍生窗口中的独立问答过程。用户的问题通常是在追问左侧主对话的细节。",
        },
        *branch_context,
    ]


def close_branch(branch_id: str, sync_memory: bool) -> dict[str, Any]:
    now = utc_now()
    with get_connection() as conn:
        branch = require_branch(conn, branch_id)
        if branch["status"] != "open":
            raise HTTPException(status_code=400, detail="Branch is already closed")
        if sync_memory:
            conn.execute(
                "UPDATE messages SET is_hidden = 1 WHERE branch_id = ?",
                (branch_id,),
            )
            status = "merged"
        else:
            conn.execute("DELETE FROM messages WHERE branch_id = ?", (branch_id,))
            status = "discarded"
        conn.execute(
            """
            UPDATE branches
            SET sync_memory = ?, status = ?, updated_at = ?
            WHERE id = ?
            """,
            (int(sync_memory), status, now, branch_id),
        )
        conn.execute(
            "UPDATE conversations SET updated_at = ? WHERE id = ?",
            (now, branch["conversation_id"]),
        )
    return conversation_detail(branch["conversation_id"])

