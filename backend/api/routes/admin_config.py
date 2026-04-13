from __future__ import annotations

import os
import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.auth import require_admin
from core.db import get_main_db
from core.config_store import (
    get_llm_providers,
    get_llm_provider_by_key,
    create_llm_provider,
    update_llm_provider,
    delete_llm_provider,
    get_default_llm_provider,
)

router = APIRouter(tags=["admin-config"])


class SystemConfig(BaseModel):
    default_city: str = "杭州"
    default_language: str = "zh"
    default_refresh_interval: int = 60
    default_modes: str = "STOIC"
    default_llm_provider: str = "aliyun"
    default_llm_model: str = "deepseek-v3.2"
    default_image_provider: str = "aliyun"
    default_image_model: str = "qwen-image-max"


class PlatformKey(BaseModel):
    llm_api_key: str = ""
    image_api_key: str = ""


class LLMProviderCreate(BaseModel):
    name: str
    key: str
    base_url: str
    api_key: str = ""
    models: list[str] = []
    is_default: bool = False
    enabled: bool = True


class LLMProviderUpdate(BaseModel):
    name: str | None = None
    key: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    models: list[str] | None = None
    is_default: bool | None = None
    enabled: bool | None = None


# ── LLM Providers Management ──────────────────────────────────────


@router.get("/admin/llm-providers")
async def list_llm_providers(_: None = Depends(require_admin)):
    """获取所有 LLM 服务商配置"""
    providers = await get_llm_providers()
    # 脱敏 API Key
    for p in providers:
        if p.get("api_key"):
            key = p["api_key"]
            if len(key) >= 12:
                p["api_key_masked"] = f"{key[:8]}...{key[-4:]}"
            else:
                p["api_key_masked"] = "***"
            p["api_key"] = ""  # 不返回完整密钥
        else:
            p["api_key_masked"] = "未设置"
    return {"providers": providers}


@router.post("/admin/llm-providers")
async def add_llm_provider(body: LLMProviderCreate, _: None = Depends(require_admin)):
    """创建新的 LLM 服务商"""
    provider = await create_llm_provider(
        name=body.name,
        key=body.key,
        base_url=body.base_url,
        api_key=body.api_key,
        models=body.models,
        is_default=body.is_default,
        enabled=body.enabled,
    )
    if not provider:
        return {"ok": False, "error": "服务商 key 已存在"}
    # 脱敏返回
    if provider.get("api_key"):
        key = provider["api_key"]
        provider["api_key_masked"] = f"{key[:8]}...{key[-4:]}" if len(key) >= 12 else "***"
        provider["api_key"] = ""
    return {"ok": True, "provider": provider}


@router.put("/admin/llm-providers/{provider_id}")
async def modify_llm_provider(provider_id: int, body: LLMProviderUpdate, _: None = Depends(require_admin)):
    """更新 LLM 服务商配置"""
    provider = await update_llm_provider(
        provider_id=provider_id,
        name=body.name,
        key=body.key,
        base_url=body.base_url,
        api_key=body.api_key,
        models=body.models,
        is_default=body.is_default,
        enabled=body.enabled,
    )
    if not provider:
        return {"ok": False, "error": "服务商不存在或 key 冲突"}
    # 脱敏返回
    if provider.get("api_key"):
        key = provider["api_key"]
        provider["api_key_masked"] = f"{key[:8]}...{key[-4:]}" if len(key) >= 12 else "***"
        provider["api_key"] = ""
    return {"ok": True, "provider": provider}


@router.delete("/admin/llm-providers/{provider_id}")
async def remove_llm_provider(provider_id: int, _: None = Depends(require_admin)):
    """删除 LLM 服务商"""
    deleted = await delete_llm_provider(provider_id)
    if not deleted:
        return {"ok": False, "error": "服务商不存在"}
    return {"ok": True}


@router.get("/admin/llm-providers/default")
async def get_default_provider(_: None = Depends(require_admin)):
    """获取默认 LLM 服务商"""
    provider = await get_default_llm_provider()
    if not provider:
        return {"ok": False, "error": "没有启用的服务商"}
    # 脱敏返回
    if provider.get("api_key"):
        key = provider["api_key"]
        provider["api_key_masked"] = f"{key[:8]}...{key[-4:]}" if len(key) >= 12 else "***"
        provider["api_key"] = ""
    return {"ok": True, "provider": provider}


# 系统默认配置（存储在数据库中）
@router.get("/admin/config/system")
async def get_system_config(_: None = Depends(require_admin)):
    db = await get_main_db()
    cursor = await db.execute(
        "SELECT key, value FROM system_config WHERE key IN "
        "('default_city', 'default_language', 'default_refresh_interval', 'default_modes', "
        "'default_llm_provider', 'default_llm_model', 'default_image_provider', 'default_image_model')"
    )
    rows = await cursor.fetchall()
    config = {row[0]: row[1] for row in rows}
    
    # 获取服务商列表用于前端下拉选择
    providers = await get_llm_providers()
    provider_options = [{"key": p["key"], "name": p["name"], "models": p["models"]} for p in providers if p["enabled"]]
    
    return {
        "default_city": config.get("default_city", "杭州"),
        "default_language": config.get("default_language", "zh"),
        "default_refresh_interval": int(config.get("default_refresh_interval", "60")),
        "default_modes": config.get("default_modes", "STOIC"),
        "default_llm_provider": config.get("default_llm_provider", "aliyun"),
        "default_llm_model": config.get("default_llm_model", "deepseek-v3.2"),
        "default_image_provider": config.get("default_image_provider", "aliyun"),
        "default_image_model": config.get("default_image_model", "qwen-image-max"),
        "llm_provider_options": provider_options,
    }


@router.post("/admin/config/system")
async def set_system_config(body: SystemConfig, _: None = Depends(require_admin)):
    db = await get_main_db()
    for key, value in body.model_dump().items():
        await db.execute(
            "INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)",
            (key, str(value)),
        )
    await db.commit()
    return {"ok": True}


# 平台级 API Key（从环境变量读取，支持设置到数据库覆盖）
@router.get("/admin/config/platform-keys")
async def get_platform_keys(_: None = Depends(require_admin)):
    db = await get_main_db()
    cursor = await db.execute(
        "SELECT key, value FROM system_config WHERE key IN ('platform_llm_api_key', 'platform_image_api_key')"
    )
    rows = await cursor.fetchall()
    db_config = {row[0]: row[1] for row in rows}
    
    # 优先级：数据库 > 环境变量
    llm_key = db_config.get("platform_llm_api_key") or os.environ.get("DASHSCOPE_API_KEY", "")
    image_key = db_config.get("platform_image_api_key") or os.environ.get("DASHSCOPE_API_KEY", "")
    
    # 脱敏显示（只显示前8位和后4位）
    def mask_key(k: str) -> str:
        if not k or len(k) < 12:
            return "未设置"
        return f"{k[:8]}...{k[-4:]}"
    
    return {
        "llm_api_key_masked": mask_key(llm_key),
        "image_api_key_masked": mask_key(image_key),
        "llm_api_key_set": bool(llm_key),
        "image_api_key_set": bool(image_key),
        "source": "database" if db_config else "environment",
    }


@router.post("/admin/config/platform-keys")
async def set_platform_keys(body: PlatformKey, _: None = Depends(require_admin)):
    db = await get_main_db()
    if body.llm_api_key:
        await db.execute(
            "INSERT OR REPLACE INTO system_config (key, value) VALUES ('platform_llm_api_key', ?)",
            (body.llm_api_key,),
        )
    else:
        await db.execute("DELETE FROM system_config WHERE key = 'platform_llm_api_key'")
    if body.image_api_key:
        await db.execute(
            "INSERT OR REPLACE INTO system_config (key, value) VALUES ('platform_image_api_key', ?)",
            (body.image_api_key,),
        )
    else:
        await db.execute("DELETE FROM system_config WHERE key = 'platform_image_api_key'")
    await db.commit()
    return {"ok": True}


# 用户 API Key 查看（脱敏）
@router.get("/admin/users/{user_id}/api-keys")
async def get_user_api_keys(user_id: int, _: None = Depends(require_admin)):
    db = await get_main_db()
    cursor = await db.execute(
        "SELECT llm_api_key, image_api_key FROM user_api_keys WHERE user_id = ?",
        (user_id,),
    )
    row = await cursor.fetchone()
    
    def mask_key(k: str) -> str:
        if not k or len(k) < 12:
            return "未设置"
        return f"{k[:8]}...{k[-4:]}"
    
    if row:
        return {
            "llm_api_key_masked": mask_key(row[0] or ""),
            "image_api_key_masked": mask_key(row[1] or ""),
            "llm_api_key_set": bool(row[0]),
            "image_api_key_set": bool(row[1]),
        }
    return {
        "llm_api_key_masked": "未设置",
        "image_api_key_masked": "未设置",
        "llm_api_key_set": False,
        "image_api_key_set": False,
    }


# 用户额度管理（使用 api_quotas 表）
@router.get("/admin/users/{user_id}/quota")
async def get_user_quota(user_id: int, _: None = Depends(require_admin)):
    db = await get_main_db()
    cursor = await db.execute(
        "SELECT free_quota_remaining, total_calls_made FROM api_quotas WHERE user_id = ?",
        (user_id,),
    )
    row = await cursor.fetchone()
    if row:
        return {"free_quota": row[0], "used_quota": row[1], "remaining": row[0]}
    return {"free_quota": 0, "used_quota": 0, "remaining": 0}


@router.post("/admin/users/{user_id}/quota")
async def set_user_quota(user_id: int, body: dict, _: None = Depends(require_admin)):
    free_quota = int(body.get("free_quota", 0))
    db = await get_main_db()
    await db.execute(
        "INSERT OR REPLACE INTO api_quotas (user_id, free_quota_remaining, total_calls_made) "
        "VALUES (?, ?, COALESCE((SELECT total_calls_made FROM api_quotas WHERE user_id = ?), 0))",
        (user_id, free_quota, user_id),
    )
    await db.commit()
    return {"ok": True, "free_quota": free_quota}