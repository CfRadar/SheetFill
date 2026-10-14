#!/usr/bin/env python3
"""Interactive utility to generate Argon2id password hash for ADMIN_PASSWORD_HASH."""

import getpass
import sys
from argon2 import PasswordHasher
from argon2.exceptions import HashingError


def main() -> None:
    print("=" * 65)
    print("Flipkart Sheet Filler - Admin Password Hash Generator")
    print("=" * 65)
    print("This utility generates an Argon2id salted hash to set as ADMIN_PASSWORD_HASH.\n")

    try:
        pw1 = getpass.getpass("Enter Admin Password: ")
        if not pw1 or len(pw1) < 8:
            print("Error: Password must be at least 8 characters.", file=sys.stderr)
            sys.exit(1)

        pw2 = getpass.getpass("Confirm Admin Password: ")
        if pw1 != pw2:
            print("Error: Passwords do not match.", file=sys.stderr)
            sys.exit(1)

        ph = PasswordHasher()
        pw_hash = ph.hash(pw1)

        print("\nSuccess! Copy this hash into your .env file or Render environment:\n")
        print(f"ADMIN_PASSWORD_HASH={pw_hash}\n")
        print("=" * 65)

    except (KeyboardInterrupt, EOFError):
        print("\nAborted.")
        sys.exit(1)
    except HashingError as he:
        print(f"Hashing failed: {he}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
