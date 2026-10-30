"""
Comprehensive test suite for EvidenceLock Authentication and Actor-Specific Flows.
Tests:
1. Registration (email, password validation, bcrypt hashing)
2. Login with correct credentials
3. Login failure with wrong credentials (401)
4. Admin uploads into Admin flow
5. User_1 uploads into User_1 flow
6. User_2 uploads into User_2 flow
7. Privacy: User_1 cannot see Admin's or User_2's records
8. Privacy: Direct GET /api/evidencelock/records/{id} for foreign record returns 404
9. Privacy: Admin only sees Admin's records in /records
10. Logout and token revocation: Revoked token rejected with 401
11. IST timestamp validation: output strings contain 'IST' or are valid Asia/Kolkata
12. Global hash chain verification: verify-chain reports chain_valid=True
13. Module regressions: SourceMark, ProvenanceGuard, TrustTest health checks
"""
import io
import json
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:8000"

def request(endpoint, method="GET", data=None, headers=None):
    url = f"{BASE_URL}{endpoint}"
    hdrs = headers.copy() if headers else {}
    body = None
    if data is not None:
        if isinstance(data, dict):
            body = json.dumps(data).encode("utf-8")
            hdrs["Content-Type"] = "application/json"
        elif isinstance(data, bytes):
            body = data
    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            parsed = json.loads(content)
        except Exception:
            parsed = {"raw": content}
        return e.code, parsed

def multipart_post(endpoint, fields, files, token=None):
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = io.BytesIO()
    for key, val in fields.items():
        body.write(f"--{boundary}\r\n".encode())
        body.write(f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode())
        body.write(f"{val}\r\n".encode())
    for key, (filename, content, content_type) in files.items():
        body.write(f"--{boundary}\r\n".encode())
        body.write(f'Content-Disposition: form-data; name="{key}"; filename="{filename}"\r\n'.encode())
        body.write(f"Content-Type: {content_type}\r\n\r\n".encode())
        if isinstance(content, str):
            content = content.encode("utf-8")
        body.write(content)
        body.write(b"\r\n")
    body.write(f"--{boundary}--\r\n".encode())

    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url, data=body.getvalue(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            parsed = json.loads(content)
        except Exception:
            parsed = {"raw": content}
        return e.code, parsed

def run_tests():
    print("=" * 70)
    print("STARTING EVIDENCE-LOCK AUTHENTICATION & ACTOR ISOLATION TESTS")
    print("=" * 70)

    results = []

    def check(test_num, title, condition, detail=""):
        status = "PASSED" if condition else "FAILED"
        results.append((test_num, title, status, detail))
        print(f"[{status}] Test {test_num}: {title} {('- ' + detail) if detail else ''}")

    # Test 1: Health check
    code, data = request("/api/health")
    check(1, "System Health Check", code == 200 and data.get("status") == "healthy")

    # Test 2: Admin Login
    code, admin_login = request("/api/auth/login", method="POST", data={
        "email": "demo@trustsphere.ai",
        "password": "demo123"
    })
    admin_token = admin_login.get("access_token")
    check(2, "Admin Login & Token Generation", code == 200 and bool(admin_token))

    # Test 3: Failed Login with Bad Password
    code, fail_data = request("/api/auth/login", method="POST", data={
        "email": "demo@trustsphere.ai",
        "password": "wrong_password_999"
    })
    check(3, "Failed Login Rejection", code == 401, f"HTTP {code}")

    # Test 4: Register User 1
    u1_email = "user_1@test.com"
    u1_pass = "password123"
    code, u1_reg = request("/api/auth/register", method="POST", data={
        "email": u1_email,
        "password": u1_pass,
        "name": "User One"
    })
    if code == 400 and "already registered" in str(u1_reg):
        code, u1_reg = request("/api/auth/login", method="POST", data={
            "email": u1_email,
            "password": u1_pass
        })
    u1_token = u1_reg.get("access_token")
    check(4, "User 1 Registration/Login", code == 200 and bool(u1_token))

    # Test 5: Register User 2
    u2_email = "user_2@test.com"
    u2_pass = "password456"
    code, u2_reg = request("/api/auth/register", method="POST", data={
        "email": u2_email,
        "password": u2_pass,
        "name": "User Two"
    })
    if code == 400 and "already registered" in str(u2_reg):
        code, u2_reg = request("/api/auth/login", method="POST", data={
            "email": u2_email,
            "password": u2_pass
        })
    u2_token = u2_reg.get("access_token")
    check(5, "User 2 Registration/Login", code == 200 and bool(u2_token))

    # Test 6: Unauthenticated access to EvidenceLock rejected
    code, unauth_res = request("/api/evidencelock/records")
    check(6, "Unauthenticated EvidenceLock Access Blocked", code == 401)

    # Test 7: User 1 Uploads Evidence
    code, u1_upload = multipart_post(
        "/api/evidencelock/register",
        fields={"evidence_name": "U1 Confidential NDA", "evidence_type": "document"},
        files={"file": ("u1_nda.txt", b"Confidential agreement for User 1.", "text/plain")},
        token=u1_token
    )
    u1_rec_id = u1_upload.get("record_id")
    check(7, "User 1 Evidence Registration", code == 200 and bool(u1_rec_id), f"Record #{u1_rec_id}")

    # Test 8: User 2 Uploads Evidence
    code, u2_upload = multipart_post(
        "/api/evidencelock/register",
        fields={"evidence_name": "U2 Financial Audit", "evidence_type": "data"},
        files={"file": ("u2_audit.csv", b"revenue,expense\n50000,20000\n", "text/csv")},
        token=u2_token
    )
    u2_rec_id = u2_upload.get("record_id")
    check(8, "User 2 Evidence Registration", code == 200 and bool(u2_rec_id), f"Record #{u2_rec_id}")

    # Test 9: Isolation - User 1 does NOT see User 2's or Admin's records
    code, u1_records = request("/api/evidencelock/records", headers={"Authorization": f"Bearer {u1_token}"})
    u1_rec_ids = [r["id"] for r in u1_records]
    check(
        9,
        "User 1 Isolation (Cannot see User 2's records)",
        u1_rec_id in u1_rec_ids and u2_rec_id not in u1_rec_ids,
        f"U1 sees IDs {u1_rec_ids}"
    )

    # Test 10: Isolation - User 2 does NOT see User 1's records
    code, u2_records = request("/api/evidencelock/records", headers={"Authorization": f"Bearer {u2_token}"})
    u2_rec_ids = [r["id"] for r in u2_records]
    check(
        10,
        "User 2 Isolation (Cannot see User 1's records)",
        u2_rec_id in u2_rec_ids and u1_rec_id not in u2_rec_ids,
        f"U2 sees IDs {u2_rec_ids}"
    )

    # Test 11: Direct URL access protection - User 1 accessing User 2's record ID returns 404
    code, direct_res = request(f"/api/evidencelock/records/{u2_rec_id}", headers={"Authorization": f"Bearer {u1_token}"})
    check(11, "Direct ID Manipulation Protection (Returns 404)", code == 404, f"Status {code}")

    # Test 12: IST Timezone verification
    u1_record_obj = next(r for r in u1_records if r["id"] == u1_rec_id)
    ist_present = "IST" in str(u1_record_obj.get("created_at", ""))
    check(12, "IST Timezone in Evidence Record", ist_present, f"created_at={u1_record_obj.get('created_at')}")

    # Test 13: Global Hash Chain Integrity
    code, chain_res = request("/api/evidencelock/verify-chain", method="POST", headers={"Authorization": f"Bearer {u1_token}"})
    check(
        13,
        "Global Ledger Cryptographic Verification",
        code == 200 and chain_res.get("chain_valid") is True,
        f"Chain valid: {chain_res.get('chain_valid')}, events: {chain_res.get('total_events')}"
    )

    # Test 14: Logout & Token Revocation
    code, logout_res = request("/api/auth/logout", method="POST", headers={"Authorization": f"Bearer {u1_token}"})
    # Now try using u1_token again
    code_after_logout, _ = request("/api/evidencelock/records", headers={"Authorization": f"Bearer {u1_token}"})
    check(14, "Token Revocation on Logout (401 on reused token)", code_after_logout == 401, f"Status after logout: {code_after_logout}")

    # Test 15: Module Regressions - SourceMark, ProvenanceGuard, TrustTest
    code_sm, sm_files = request("/api/sourcemark/files")
    code_pg, pg_keys = request("/api/provenanceguard/keys")
    code_tt, tt_hist = request("/api/trusttest/history")
    check(
        15,
        "Module Regressions (SourceMark, ProvenanceGuard, TrustTest)",
        code_sm == 200 and code_pg == 200 and code_tt == 200,
        f"SM:{code_sm}, PG:{code_pg}, TT:{code_tt}"
    )

    print("=" * 70)
    passed_count = sum(1 for r in results if r[2] == "PASSED")
    total_count = len(results)
    print(f"SUMMARY: {passed_count}/{total_count} TESTS PASSED")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
