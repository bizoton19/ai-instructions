"""Prototype password hashing (replace with Entra ID OIDC for production)."""

import hashlib
import os
import secrets


def hash_password(password: str, salt_hex: str | None = None) -> tuple[str, str]:
    salt = bytes.fromhex(salt_hex) if salt_hex else os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 390000)
    return dk.hex(), salt.hex()


def verify_password(password: str, salt_hex: str, hash_hex: str) -> bool:
    calc, _ = hash_password(password, salt_hex)
    return secrets.compare_digest(calc, hash_hex)
