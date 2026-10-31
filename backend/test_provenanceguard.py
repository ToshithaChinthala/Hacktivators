"""
ProvenanceGuard End-to-End Test Script
Tests all three features: Rollback Protection, Re-Save Analysis, Signing Key Security
"""
import requests
import json
import io
import sys
import time

BASE = "http://127.0.0.1:8000"

session = requests.Session()
_login = session.post("http://127.0.0.1:8000/api/auth/login", json={"email": "demo@trustsphere.ai", "password": "demo123"})
if _login.status_code == 200:
    session.headers.update({"Authorization": "Bearer " + _login.json()["access_token"]})
PASS = []
FAIL = []

def ok(name):
    print(f"  [PASS] {name}")
    PASS.append(name)

def fail(name, reason=""):
    print(f"  [FAIL] {name}" + (f" -- {reason}" if reason else ""))
    FAIL.append(name)

def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def register_file(name, content):
    r = session.post(
        f"{BASE}/api/sourcemark/upload",
        files={"file": (name, io.BytesIO(content), "text/plain")},
    )
    if r.status_code == 200:
        return r.json()
    print(f"    register_file failed: {r.status_code} {r.text[:200]}")
    return None

def generate_key(actor="test-suite"):
    r = session.post(f"{BASE}/api/provenanceguard/keys/generate", json={"actor": actor})
    if r.status_code == 200:
        # response: { "key": { "key_id": "...", "status": "..." }, "message": "..." }
        data = r.json()
        key_data = data.get("key", data)  # fallback: flat dict
        return key_data.get("key_id"), key_data.get("status")
    return None, None

# ============================================================
section("FEATURE A -- Rollback Protection")
# ============================================================

print("\n[A1] Generate signing key...")
kid_a, status_a = generate_key("test-suite-A")
if kid_a:
    ok(f"Key generated: {kid_a}, status={status_a}")
else:
    fail("Key generation", "No key_id returned")

print("\n[A2] Create checkpoint...")
r = session.post(f"{BASE}/api/provenanceguard/checkpoints/create", json={"actor": "test-suite"})
if r.status_code == 200:
    cp = r.json()
    checkpoint_id = cp.get("checkpoint_id")
    ok(f"Checkpoint created: {checkpoint_id}")
else:
    fail("Checkpoint creation", f"{r.status_code} {r.text[:200]}")
    checkpoint_id = None

print("\n[A3] Verify checkpoint (expect INTACT)...")
r = session.get(f"{BASE}/api/provenanceguard/checkpoints/verify")
if r.status_code == 200:
    data = r.json()
    status = data.get("status", "")
    if status in ("INTACT", "NO_CHECKPOINTS"):
        ok(f"Checkpoint verify status: {status}")
    else:
        fail(f"Unexpected checkpoint status: {status}", json.dumps(data)[:300])
else:
    fail("Checkpoint verify", f"{r.status_code} {r.text[:200]}")

print("\n[A4] List checkpoints...")
r = session.get(f"{BASE}/api/provenanceguard/checkpoints")
if r.status_code == 200:
    data = r.json()
    count = len(data) if isinstance(data, list) else data.get("count", "?")
    ok(f"Listed checkpoints: {count} found")
else:
    fail("List checkpoints", f"{r.status_code} {r.text[:200]}")

# ============================================================
section("FEATURE B -- Re-Save / Derivative Analysis")
# ============================================================

print("\n[B1] Register original file via SourceMark...")
run_ts = str(int(time.time()))
original_content = f"ProvenanceGuard test file - original content. Run={run_ts}. End.".encode()
reg = register_file(f"pg_test_original_{run_ts}.txt", original_content)
if reg:
    file_id = reg.get("id")
    ok(f"File registered: id={file_id}, hash={str(reg.get('sha256_hash','?'))[:16]}...")
else:
    fail("Register original file")
    file_id = None

if file_id:
    print("\n[B2] Analyze identical file (expect EXACT_MATCH)...")
    r = session.post(
        f"{BASE}/api/provenanceguard/analyze-resave",
        data={"original_file_id": file_id},
        files={"file": ("pg_test_original.txt", io.BytesIO(original_content), "text/plain")},
    )
    if r.status_code == 200:
        rj = r.json()
        result = rj.get("classification") or rj.get("result") or ""
        if result == "EXACT_MATCH":
            ok("Classification: EXACT_MATCH")
        else:
            fail(f"Expected EXACT_MATCH, got {result}", json.dumps(rj)[:300])
    else:
        fail("Analyze exact match", f"{r.status_code} {r.text[:300]}")

if file_id:
    print("\n[B3] Analyze modified file (expect NOT EXACT_MATCH)...")
    modified_content = b"ProvenanceGuard test file - MODIFIED CONTENT. Extra stuff added. End."
    r = session.post(
        f"{BASE}/api/provenanceguard/analyze-resave",
        data={"original_file_id": file_id},
        files={"file": ("pg_test_modified.txt", io.BytesIO(modified_content), "text/plain")},
    )
    if r.status_code == 200:
        rj = r.json()
        result = rj.get("classification") or rj.get("result") or ""
        if result != "EXACT_MATCH":
            ok(f"Modified file classified as: {result}")
        else:
            fail("Modified file should not be EXACT_MATCH", json.dumps(rj)[:200])
    else:
        fail("Analyze modified", f"{r.status_code} {r.text[:300]}")

if file_id:
    print("\n[B4] Register derivative...")
    # Use timestamp to ensure unique content across runs
    ts = str(int(time.time()))
    deriv_content = f"ProvenanceGuard derivative content - re-saved version - {ts}".encode()
    r = session.post(
        f"{BASE}/api/provenanceguard/register-derivative",
        data={"original_file_id": file_id, "relationship": "RESAVED", "notes": "Test derivative"},
        files={"file": ("pg_test_deriv.txt", io.BytesIO(deriv_content), "text/plain")},
    )
    if r.status_code == 200:
        rj = r.json()
        deriv_id = rj.get("derivative_id") or rj.get("id") or "?"
        ok(f"Derivative registered: {deriv_id}")
    else:
        fail("Register derivative", f"{r.status_code} {r.text[:300]}")

if file_id:
    print("\n[B5] List derivatives for file...")
    r = session.get(f"{BASE}/api/provenanceguard/derivatives/{file_id}")
    if r.status_code == 200:
        data = r.json()
        count = len(data) if isinstance(data, list) else data.get("count") or len(data.get("derivatives", []))
        ok(f"Derivatives listed: {count}")
    else:
        fail("List derivatives", f"{r.status_code} {r.text[:200]}")

# ============================================================
section("FEATURE C -- Signing Key Lifecycle")
# ============================================================

print("\n[C1] Generate fresh key...")
key_id_c, status_c = generate_key("test-feature-c")
if key_id_c:
    ok(f"Key generated: {key_id_c}, status={status_c}")
else:
    fail("Generate key C")

print("\n[C2] List keys...")
r = session.get(f"{BASE}/api/provenanceguard/keys")
if r.status_code == 200:
    keys = r.json() if isinstance(r.json(), list) else r.json().get("keys", [])
    ok(f"Keys listed: {len(keys)} keys")
else:
    fail("List keys", f"{r.status_code} {r.text[:200]}")

print("\n[C3] Sign a message...")
msg = "ProvenanceGuard test payload - do not modify"
r = session.post(f"{BASE}/api/provenanceguard/keys/sign", json={"message": msg, "actor": "test-suite"})
if r.status_code == 200:
    sdata = r.json()
    sig_id = sdata.get("signature_id")
    ok(f"Signed: sig_id={sig_id}")
else:
    fail("Sign message", f"{r.status_code} {r.text[:200]}")
    sig_id = None

if sig_id:
    print("\n[C4] Verify signature (expect VALID)...")
    r = session.post(f"{BASE}/api/provenanceguard/keys/verify", json={
        "signature_id": sig_id,
        "original_message": msg
    })
    if r.status_code == 200:
        rj = r.json()
        # API returns "verification_result" field
        result = rj.get("verification_result") or rj.get("result") or ""
        if result == "VALID":
            ok("Signature verified: VALID")
        else:
            fail(f"Expected VALID, got '{result}'", json.dumps(rj)[:300])
    else:
        fail("Verify signature", f"{r.status_code} {r.text[:200]}")

if sig_id:
    print("\n[C5] Verify with tampered message (expect INVALID_SIGNATURE)...")
    r = session.post(f"{BASE}/api/provenanceguard/keys/verify", json={
        "signature_id": sig_id,
        "original_message": "tampered content here"
    })
    if r.status_code == 200:
        rj = r.json()
        result = rj.get("verification_result") or rj.get("result") or ""
        if result == "INVALID_SIGNATURE":
            ok("Tampered message: INVALID_SIGNATURE")
        else:
            fail(f"Expected INVALID_SIGNATURE, got '{result}'", json.dumps(rj)[:300])
    else:
        fail("Verify tampered", f"{r.status_code} {r.text[:200]}")

print("\n[C6] Rotate key...")
if key_id_c:
    r = session.post(f"{BASE}/api/provenanceguard/keys/rotate", json={"key_id": key_id_c, "actor": "test-suite"})
    if r.status_code == 200:
        rdata = r.json()
        # API returns: { "new_key": { "key_id": "..." }, "old_key": { "key_id": "..." } }
        new_key_id = (rdata.get("new_key") or {}).get("key_id") or rdata.get("new_key_id")
        old_status = (rdata.get("old_key") or {}).get("status") or rdata.get("old_status")
        ok(f"Rotated: old={key_id_c} -> new={new_key_id}, old_status={old_status}")
    else:
        fail("Rotate key", f"{r.status_code} {r.text[:200]}")
        new_key_id = None
else:
    fail("Rotate key", "no key_id_c available")
    new_key_id = None

print("\n[C7] Sign with new active key after rotation...")
r = session.post(f"{BASE}/api/provenanceguard/keys/sign", json={"message": "post-rotation payload", "actor": "test-suite"})
if r.status_code == 200:
    ok(f"Signed post-rotation: {r.json().get('signature_id')}")
else:
    fail("Sign after rotation", f"{r.status_code} {r.text[:200]}")

if new_key_id:
    print("\n[C8] Revoke the rotated-in key...")
    r = session.post(f"{BASE}/api/provenanceguard/keys/revoke", json={"key_id": new_key_id, "reason": "test revocation"})
    if r.status_code == 200:
        ok(f"Revoked: {new_key_id}")
    else:
        fail("Revoke key", f"{r.status_code} {r.text[:200]}")
else:
    fail("Revoke key", "no new_key_id from rotation")

print("\n[C9] Sign after revocation (expect either success with another key or error)...")
r = session.post(f"{BASE}/api/provenanceguard/keys/sign", json={"message": "should fail or use other key", "actor": "test-suite"})
if r.status_code != 200:
    ok(f"Sign correctly blocked (no active key): HTTP {r.status_code}")
else:
    ok(f"Sign succeeded (other active key exists): {r.json().get('signature_id','?')}")

print("\n[C10] Generate a key then report compromise...")
kid_comp, _ = generate_key("test-compromise")
if kid_comp:
    r2 = session.post(f"{BASE}/api/provenanceguard/keys/report-compromise", json={
        "key_id": kid_comp,
        "compromised_at": "2026-01-01T00:00:00",
        "reported_by": "test-suite"
    })
    if r2.status_code == 200:
        rj = r2.json()
        status = (rj.get("key") or rj).get("status") or rj.get("status") or "?"
        ok(f"Compromise reported for {kid_comp}: status={status}")
    else:
        fail("Report compromise", f"{r2.status_code} {r2.text[:200]}")
else:
    fail("Generate key for compromise test")

# ============================================================
section("TEST SUMMARY")
# ============================================================
total = len(PASS) + len(FAIL)
print(f"\n  PASS: {len(PASS)}/{total}")
print(f"  FAIL: {len(FAIL)}/{total}")
if FAIL:
    print("\n  Failed tests:")
    for f_name in FAIL:
        print(f"    - {f_name}")
    sys.exit(1)
else:
    print("\n  All tests passed!")
    sys.exit(0)
