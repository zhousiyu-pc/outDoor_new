"""Connector boundary, evidence normalization and bounded candidate orchestration."""
from __future__ import annotations

import copy
import math
import queue
import re
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Protocol

from contracts import ContractError, list_value, object_value, parse_intent, string_value

SOURCE_FLAGS = {
    "SYSTEM": "includeSystem", "SYSTEM_LIBRARY": "includeSystem",
    "AMAP_POI": "includeMap", "GUIDE_PUBLIC": "includeGuide",
    "USER_SHARED": "includeUserShared", "LOCAL_PREVIEW": "includeSystem",
}
# Timed-out providers keep their slot until they finish; a hung provider cannot
# cause unbounded creation of background workers on subsequent requests.
CONNECTOR_SLOTS = threading.BoundedSemaphore(8)


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class Connector(Protocol):
    source_type: str

    def fetch(self, intent: dict, *, deadline: float) -> list[dict]:
        """Return evidence-backed candidates; provider I/O must honor deadline."""
        ...


class DemoConnector:
    source_type = "LOCAL_PREVIEW"

    def fetch(self, intent: dict, *, deadline: float) -> list[dict]:
        timestamp = now_iso()
        return [{
            "id": f"preview_{index}", "title": title, "subtitle": "仅用于界面演示",
            "sourceType": self.source_type, "sourceLabel": "本地演示",
            "collectedAt": timestamp, "previewOnly": True, "adoptionRequired": False,
            "sourceEvidence": [{"sourceId": f"demo_{index}", "type": self.source_type,
                                "label": "本地演示", "accessMode": "MOCK", "collectedAt": timestamp}],
            "matchReasons": [], "missingItems": ["路线和设施未经核验"],
            "riskWarnings": ["演示数据不可采纳，不可作为出行依据"],
            "routeStats": {}, "geo": {"name": title},
        } for index, title in enumerate(("近郊自然步道（演示）", "城市公园环线（演示）"), start=1)]


def call_connector(connector: Connector, intent: dict, deadline: float) -> list[dict]:
    if deadline <= time.monotonic():
        raise TimeoutError()
    if not CONNECTOR_SLOTS.acquire(blocking=False):
        raise RuntimeError("connector capacity reached")
    result = queue.Queue(maxsize=1)

    def run() -> None:
        try:
            result.put((True, connector.fetch(copy.deepcopy(intent), deadline=deadline)))
        except Exception:
            # Provider exceptions can contain URLs, tokens and queries: never log them.
            result.put((False, None))
        finally:
            CONNECTOR_SLOTS.release()

    try:
        threading.Thread(target=run, daemon=True).start()
    except Exception:
        CONNECTOR_SLOTS.release()
        raise
    try:
        succeeded, items = result.get(timeout=max(0, deadline - time.monotonic()))
    except queue.Empty:
        raise TimeoutError() from None
    if not succeeded:
        raise RuntimeError("connector failed")
    if not isinstance(items, list) or len(items) > 200:
        raise ContractError("connector must return at most 200 candidates")
    return items


def normalize_candidate(raw: dict, source_type: str, policy: dict) -> dict:
    raw = object_value(raw, "candidate")
    title = string_value(raw.get("title"), "candidate.title", 200, required=True).strip()
    evidence = raw.get("sourceEvidence")
    if not isinstance(evidence, list) or not 1 <= len(evidence) <= 20:
        raise ContractError("candidate evidence is required")
    normalized_evidence = []
    for entry in evidence:
        entry = object_value(entry, "sourceEvidence")
        evidence_type = string_value(entry.get("type"), "evidence.type", 80, required=True)
        if evidence_type != source_type or not policy.get(SOURCE_FLAGS.get(evidence_type, ""), False):
            raise ContractError("evidence source does not match permitted connector")
        item = {key: string_value(entry.get(key), f"evidence.{key}", maximum, required=True)
                for key, maximum in (("sourceId", 200), ("type", 80), ("label", 200), ("accessMode", 80), ("collectedAt", 64))}
        if source_type == "LOCAL_PREVIEW" and item["accessMode"] != "MOCK":
            raise ContractError("preview evidence must use MOCK access mode")
        if source_type != "LOCAL_PREVIEW" and item["accessMode"] == "MOCK":
            raise ContractError("mock evidence must use LOCAL_PREVIEW source")
        for key in ("url", "expiresAt"):
            if key in entry:
                item[key] = string_value(entry[key], f"evidence.{key}", 2048 if key == "url" else 64)
        try:
            collected = datetime.fromisoformat(item["collectedAt"].replace("Z", "+00:00"))
            if collected.tzinfo is None:
                raise ValueError()
        except ValueError:
            raise ContractError("evidence timestamp must include timezone") from None
        normalized_evidence.append(item)
    geo = object_value(raw.get("geo", {}), "geo")
    normalized_geo = {key: string_value(geo[key], f"geo.{key}", 300)
                      for key in ("name", "address", "placeId", "provider") if key in geo}
    lng, lat = geo.get("lng"), geo.get("lat")
    if lng is not None or lat is not None:
        if (any(type(value) not in (int, float) or not math.isfinite(value) for value in (lng, lat))
                or not 73 <= lng <= 135 or not 3 <= lat <= 54):
            raise ContractError("candidate coordinates are outside supported bounds")
        normalized_geo.update(lng=lng, lat=lat)
    stats = object_value(raw.get("routeStats", {}), "routeStats")
    normalized_stats = {key: string_value(stats[key], f"routeStats.{key}", 200)
                        for key in ("driveTimeText", "walkDistanceText", "childDurationText") if key in stats}
    candidate_id = string_value(raw.get("candidateId", raw.get("id", f"cand_{uuid.uuid4().hex}")), "candidateId", 128, required=True)
    preview = source_type == "LOCAL_PREVIEW"
    return {
        "id": candidate_id, "candidateId": candidate_id, "title": title,
        "subtitle": string_value(raw.get("subtitle", ""), "subtitle", 300),
        "sourceType": source_type, "sourceLabel": normalized_evidence[0]["label"],
        "collectedAt": normalized_evidence[0]["collectedAt"], "sourceEvidence": normalized_evidence,
        "previewOnly": preview, "adoptionRequired": not preview,
        "matchReasons": list_value(raw.get("matchReasons", []), "matchReasons"),
        "missingItems": list_value(raw.get("missingItems", []), "missingItems"),
        "riskWarnings": list_value(raw.get("riskWarnings", []), "riskWarnings"),
        "routeStats": normalized_stats, "geo": normalized_geo,
    }


def candidate_key(candidate: dict) -> tuple:
    geo = candidate["geo"]
    title = re.sub(r"\s+", "", candidate["title"]).casefold()
    if geo.get("placeId") and geo.get("provider"):
        return ("place", geo["provider"], geo["placeId"])
    if "lng" in geo and "lat" in geo:
        return ("point", title, round(geo["lng"], 5), round(geo["lat"], 5))
    if geo.get("address"):
        return ("address", title, re.sub(r"\s+", "", geo["address"]).casefold())
    return ("source", candidate["sourceType"], candidate["candidateId"])


def deduplicate(candidates: list[dict]) -> list[dict]:
    unique = {}
    for candidate in candidates:
        key = candidate_key(candidate)
        if key not in unique:
            unique[key] = copy.deepcopy(candidate)
            continue
        kept = unique[key]
        evidence_keys = {(item["type"], item["sourceId"], item.get("url")) for item in kept["sourceEvidence"]}
        for item in candidate["sourceEvidence"]:
            evidence_key = (item["type"], item["sourceId"], item.get("url"))
            if evidence_key not in evidence_keys:
                kept["sourceEvidence"].append(copy.deepcopy(item))
                evidence_keys.add(evidence_key)
        for field in ("matchReasons", "missingItems", "riskWarnings"):
            kept[field] = list(dict.fromkeys(kept[field] + candidate[field]))
        kept["previewOnly"] = kept["previewOnly"] or candidate["previewOnly"]
        kept["adoptionRequired"] = not kept["previewOnly"]
    return list(unique.values())


def recommend(request: dict, connectors: tuple[Connector, ...] = (), *, demo_mode: bool = False, deadline_ms: int = 1000) -> dict:
    if type(deadline_ms) is not int or not 1 <= deadline_ms <= 10000:
        raise ValueError("deadline_ms must be an integer from 1 to 10000")
    intent = parse_intent(request)
    warnings = list(request["warnings"])
    candidates = []
    deadline = time.monotonic() + deadline_ms / 1000
    configured = connectors + ((DemoConnector(),) if demo_mode else ())
    allowed = [connector for connector in configured
               if request["sourcePolicy"].get(SOURCE_FLAGS.get(connector.source_type, ""), False)
               and (connector.source_type != "LOCAL_PREVIEW" or demo_mode)]
    if not configured:
        warnings.append("SOURCE_NOT_CONFIGURED")
    elif not allowed:
        warnings.append("NO_SOURCES_ENABLED")
    if demo_mode:
        warnings.append("DEMO_MODE_PREVIEW_ONLY")
    for connector in allowed:
        try:
            items = call_connector(connector, intent, deadline)
            for raw in items:
                try:
                    candidates.append(normalize_candidate(raw, connector.source_type, request["sourcePolicy"]))
                except ContractError:
                    warnings.append("SOURCE_INVALID_EVIDENCE")
        except TimeoutError:
            warnings.append("AGENT_TIMEOUT")
            break
        except Exception:
            warnings.append("SOURCE_DEGRADED")
    items = deduplicate(candidates)[:request["sourcePolicy"]["limit"]]
    for rank, candidate in enumerate(items, start=1):
        candidate["rank"] = rank
    failed = any(warning in warnings for warning in ("AGENT_TIMEOUT", "SOURCE_DEGRADED", "SOURCE_INVALID_EVIDENCE", "DEMO_MODE_PREVIEW_ONLY"))
    return {
        "ok": True, "requestId": request["requestId"],
        "status": "DEGRADED" if failed else ("READY" if items else "NO_SEARCH_RESULTS"),
        "resultType": "CANDIDATE_REFERENCE", "intent": intent, "items": items,
        "warnings": list(dict.fromkeys(warnings)), "generatedAt": now_iso(),
    }
