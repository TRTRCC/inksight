from __future__ import annotations

from unittest.mock import patch

import pytest
from httpx import AsyncClient

from api.index import app
from core.cache import init_cache_db
from core.config_store import init_db
from core.db import get_main_db
from core.stats_store import init_stats_db


@pytest.fixture
async def client(tmp_path):
    from core import db as db_mod

    await db_mod.close_all()
    test_main_db = str(tmp_path / "test_Fries.db")
    test_cache_db = str(tmp_path / "test_cache.db")

    with patch.object(db_mod, "_MAIN_DB_PATH", test_main_db), \
         patch.object(db_mod, "_CACHE_DB_PATH", test_cache_db), \
         patch("core.config_store.DB_PATH", test_main_db), \
         patch("core.stats_store.DB_PATH", test_main_db), \
         patch("core.cache._CACHE_DB_PATH", test_cache_db):
        await init_db()
        await init_stats_db()
        await init_cache_db()

        try:
            from httpx import ASGITransport

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as c:
                yield c
        except Exception:
            async with AsyncClient(app=app, base_url="http://test") as c:
                yield c

        await db_mod.close_all()


async def _get_latest_email_code(email: str, purpose: str) -> str:
    db = await get_main_db()
    cursor = await db.execute(
        "SELECT code FROM email_verification_codes WHERE email = ? AND purpose = ? ORDER BY id DESC LIMIT 1",
        (email, purpose),
    )
    row = await cursor.fetchone()
    assert row is not None
    return row[0]


async def _register_with_code(client: AsyncClient, username: str, email: str, password: str) -> dict:
    send = await client.post("/api/auth/email-code", json={"email": email, "purpose": "register"})
    assert send.status_code == 200
    code = await _get_latest_email_code(email, "register")
    resp = await client.post(
        "/api/auth/register",
        json={"username": username, "password": password, "email": email, "verification_code": code},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_email_verification_registration_and_reset_flow(client: AsyncClient):
    email = "flow@example.com"
    password = "pass1234"

    registered = await _register_with_code(client, "flow-user", email, password)
    assert registered["ok"] is True
    assert registered["email_verified"] is True

    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {registered['token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == email
    assert me.json()["email_verified"] is True

    send_reset = await client.post("/api/auth/email-code", json={"email": email, "purpose": "reset_password"})
    assert send_reset.status_code == 200
    reset_code = await _get_latest_email_code(email, "reset_password")

    reset = await client.post(
        "/api/auth/forgot-password/reset",
        json={"email": email, "verification_code": reset_code, "password": "newpass5678"},
    )
    assert reset.status_code == 200
    assert reset.json()["ok"] is True

    old_login = await client.post("/api/auth/login", json={"username": "flow-user", "password": password})
    assert old_login.status_code == 401

    new_login = await client.post("/api/auth/login", json={"username": "flow-user", "password": "newpass5678"})
    assert new_login.status_code == 200


@pytest.mark.asyncio
async def test_user_profile_and_password_update(client: AsyncClient):
    registered = await _register_with_code(client, "profile-user", "profile@example.com", "pass1234")
    headers = {"Authorization": f"Bearer {registered['token']}"}

    update_profile = await client.put(
        "/api/user/profile",
        headers=headers,
        json={"username": "profile-user-renamed", "email": "profile2@example.com"},
    )
    assert update_profile.status_code == 200, update_profile.text
    assert update_profile.json()["user"]["username"] == "profile-user-renamed"
    assert update_profile.json()["user"]["email"] == "profile2@example.com"

    update_password = await client.put(
        "/api/user/profile/password",
        headers=headers,
        json={"current_password": "pass1234", "new_password": "pass9876"},
    )
    assert update_password.status_code == 200
    assert update_password.json()["ok"] is True

    old_login = await client.post(
        "/api/auth/login",
        json={"username": "profile-user-renamed", "password": "pass1234"},
    )
    assert old_login.status_code == 401

    new_login = await client.post(
        "/api/auth/login",
        json={"username": "profile-user-renamed", "password": "pass9876"},
    )
    assert new_login.status_code == 200


@pytest.mark.asyncio
async def test_admin_smtp_config_is_encrypted(client: AsyncClient, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "admin-secret")
    headers = {"Authorization": "Bearer admin-secret"}

    put = await client.put(
        "/api/admin/smtp",
        headers=headers,
        json={
            "host": "smtp.example.com",
            "port": 587,
            "username": "mailer",
            "password": "super-secret-password",
            "sender_email": "noreply@example.com",
            "sender_name": "Fries",
            "use_tls": True,
            "use_ssl": False,
        },
    )
    assert put.status_code == 200, put.text
    assert put.json()["ok"] is True

    got = await client.get("/api/admin/smtp", headers=headers)
    assert got.status_code == 200
    data = got.json()["smtp"]
    assert data["host"] == "smtp.example.com"
    assert data["password_masked"].startswith("su")
    assert data["password_set"] is True

    db = await get_main_db()
    cursor = await db.execute("SELECT password_encrypted FROM smtp_settings LIMIT 1")
    row = await cursor.fetchone()
    assert row is not None
    assert row[0]
    assert "super-secret-password" not in row[0]


@pytest.mark.asyncio
async def test_admin_user_management_supports_listing_update_and_disable(client: AsyncClient, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "admin-secret")
    admin_headers = {"Authorization": "Bearer admin-secret"}

    registered = await _register_with_code(client, "managed-user", "managed@example.com", "pass1234")
    user_id = registered["user_id"]

    list_resp = await client.get("/api/admin/users", headers=admin_headers)
    assert list_resp.status_code == 200, list_resp.text
    users = list_resp.json()["users"]
    assert any(user["id"] == user_id for user in users)

    detail_resp = await client.get(f"/api/admin/users/{user_id}", headers=admin_headers)
    assert detail_resp.status_code == 200
    assert detail_resp.json()["user"]["email"] == "managed@example.com"

    update_resp = await client.put(
        f"/api/admin/users/{user_id}",
        headers=admin_headers,
        json={"role": "admin", "free_quota_remaining": 77, "status": "disabled"},
    )
    assert update_resp.status_code == 200, update_resp.text
    updated_user = update_resp.json()["user"]
    assert updated_user["role"] == "admin"
    assert updated_user["status"] == "disabled"
    assert update_resp.json()["quota"]["free_quota_remaining"] == 77

    login = await client.post("/api/auth/login", json={"username": "managed-user", "password": "pass1234"})
    assert login.status_code == 403

    enable_resp = await client.patch(
        f"/api/admin/users/{user_id}/status",
        headers=admin_headers,
        json={"status": "active"},
    )
    assert enable_resp.status_code == 200
    assert enable_resp.json()["user"]["status"] == "active"

    login_after = await client.post("/api/auth/login", json={"username": "managed-user", "password": "pass1234"})
    assert login_after.status_code == 200


@pytest.mark.asyncio
async def test_admin_ai_provider_and_model_crud(client: AsyncClient, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "admin-secret")
    headers = {"Authorization": "Bearer admin-secret"}

    provider_create = await client.post(
        "/api/admin/ai/providers",
        headers=headers,
        json={
            "name": "OpenAI Compat",
            "key": "openai_compat",
            "base_url": "https://example.com/v1",
            "api_key": "provider-secret-key",
            "category": "llm",
            "enabled": True,
            "is_default": True,
        },
    )
    assert provider_create.status_code == 200, provider_create.text
    provider = provider_create.json()["provider"]
    provider_id = provider["id"]
    assert provider["api_key"] == ""
    assert provider["api_key_masked"].startswith("prov")

    model_create = await client.post(
        "/api/admin/ai/models",
        headers=headers,
        json={
            "provider_id": provider_id,
            "key": "gpt-4.1-mini",
            "name": "GPT 4.1 Mini",
            "category": "chat",
            "enabled": True,
            "is_default": True,
        },
    )
    assert model_create.status_code == 200, model_create.text
    model_id = model_create.json()["model"]["id"]

    list_resp = await client.get("/api/admin/ai/providers", headers=headers)
    assert list_resp.status_code == 200
    assert any(item["id"] == provider_id for item in list_resp.json()["providers"])

    models_resp = await client.get(f"/api/admin/ai/models?provider_id={provider_id}", headers=headers)
    assert models_resp.status_code == 200
    assert models_resp.json()["models"][0]["category"] == "chat"

    update_model = await client.put(
        f"/api/admin/ai/models/{model_id}",
        headers=headers,
        json={"name": "GPT 4.1 Mini Updated", "category": "reasoning"},
    )
    assert update_model.status_code == 200
    assert update_model.json()["model"]["category"] == "reasoning"

    delete_model = await client.delete(f"/api/admin/ai/models/{model_id}", headers=headers)
    assert delete_model.status_code == 200
    assert delete_model.json()["ok"] is True

    delete_provider = await client.delete(f"/api/admin/ai/providers/{provider_id}", headers=headers)
    assert delete_provider.status_code == 200
    assert delete_provider.json()["ok"] is True
