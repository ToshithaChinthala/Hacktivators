"""
Comprehensive Test Suite for User-Wise Data Isolation in TrustSphere AI.
Validates:
1. Toshitha logs in and uploads 3 files.
2. Lavanya logs in and uploads 2 files.
3. Toshitha sees only her files in SourceMark.
4. Lavanya sees only her files in SourceMark.
5. Direct cross-user access attempts return HTTP 404:
   - /api/sourcemark/verify with foreign file ID
   - /api/provenanceguard/analyze-resave with foreign file ID
   - /api/provenanceguard/derivatives/{foreign_file_id}
6. Dashboard stats are strictly user-isolated.
7. Dashboard recent activity is strictly user-isolated.
8. Trust reports are strictly user-isolated.
9. EvidenceLock records are strictly user-isolated.
"""
import io
import json
import urllib.request
import urllib.error
import os

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
    boundary = "----WebKitFormBoundaryIsolation7MA4YWxkTr"
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
    print("STARTING USER-WISE DATA ISOLATION TEST SUITE")
    print("=" * 70)

    results = []

    def check(test_num, title, condition, detail=""):
        status = "PASSED" if condition else "FAILED"
        results.append((test_num, title, status, detail))
        print(f"[{status}] Test {test_num}: {title} {('- ' + detail) if detail else ''}")

    # Step 1: Login Toshitha
    st, toshitha_login = request("/api/auth/login", method="POST", data={"email": "toshithac@gmail.com", "password": "Toshitha"})
    toshitha_token = toshitha_login.get("access_token")
    check(1, "Toshitha Login", st == 200 and bool(toshitha_token), f"HTTP {st}")

    # Step 2: Login Lavanya
    st, lavanya_login = request("/api/auth/login", method="POST", data={"email": "lavanyalavanya20006@gmail.com", "password": "lavanya"})
    lavanya_token = lavanya_login.get("access_token")
    check(2, "Lavanya Login", st == 200 and bool(lavanya_token), f"HTTP {st}")

    # Step 3: Toshitha uploads 3 distinct files to SourceMark
    toshitha_file_ids = []
    for i in range(1, 4):
        fname = f"toshitha_private_doc_{i}_{os.urandom(3).hex()}.txt"
        fcontent = f"Toshitha confidential document {i}. Nonce: {os.urandom(6).hex()}"
        code, up_res = multipart_post(
            "/api/sourcemark/upload",
            fields={},
            files={"file": (fname, fcontent, "text/plain")},
            token=toshitha_token
        )
        fid = up_res.get("id")
        if fid:
            toshitha_file_ids.append(fid)
    check(3, "Toshitha Uploads 3 Files", len(toshitha_file_ids) == 3, f"IDs: {toshitha_file_ids}")

    # Step 4: Lavanya uploads 2 distinct files to SourceMark
    lavanya_file_ids = []
    for i in range(1, 3):
        fname = f"lavanya_secure_spec_{i}_{os.urandom(3).hex()}.txt"
        fcontent = f"Lavanya private specification {i}. Nonce: {os.urandom(6).hex()}"
        code, up_res = multipart_post(
            "/api/sourcemark/upload",
            fields={},
            files={"file": (fname, fcontent, "text/plain")},
            token=lavanya_token
        )
        fid = up_res.get("id")
        if fid:
            lavanya_file_ids.append(fid)
    check(4, "Lavanya Uploads 2 Files", len(lavanya_file_ids) == 2, f"IDs: {lavanya_file_ids}")

    # Step 5: Check Toshitha's file listing (/api/sourcemark/files)
    st, toshitha_files = request("/api/sourcemark/files", headers={"Authorization": f"Bearer {toshitha_token}"})
    t_fids = [f["id"] for f in toshitha_files]
    toshitha_sees_her_files = all(fid in t_fids for fid in toshitha_file_ids)
    toshitha_no_lavanya = not any(fid in t_fids for fid in lavanya_file_ids)
    check(5, "Toshitha Sees ONLY Her Own Files", toshitha_sees_her_files and toshitha_no_lavanya, f"Toshitha sees IDs: {t_fids}")

    # Step 6: Check Lavanya's file listing (/api/sourcemark/files)
    st, lavanya_files = request("/api/sourcemark/files", headers={"Authorization": f"Bearer {lavanya_token}"})
    l_fids = [f["id"] for f in lavanya_files]
    lavanya_sees_her_files = all(fid in l_fids for fid in lavanya_file_ids)
    lavanya_no_toshitha = not any(fid in l_fids for fid in toshitha_file_ids)
    check(6, "Lavanya Sees ONLY Her Own Files", lavanya_sees_her_files and lavanya_no_toshitha, f"Lavanya sees IDs: {l_fids}")

    # Step 7: Direct Cross-User Verification Access Denial
    # Lavanya tries to verify a modified version against Toshitha's file ID
    target_toshitha_id = toshitha_file_ids[0]
    st, cross_verify = multipart_post(
        "/api/sourcemark/verify",
        fields={"original_file_id": str(target_toshitha_id)},
        files={"file": ("tamper_attempt.txt", "tampered content", "text/plain")},
        token=lavanya_token
    )
    check(7, "Cross-User Verification Denied (HTTP 404)", st == 404, f"HTTP {st}: {cross_verify}")

    # Step 8: Direct Cross-User Re-Save Analysis Denial
    st, cross_resave = multipart_post(
        "/api/provenanceguard/analyze-resave",
        fields={"original_file_id": str(target_toshitha_id)},
        files={"file": ("tamper_resave.txt", "tampered resave content", "text/plain")},
        token=lavanya_token
    )
    check(8, "Cross-User Provenance Re-Save Analysis Denied (HTTP 404)", st == 404, f"HTTP {st}: {cross_resave}")

    # Step 9: Direct Cross-User Derivatives Listing Denial
    st, cross_deriv = request(f"/api/provenanceguard/derivatives/{target_toshitha_id}", headers={"Authorization": f"Bearer {lavanya_token}"})
    check(9, "Cross-User Derivatives Access Denied (HTTP 404)", st == 404, f"HTTP {st}: {cross_deriv}")

    # Step 10: Dashboard Stats Isolation
    st_t, t_stats = request("/api/dashboard/stats", headers={"Authorization": f"Bearer {toshitha_token}"})
    st_l, l_stats = request("/api/dashboard/stats", headers={"Authorization": f"Bearer {lavanya_token}"})
    check(
        10,
        "Dashboard Statistics Isolation",
        t_stats.get("total_files") == len(t_fids) and l_stats.get("total_files") == len(l_fids),
        f"Toshitha stats: {t_stats.get('total_files')} (expected {len(t_fids)}), Lavanya stats: {l_stats.get('total_files')} (expected {len(l_fids)})"
    )

    # Step 11: Dashboard Recent Activity Isolation
    st_t, t_activity = request("/api/dashboard/activity", headers={"Authorization": f"Bearer {toshitha_token}"})
    st_l, l_activity = request("/api/dashboard/activity", headers={"Authorization": f"Bearer {lavanya_token}"})
    t_actors = set(a.get("actor") for a in t_activity)
    l_actors = set(a.get("actor") for a in l_activity)
    check(
        11,
        "Dashboard Activity Feed Isolation",
        all("toshithac@gmail.com" in a for a in t_actors if a) and all("lavanyalavanya20006@gmail.com" in a for a in l_actors if a),
        f"Toshitha actors: {t_actors}, Lavanya actors: {l_actors}"
    )

    # Step 12: Trust Report User Isolation
    st_t, t_report = request("/api/reports/trust-report", headers={"Authorization": f"Bearer {toshitha_token}"})
    st_l, l_report = request("/api/reports/trust-report", headers={"Authorization": f"Bearer {lavanya_token}"})
    check(
        12,
        "Trust Report Metrics Isolation",
        t_report.get("sourcemark", {}).get("total_files") == len(t_fids) and
        l_report.get("sourcemark", {}).get("total_files") == len(l_fids),
        f"Toshitha report files: {t_report.get('sourcemark', {}).get('total_files')} (expected {len(t_fids)}), Lavanya report files: {l_report.get('sourcemark', {}).get('total_files')} (expected {len(l_fids)})"
    )

    # Step 13: EvidenceLock Records Isolation
    st_t, t_evidence = request("/api/evidencelock/records", headers={"Authorization": f"Bearer {toshitha_token}"})
    st_l, l_evidence = request("/api/evidencelock/records", headers={"Authorization": f"Bearer {lavanya_token}"})
    t_ev_owners = set(r.get("uploaded_by") for r in t_evidence)
    l_ev_owners = set(r.get("uploaded_by") for r in l_evidence)
    check(
        13,
        "EvidenceLock Records Isolation",
        all("toshithac@gmail.com" in o for o in t_ev_owners if o) and all("lavanyalavanya20006@gmail.com" in o for o in l_ev_owners if o),
        f"Toshitha evidence owners: {t_ev_owners}, Lavanya evidence owners: {l_ev_owners}"
    )

    # Step 14: Unauthenticated Access Blocked
    st_unauth, _ = request("/api/dashboard/stats")
    check(14, "Unauthenticated Dashboard Access Blocked (HTTP 401)", st_unauth == 401, f"HTTP {st_unauth}")

    print("=" * 70)
    passed_count = sum(1 for r in results if r[2] == "PASSED")
    total_count = len(results)
    print(f"SUMMARY: {passed_count}/{total_count} TESTS PASSED")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
