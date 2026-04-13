from __future__ import annotations

import os
import json
import re
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from core.auth import get_current_root_user
from core.db import get_main_db

router = APIRouter(tags=["admin-analytics"])


# ==================== 数据统计 ====================

@router.get("/admin/stats/daily")
async def get_daily_stats(
    days: int = Query(default=7, ge=1, le=30),
    _: int = Depends(get_current_root_user),
):
    """每日活跃统计"""
    db = await get_main_db()
    
    # 用户活跃
    user_stats = []
    for i in range(days):
        date = datetime.now() - timedelta(days=days - i - 1)
        date_str = date.strftime("%Y-%m-%d")
        
        # 新注册用户
        cursor = await db.execute(
            "SELECT COUNT(*) FROM users WHERE DATE(created_at) = ?",
            (date_str,),
        )
        new_users = (await cursor.fetchone())[0]
        
        # 活跃设备
        cursor = await db.execute(
            "SELECT COUNT(DISTINCT mac) FROM render_logs WHERE DATE(created_at) = ?",
            (date_str,),
        )
        try:
            active_devices = (await cursor.fetchone())[0]
        except:
            active_devices = 0
        
        # 渲染次数
        cursor = await db.execute(
            "SELECT COUNT(*) FROM render_logs WHERE DATE(created_at) = ?",
            (date_str,),
        )
        try:
            renders = (await cursor.fetchone())[0]
        except:
            renders = 0
        
        user_stats.append({
            "date": date_str,
            "new_users": new_users,
            "active_devices": active_devices,
            "renders": renders,
        })
    
    return {"items": user_stats}


@router.get("/admin/stats/modes")
async def get_mode_stats(_: int = Depends(get_current_root_user)):
    """模式使用统计"""
    db = await get_main_db()
    
    # 从 configs 统计模式分布
    cursor = await db.execute(
        "SELECT modes FROM configs WHERE modes IS NOT NULL AND modes != ''"
    )
    rows = await cursor.fetchall()
    
    mode_counts = {}
    for row in rows:
        modes_str = row[0] or ""
        for mode in modes_str.split(","):
            mode = mode.strip().upper()
            if mode:
                mode_counts[mode] = mode_counts.get(mode, 0) + 1
    
    items = [{"mode": k, "count": v} for k, v in sorted(mode_counts.items(), key=lambda x: -x[1])]
    return {"items": items}


@router.get("/admin/stats/providers")
async def get_provider_stats(_: int = Depends(get_current_root_user)):
    """AI服务商使用统计"""
    db = await get_main_db()
    
    cursor = await db.execute(
        "SELECT llm_provider, COUNT(*) as cnt FROM configs WHERE llm_provider IS NOT NULL GROUP BY llm_provider"
    )
    llm_rows = await cursor.fetchall()
    
    cursor = await db.execute(
        "SELECT image_provider, COUNT(*) as cnt FROM configs WHERE image_provider IS NOT NULL GROUP BY image_provider"
    )
    image_rows = await cursor.fetchall()
    
    return {
        "llm": [{"provider": r[0], "count": r[1]} for r in llm_rows],
        "image": [{"provider": r[0], "count": r[1]} for r in image_rows],
    }


# ==================== 用户行为分析 ====================

@router.get("/admin/users/{user_id}/behavior")
async def get_user_behavior(user_id: int, _: int = Depends(get_current_root_user)):
    """用户行为分析"""
    db = await get_main_db()
    
    # 基本信息
    cursor = await db.execute(
        "SELECT username, email, phone, role, status, created_at FROM users WHERE id = ?",
        (user_id,),
    )
    user = await cursor.fetchone()
    if not user:
        return {"error": "用户不存在"}
    
    # 设备数量
    cursor = await db.execute(
        "SELECT COUNT(*) FROM device_memberships WHERE user_id = ? AND status = 'active'",
        (user_id,),
    )
    device_count = (await cursor.fetchone())[0]
    
    # 渲染次数
    try:
        cursor = await db.execute(
            "SELECT COUNT(*) FROM render_logs WHERE user_id = ?",
            (user_id,),
        )
        render_count = (await cursor.fetchone())[0]
    except:
        render_count = 0
    
    # API 调用统计
    cursor = await db.execute(
        "SELECT total_calls_made, free_quota_remaining FROM api_quotas WHERE user_id = ?",
        (user_id,),
    )
    quota = await cursor.fetchone()
    
    # 最近活跃时间
    try:
        cursor = await db.execute(
            "SELECT MAX(created_at) FROM render_logs WHERE user_id = ?",
            (user_id,),
        )
        last_active = (await cursor.fetchone())[0] or "从未"
    except:
        last_active = "从未"
    
    return {
        "user": {
            "id": user_id,
            "username": user[0],
            "email": user[1],
            "phone": user[2],
            "role": user[3],
            "status": user[4],
            "created_at": user[5],
        },
        "stats": {
            "device_count": device_count,
            "render_count": render_count,
            "api_calls": quota[0] if quota else 0,
            "quota_remaining": quota[1] if quota else 0,
            "last_active": last_active,
        },
    }


# ==================== 恶意用户检测 ====================

class RiskUser(BaseModel):
    user_id: int
    username: str
    risk_score: int
    risk_factors: list[str]
    device_count: int
    api_calls: int
    created_at: str


@router.get("/admin/security/risk-users")
async def detect_risk_users(_: int = Depends(get_current_root_user)):
    """检测可疑用户"""
    db = await get_main_db()
    
    cursor = await db.execute(
        """
        SELECT 
            u.id, u.username, u.created_at, u.status,
            COUNT(DISTINCT dm.mac) as device_count,
            COALESCE(q.total_calls_made, 0) as api_calls,
            COALESCE(q.free_quota_remaining, 0) as quota_remaining
        FROM users u
        LEFT JOIN device_memberships dm ON dm.user_id = u.id AND dm.status = 'active'
        LEFT JOIN api_quotas q ON q.user_id = u.id
        GROUP BY u.id
        """
    )
    users = await cursor.fetchall()
    
    risk_users = []
    for u in users:
        user_id, username, created_at, status, device_count, api_calls, quota_remaining = u
        risk_factors = []
        risk_score = 0
        
        # 异常检测规则
        created_date = datetime.fromisoformat(created_at.replace("Z", "+00:00").replace(" ", "T")) if created_at else datetime.now()
        days_since_created = (datetime.now() - created_date.replace(tzinfo=None)).days
        
        # 规则1: 短时间内绑定大量设备
        if device_count > 10:
            risk_score += 30
            risk_factors.append(f"绑定设备过多({device_count}台)")
        elif device_count > 5 and days_since_created < 7:
            risk_score += 20
            risk_factors.append(f"新用户绑定{device_count}台设备")
        
        # 规则2: API调用异常高频
        if api_calls > 1000:
            risk_score += 25
            risk_factors.append(f"API调用过多({api_calls}次)")
        
        # 规则3: 额度耗尽但持续请求
        if quota_remaining == 0 and api_calls > 50:
            risk_score += 15
            risk_factors.append("额度耗尽后继续请求")
        
        # 规则4: 用户名可疑
        suspicious_patterns = ["test", "spam", "bot", "admin", "hack", "attack"]
        for pattern in suspicious_patterns:
            if pattern in username.lower():
                risk_score += 10
                risk_factors.append(f"用户名含可疑词'{pattern}'")
                break
        
        # 规则5: 短时间内大量操作
        try:
            cursor = await db.execute(
                "SELECT COUNT(*) FROM render_logs WHERE user_id = ? AND created_at > datetime('now', '-1 hour')",
                (user_id,),
            )
            hourly_renders = (await cursor.fetchone())[0]
            if hourly_renders > 50:
                risk_score += 20
                risk_factors.append(f"1小时内{hourly_renders}次渲染")
        except:
            pass
        
        if risk_score >= 20:
            risk_users.append({
                "user_id": user_id,
                "username": username,
                "risk_score": risk_score,
                "risk_factors": risk_factors,
                "device_count": device_count,
                "api_calls": api_calls,
                "created_at": created_at,
                "status": status,
            })
    
    # 按风险分数排序
    risk_users.sort(key=lambda x: -x["risk_score"])
    return {"items": risk_users, "total": len(risk_users)}


@router.post("/admin/security/ban-user/{user_id}")
async def ban_user(user_id: int, _: int = Depends(get_current_root_user)):
    """封禁用户"""
    db = await get_main_db()
    await db.execute("UPDATE users SET status = 'banned' WHERE id = ?", (user_id,))
    await db.commit()
    return {"ok": True, "user_id": user_id, "status": "banned"}


# ==================== 日志管理 ====================

LOG_DIR = "/tmp/Fries-logs"


@router.get("/admin/logs/backend")
async def get_backend_logs(
    lines: int = Query(default=100, ge=1, le=1000),
    level: str = Query(default="all"),
    _: int = Depends(get_current_root_user),
):
    """获取后端日志"""
    log_file = f"/tmp/openclaw/openclaw-{datetime.now().strftime('%Y-%m-%d')}.log"
    
    if not os.path.exists(log_file):
        # 尝试 Fries 专用日志
        log_file = f"{LOG_DIR}/backend-{datetime.now().strftime('%Y-%m-%d')}.log"
    
    if not os.path.exists(log_file):
        return {"items": [], "error": "日志文件不存在"}
    
    try:
        with open(log_file, "r") as f:
            all_lines = f.readlines()[-lines:]
        
        filtered = []
        for line in all_lines:
            line = line.strip()
            if not line:
                continue
            if level != "all":
                if level.upper() not in line:
                    continue
            filtered.append({
                "line": line,
                "level": "ERROR" if "ERROR" in line else ("WARN" if "WARN" in line else "INFO"),
                "time": line.split()[0] if line.split() else "",
            })
        
        return {"items": filtered, "total": len(filtered)}
    except Exception as e:
        return {"items": [], "error": str(e)}


@router.get("/admin/logs/errors")
async def get_error_logs(
    hours: int = Query(default=24, ge=1, le=168),
    _: int = Depends(get_current_root_user),
):
    """获取错误日志摘要"""
    db = await get_main_db()
    
    try:
        cursor = await db.execute(
            """
            SELECT mac, error_type, error_msg, COUNT(*) as cnt, MAX(created_at) as last_time
            FROM error_logs
            WHERE created_at > datetime('now', ?)
            GROUP BY mac, error_type
            ORDER BY cnt DESC
            LIMIT 50
            """,
            (f"-{hours} hours",),
        )
        errors = await cursor.fetchall()
        
        return {
            "items": [
                {
                    "mac": e[0],
                    "error_type": e[1],
                    "error_msg": e[2],
                    "count": e[3],
                    "last_time": e[4],
                }
                for e in errors
            ]
        }
    except:
        # 表不存在时返回空
        return {"items": [], "note": "错误日志表尚未创建"}


@router.get("/admin/logs/render-history")
async def get_render_history(
    mac: str = Query(default=""),
    user_id: int = Query(default=0),
    hours: int = Query(default=24, ge=1, le=168),
    _: int = Depends(get_current_root_user),
):
    """渲染历史记录"""
    db = await get_main_db()
    
    try:
        where = "WHERE created_at > datetime('now', ?)"
        params = [f"-{hours} hours"]
        
        if mac:
            where += " AND mac = ?"
            params.append(mac.upper())
        if user_id:
            where += " AND user_id = ?"
            params.append(user_id)
        
        cursor = await db.execute(
            f"""
            SELECT mac, mode, success, created_at, error_msg
            FROM render_logs
            {where}
            ORDER BY created_at DESC
            LIMIT 100
            """,
            params,
        )
        renders = await cursor.fetchall()
        
        return {
            "items": [
                {
                    "mac": r[0],
                    "mode": r[1],
                    "success": r[2],
                    "time": r[3],
                    "error": r[4] or "",
                }
                for r in renders
            ]
        }
    except:
        return {"items": [], "note": "渲染日志表尚未创建"}


# ==================== AI 分析报告 ====================

@router.get("/admin/ai/insights")
async def get_ai_insights(_: int = Depends(get_current_root_user)):
    """AI 数据洞察"""
    db = await get_main_db()
    
    # 统计数据
    cursor = await db.execute("SELECT COUNT(*) FROM users")
    total_users = (await cursor.fetchone())[0]
    
    cursor = await db.execute("SELECT COUNT(*) FROM configs")
    total_devices = (await cursor.fetchone())[0]
    
    cursor = await db.execute("SELECT COUNT(*) FROM device_memberships WHERE status = 'active'")
    bound_devices = (await cursor.fetchone())[0]
    
    # 今日新增
    today = datetime.now().strftime("%Y-%m-%d")
    cursor = await db.execute("SELECT COUNT(*) FROM users WHERE DATE(created_at) = ?", (today,))
    today_users = (await cursor.fetchone())[0]
    
    try:
        cursor = await db.execute("SELECT COUNT(*) FROM render_logs WHERE DATE(created_at) = ?", (today,))
        today_renders = (await cursor.fetchone())[0]
    except:
        today_renders = 0
    
    # 计算洞察
    insights = []
    
    if today_users > 0:
        insights.append({
            "type": "growth",
            "icon": "📈",
            "title": "用户增长",
            "desc": f"今日新增 {today_users} 位用户，总用户数 {total_users}",
            "action": "继续保持增长势头",
        })
    
    if today_renders > 100:
        insights.append({
            "type": "activity",
            "icon": "🔥",
            "title": "活跃度高",
            "desc": f"今日渲染 {today_renders} 次，系统运行良好",
            "action": "可考虑扩展更多功能",
        })
    elif today_renders > 0:
        insights.append({
            "type": "activity",
            "icon": "💡",
            "title": "系统运行",
            "desc": f"今日渲染 {today_renders} 次",
            "action": "正常运营",
        })
    
    # 设备绑定率
    bind_rate = bound_devices / total_devices if total_devices > 0 else 0
    if bind_rate < 0.3:
        insights.append({
            "type": "warning",
            "icon": "⚠️",
            "title": "设备绑定率低",
            "desc": f"仅有 {int(bind_rate*100)}% 的设备被用户绑定",
            "action": "建议优化用户引导流程",
        })
    
    return {
        "stats": {
            "total_users": total_users,
            "total_devices": total_devices,
            "bound_devices": bound_devices,
            "today_users": today_users,
            "today_renders": today_renders,
        },
        "insights": insights,
    }