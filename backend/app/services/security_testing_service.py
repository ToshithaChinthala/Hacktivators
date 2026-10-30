import re
from typing import Tuple

# --- Pattern banks ---
INJECTION_PATTERNS = [
    (r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions?", "PROMPT_INJECTION", 9),
    (r"disregard\s+(all\s+)?(previous|prior)\s+instructions?", "PROMPT_INJECTION", 9),
    (r"forget\s+(all\s+)?(previous|prior)\s+instructions?", "PROMPT_INJECTION", 8),
    (r"you\s+are\s+now\s+(an?\s+)?ai\s+without\s+restrictions?", "JAILBREAK", 10),
    (r"pretend\s+you\s+(have\s+no|are\s+without)\s+(rules?|restrictions?|limits?)", "JAILBREAK", 10),
    (r"act\s+as\s+if\s+you\s+(have\s+no|are\s+unrestricted)", "JAILBREAK", 9),
    (r"(reveal|show|give\s+me)\s+(your\s+)?(system\s+prompt|instructions|training\s+data)", "DATA_EXFILTRATION", 9),
    (r"(tell|give)\s+me\s+(your\s+)?(ssn|social\s+security|credit\s+card|password|api\s+key)", "SENSITIVE_DATA_REQUEST", 10),
    (r"bypass\s+(the\s+)?(safety|security|filter|restriction)", "JAILBREAK", 9),
    (r"dan\s+mode", "JAILBREAK", 10),
    (r"developer\s+mode", "JAILBREAK", 8),
    (r"jailbreak", "JAILBREAK", 10),
    (r"(execute|run)\s+(arbitrary|malicious|any)\s+(code|command|script)", "CODE_INJECTION", 9),
    (r"<script[^>]*>", "XSS", 8),
    (r"(drop|delete|truncate)\s+table", "SQL_INJECTION", 9),
    (r"union\s+select", "SQL_INJECTION", 8),
    (r"\'\s*(or|and)\s+\'?\d+\'?\s*=\s*\'?\d", "SQL_INJECTION", 8),
    (r"(/etc/passwd|/etc/shadow|cmd\.exe|powershell)", "SYSTEM_INTRUSION", 9),
]

SENSITIVE_DATA_PATTERNS = [
    (r"\b\d{3}-\d{2}-\d{4}\b", "SSN_PATTERN", 7),
    (r"\b4[0-9]{12}(?:[0-9]{3})?\b", "CREDIT_CARD", 7),
    (r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Z|a-z]{2,}\b", "EMAIL_PII", 3),
]

RISK_SCORE_MAP = {
    (0, 2): ("LOW", "No significant risk patterns detected."),
    (3, 5): ("MEDIUM", "Some potentially risky patterns found."),
    (6, 8): ("HIGH", "High-risk patterns detected — review carefully."),
    (9, 10): ("CRITICAL", "Critical security threat patterns detected."),
}

RECOMMENDATIONS = {
    "PROMPT_INJECTION": "Sanitize and validate all user-supplied prompts. Use structured system prompts and output filters.",
    "JAILBREAK": "Implement robust content-policy enforcement. Reject prompts attempting to override safety guidelines.",
    "DATA_EXFILTRATION": "Never expose system prompts or training data. Audit model outputs for information leakage.",
    "SENSITIVE_DATA_REQUEST": "Redact all PII from inputs. Implement data-loss prevention filters.",
    "CODE_INJECTION": "Sandbox all code execution. Validate and whitelist acceptable operations.",
    "XSS": "Escape all HTML output. Implement Content Security Policy headers.",
    "SQL_INJECTION": "Use parameterized queries. Never interpolate user input into SQL strings.",
    "SYSTEM_INTRUSION": "Restrict filesystem and shell access. Run services with minimal privileges.",
    "SSN_PATTERN": "PII detected in input — mask or reject before further processing.",
    "CREDIT_CARD": "PCI-DSS compliance required — never process raw card numbers.",
    "EMAIL_PII": "PII detected — ensure data handling complies with privacy regulations.",
    "NONE": "No specific threat found. Continue regular monitoring.",
}

def analyze_prompt(prompt: str) -> dict:
    text = prompt.lower()
    max_score = 0
    dominant_attack = "NONE"
    triggered = []

    for pattern, attack_type, score in INJECTION_PATTERNS + SENSITIVE_DATA_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            triggered.append((attack_type, score))
            if score > max_score:
                max_score = score
                dominant_attack = attack_type

    # Determine risk level
    risk_level = "LOW"
    for (lo, hi), (level, _) in RISK_SCORE_MAP.items():
        if lo <= max_score <= hi:
            risk_level = level
            break

    # Build analysis text
    if not triggered:
        analysis = "No malicious patterns detected. The prompt appears benign based on heuristic analysis."
    else:
        unique = list({t[0] for t in triggered})
        analysis = f"Detected patterns: {', '.join(unique)}. Risk score: {max_score}/10."

    recommendation = RECOMMENDATIONS.get(dominant_attack, RECOMMENDATIONS["NONE"])

    return {
        "detected_attack_type": dominant_attack,
        "risk_level": risk_level,
        "risk_score": float(max_score),
        "analysis": analysis,
        "recommendation": recommendation,
    }

