"""Validated internal request contract, with legacy Mini Program field aliases."""
from __future__ import annotations

import math
import re
import uuid
from datetime import datetime
from typing import Any


class ContractError(ValueError):
    def __init__(self, message: str, code: str = "INVALID_REQUEST", status: int = 400):
        super().__init__(message)
        self.code = code
        self.status = status


def object_value(value: Any, field: str) -> dict:
    if not isinstance(value, dict):
        raise ContractError(f"{field} must be an object")
    return value


def string_value(value: Any, field: str, maximum: int, *, required: bool = False) -> str:
    if not isinstance(value, str) or len(value) > maximum or (required and not value.strip()):
        raise ContractError(f"{field} must be a string of {'1' if required else '0'}-{maximum} characters")
    try:
        value.encode("utf-8")
    except UnicodeEncodeError:
        raise ContractError(f"{field} must contain valid Unicode") from None
    return value


def integer_value(value: Any, field: str, minimum: int, maximum: int) -> int:
    if type(value) is not int or not minimum <= value <= maximum:
        raise ContractError(f"{field} must be an integer from {minimum} to {maximum}")
    return value


def list_value(value: Any, field: str) -> list[str]:
    if not isinstance(value, list) or len(value) > 12:
        raise ContractError(f"{field} must contain at most 12 strings")
    return [string_value(item, field, 80, required=True) for item in value]


def normalize_request(payload: Any) -> dict:
    payload = object_value(payload, "request")
    query = payload.get("query", payload.get("message", payload.get("destinationHint", "")))
    query = string_value(query, "query", 120, required=True)
    request_id = string_value(payload.get("requestId", f"agent_req_{uuid.uuid4().hex}"), "requestId", 128, required=True)
    if not re.fullmatch(r"[A-Za-z0-9_.:-]+", request_id):
        raise ContractError("requestId contains unsupported characters")
    session = string_value(payload.get("anonymousSessionId", ""), "anonymousSessionId", 128)
    origin_input = object_value(payload.get("origin", {}), "origin")
    origin = {}
    for key, maximum in (("label", 120), ("city", 80), ("source", 80)):
        fallback = payload.get("originLabel" if key == "label" else key)
        value = origin_input.get(key, fallback)
        if value is not None:
            origin[key] = string_value(value, f"origin.{key}", maximum)
    point = payload.get("originPoint")
    if point is not None:
        point = object_value(point, "originPoint")
    point = point or {}
    lng = origin_input.get("lng", point.get("lng", point.get("longitude")))
    lat = origin_input.get("lat", point.get("lat", point.get("latitude")))
    warnings = []
    if lng is not None or lat is not None:
        if any(type(value) not in (int, float) or not math.isfinite(value) for value in (lng, lat)):
            raise ContractError("origin coordinates must be a finite numeric pair", "ORIGIN_INVALID")
        if not -180 <= lng <= 180 or not -90 <= lat <= 90:
            raise ContractError("origin coordinates are outside valid bounds", "ORIGIN_INVALID")
        if 73 <= lng <= 135 and 3 <= lat <= 54:
            origin.update(lng=lng, lat=lat)
        else:
            warnings.append("ORIGIN_COORDINATES_IGNORED")

    nested_preferences = object_value(payload.get("preferences", {}), "preferences")
    preferences = {}
    string_fields = ("ageRange", "duration", "difficulty", "transport", "activityType")
    list_fields = ("scenePreferences", "safetyNeeds", "companions")
    for field in (*string_fields, *list_fields, "driveLimitMinutes"):
        if field not in nested_preferences and field not in payload:
            continue
        value = nested_preferences.get(field, payload.get(field))
        if field in string_fields:
            value = string_value(value, f"preferences.{field}", 80)
        elif field in list_fields:
            value = list_value(value, f"preferences.{field}")
        else:
            value = integer_value(value, "preferences.driveLimitMinutes", 1, 1440)
        preferences[field] = value

    departure = payload.get("departureTime")
    if departure is not None:
        departure = object_value(departure, "departureTime").copy()
        allowed_fields = {"mode": 80, "iso": 64, "timezone": 64, "date": 10, "time": 8, "label": 120}
        if set(departure) - allowed_fields.keys():
            raise ContractError("departureTime contains unsupported fields")
        for field, value in departure.items():
            string_value(value, f"departureTime.{field}", allowed_fields[field])
        if departure.get("iso"):
            try:
                parsed = datetime.fromisoformat(departure["iso"].replace("Z", "+00:00"))
                if parsed.tzinfo is None:
                    raise ValueError()
            except ValueError:
                raise ContractError("departureTime.iso must include an ISO-8601 timezone") from None

    nested_policy = object_value(payload.get("sourcePolicy", {}), "sourcePolicy")
    policy = {}
    for field in ("includeSystem", "includeMap", "includeGuide", "includeUserShared"):
        value = nested_policy.get(field, payload.get(field, True))
        if type(value) is not bool:
            raise ContractError(f"sourcePolicy.{field} must be a boolean")
        policy[field] = value
    policy["limit"] = integer_value(nested_policy.get("limit", payload.get("limit", 10)), "sourcePolicy.limit", 1, 50)
    return {
        "requestId": request_id, "query": query, "origin": origin,
        "preferences": preferences, "departureTime": departure,
        "sourcePolicy": policy, "anonymousSessionId": session, "warnings": warnings,
    }


def parse_intent(request: dict) -> dict:
    """Explicit filters, including empty lists, always win over text inference."""
    text = request["query"]
    preferences = request["preferences"]
    companions = []
    if any(word in text for word in ("孩子", "亲子", "小孩", "儿童")):
        companions.append("children")
    if any(word in text for word in ("老人", "父母", "长辈")):
        companions.append("elderly")
    scenery = [word for word in ("水景", "湖", "溪", "森林", "自然", "公园", "绿道", "海边") if word in text]
    inferred_difficulty = "easy" if any(word in text for word in ("轻松", "不累", "简单", "低强度")) else "unknown"
    inferred_activity = "hiking" if any(word in text for word in ("徒步", "步道", "走", "路线")) else "outdoor"
    return {
        "raw": text, "query": text, "origin": request["origin"], "preferences": preferences,
        "departureTime": request["departureTime"], "sourcePolicy": request["sourcePolicy"],
        "anonymousSessionId": request["anonymousSessionId"],
        "companions": preferences.get("companions", companions),
        "difficulty": preferences.get("difficulty", inferred_difficulty),
        "scenery": preferences.get("scenePreferences", scenery),
        "activityType": preferences.get("activityType", inferred_activity),
    }
