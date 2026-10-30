from typing import Any

def verify_credential(
    credential_type: str,
    claim_value: str,
    threshold: str,
    issuer: str,
) -> dict:
    """
    Selective-disclosure server-side verification.
    Returns eligibility WITHOUT exposing the raw claim_value.
    """
    import uuid
    receipt_id = str(uuid.uuid4())

    try:
        if credential_type == "age_verification":
            age = int(claim_value)
            min_age = int(threshold)
            eligible = age >= min_age
            message = (
                f"Age requirement ({min_age}+) satisfied." if eligible
                else f"Age requirement ({min_age}+) not met."
            )

        elif credential_type == "income_verification":
            income = float(claim_value.replace(",", ""))
            threshold_val = float(threshold.replace(",", ""))
            eligible = income >= threshold_val
            message = (
                f"Income threshold met." if eligible
                else f"Income below required threshold."
            )

        elif credential_type == "location_verification":
            eligible = claim_value.strip().upper() == threshold.strip().upper()
            message = (
                "Location verified." if eligible
                else "Location does not match required region."
            )

        elif credential_type == "membership_verification":
            levels = ["basic", "standard", "premium", "enterprise"]
            claim_level = claim_value.strip().lower()
            required_level = threshold.strip().lower()
            eligible = (
                levels.index(claim_level) >= levels.index(required_level)
                if claim_level in levels and required_level in levels
                else claim_value.strip().lower() == threshold.strip().lower()
            )
            message = "Membership level verified." if eligible else "Insufficient membership level."

        else:
            eligible = claim_value.strip() == threshold.strip()
            message = "Credential verified." if eligible else "Credential check failed."

    except (ValueError, TypeError):
        eligible = False
        message = "Invalid credential data format."

    return {
        "verification_status": "ELIGIBLE" if eligible else "NOT_ELIGIBLE",
        "credential_type": credential_type,
        "issuer": issuer,
        "message": message,
        "receipt_id": receipt_id,
        # NOTE: raw claim_value is intentionally NOT returned
    }

