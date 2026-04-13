"""用户分组管理路由。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from core.auth import get_current_root_user
from core.db import get_main_db

router = APIRouter(tags=["admin-groups"])


# ── 建表（幂等）────────────────────────────────────────────

async def ensure_groups_table():
    db = await get_main_db()
    await db.executescript("""
        CREATE TABLE IF NOT EXISTS user_groups (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL UNIQUE,
            description TEXT    DEFAULT '',
            llm_provider TEXT   DEFAULT 'deepseek',
            llm_model    TEXT   DEFAULT '',
            monthly_quota INTEGER DEFAULT 0,
            -- 0 = 无限制
            created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );
    """)
    # 给 users 表加 group_id 列（如果不存在）
    cursor = await db.execute("PRAGMA table_info(users)")
    cols = [row[1] for row in await cursor.fetchall()]
    if "group_id" not in cols:
        await db.execute("ALTER TABLE users ADD COLUMN group_id INTEGER REFERENCES user_groups(id)")
    await db.commit()


# ── CRUD ────────────────────────────────────────────────────

@router.get("/admin/groups")
async def list_groups(
    _: int = Depends(get_current_root_user),
    keyword: str = Query(default=""),
):
    await ensure_groups_table()
    db = await get_main_db()
    where = ""
    params: list = []
    if keyword.strip():
        where = "WHERE name LIKE ?"
        params.append(f"%{keyword.strip()}%")
    cursor = await db.execute(
        f"SELECT g.*, COUNT(u.id) as member_count FROM user_groups g LEFT JOIN users u ON u.group_id = g.id {where} GROUP BY g.id ORDER BY g.id DESC",
        params,
    )
    rows = await cursor.fetchall()
    return {
        "items": [
            {
                "id": r[0],
                "name": r[1],
                "description": r[2],
                "llm_provider": r[3],
                "llm_model": r[4],
                "monthly_quota": r[5],
                "created_at": r[6],
                "updated_at": r[7],
                "member_count": r[8],
            }
            for r in rows
        ]
    }


@router.post("/admin/groups")
async def create_group(body: dict, _: int = Depends(get_current_root_user)):
    await ensure_groups_table()
    name = (body.get("name") or "").strip()
    if not name:
        return {"error": "分组名称不能为空"}, 400
    db = await get_main_db()
    try:
        cursor = await db.execute(
            """INSERT INTO user_groups (name, description, llm_provider, llm_model, monthly_quota)
               VALUES (?, ?, ?, ?, ?)""",
            (
                name,
                (body.get("description") or "").strip(),
                (body.get("llm_provider") or "").strip() or "deepseek",
                (body.get("llm_model") or "").strip(),
                int(body.get("monthly_quota") or 0),
            ),
        )
        await db.commit()
        return {"ok": True, "id": cursor.lastrowid}
    except Exception as e:
        if "UNIQUE" in str(e):
            return {"error": "分组名称已存在"}, 409
        raise


@router.put("/admin/groups/{group_id}")
async def update_group(group_id: int, body: dict, _: int = Depends(get_current_root_user)):
    await ensure_groups_table()
    db = await get_main_db()
    cursor = await db.execute("SELECT id FROM user_groups WHERE id = ?", (group_id,))
    if not await cursor.fetchone():
        return {"error": "分组不存在"}, 404
    await db.execute(
        """UPDATE user_groups SET name=?, description=?, llm_provider=?, llm_model=?, monthly_quota=?,
           updated_at=datetime('now') WHERE id=?""",
        (
            (body.get("name") or "").strip(),
            (body.get("description") or "").strip(),
            (body.get("llm_provider") or "").strip() or "deepseek",
            (body.get("llm_model") or "").strip(),
            int(body.get("monthly_quota") or 0),
            group_id,
        ),
    )
    await db.commit()
    return {"ok": True}


@router.delete("/admin/groups/{group_id}")
async def delete_group(group_id: int, _: int = Depends(get_current_root_user)):
    await ensure_groups_table()
    db = await get_main_db()
    # 先把该分组的用户置空
    await db.execute("UPDATE users SET group_id = NULL WHERE group_id = ?", (group_id,))
    await db.execute("DELETE FROM user_groups WHERE id = ?", (group_id,))
    await db.commit()
    return {"ok": True}


@router.post("/admin/groups/{group_id}/reset-quota")
async def reset_group_quota(group_id: int, body: dict, _: int = Depends(get_current_root_user)):
    """重置分组下所有用户的配额。body: {"monthly_quota": N} 可选覆盖分组默认值。"""
    await ensure_groups_table()
    db = await get_main_db()
    cursor = await db.execute("SELECT id, monthly_quota FROM user_groups WHERE id = ?", (group_id,))
    row = await cursor.fetchone()
    if not row:
        return {"error": "分组不存在"}, 404
    quota = int(body.get("monthly_quota") or row[1] or 0)
    # 更新该分组所有用户的 api_quotas
    await db.execute(
        """UPDATE api_quotas SET free_quota_remaining = ?
           WHERE user_id IN (SELECT id FROM users WHERE group_id = ?)
              AND free_quota_remaining < ?""",
        (quota, group_id, quota),
    )
    # 确保分组下所有用户都有配额记录
    await db.execute(
        """INSERT OR IGNORE INTO api_quotas (user_id, total_calls_made, free_quota_remaining)
           SELECT id, 0, ? FROM users WHERE group_id = ?""",
        (quota, group_id),
    )
    await db.commit()
    return {"ok": True, "reset_quota": quota}
