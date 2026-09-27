# Credential handling

This repository starts from a sanitized working-tree snapshot. Previous development history is not included. Only placeholder environment examples belong in Git; real configuration belongs in ignored local env files or hosting-provider secrets.

Removing history does not revoke credentials exposed elsewhere. Any previously leaked keys must be revoked or rotated at their providers, including keys in an older repository's history.

Before contributing, inspect `git diff --cached`, run a secret scanner, and keep `.env`, private keys, service-account files, and authentication tokens out of commits. Public Supabase and Maps values are supplied through environment variables rather than hardcoded here.

Do not put credential values into public issues. If you discover an exposure, report the affected file and credential type without reproducing the secret.
