import hashlib
import json

def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest().strip().lower()

def sha256_string(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest().strip().lower()

def build_chain_hash(previous_hash: str | None, action: str, entity_type: str, entity_id: int, timestamp: str) -> str:
    payload = json.dumps({
        "previous_hash": previous_hash or "GENESIS",
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "timestamp": timestamp,
    }, sort_keys=True)
    return sha256_string(payload)

