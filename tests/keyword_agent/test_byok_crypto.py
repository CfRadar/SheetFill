"""Tests for BYOK Fernet symmetric encryption, decryption, and tampering defenses."""

import pytest
from app.keyword_agent.key_store import decrypt_key, encrypt_key


def test_encryption_round_trip():
    original = "sk-or-v1-abcdef0123456789abcdef0123456789abcdef01"
    encrypted = encrypt_key(original)

    assert encrypted != original
    assert not encrypted.startswith("sk-or-")

    decrypted = decrypt_key(encrypted)
    assert decrypted == original


def test_tampered_ciphertext_rejected():
    original = "sk-or-v1-abcdef0123456789abcdef0123456789abcdef01"
    encrypted = encrypt_key(original)

    # Tamper with bytes
    tampered = encrypted[:-4] + "AAAA"
    with pytest.raises(ValueError, match="Failed to decrypt OpenRouter API key"):
        decrypt_key(tampered)


def test_empty_or_whitespace_stripped():
    key_with_spaces = "  sk-or-v1-1234567890abcdef1234567890abcdef  "
    encrypted = encrypt_key(key_with_spaces)
    decrypted = decrypt_key(encrypted)
    assert decrypted == "sk-or-v1-1234567890abcdef1234567890abcdef"
