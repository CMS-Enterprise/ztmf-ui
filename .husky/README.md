# Git Hooks

This directory contains Git hooks managed by [Husky](https://typicode.github.io/husky/).

## Pre-Push Hook

Before every `git push`, the following checks run automatically:

1. **TypeScript Type Checking** (`yarn typecheck`)

   - Validates all TypeScript code compiles without errors
   - Catches type errors before CI/CD
   - Uses `tsconfig.json` configuration

2. **Auto-fix Code Style** (`yarn fix`)

   - Runs Prettier to format all code
   - Runs ESLint with `--fix` to auto-fix lint issues
   - Ensures consistent code style

3. **Lint Verification** (`yarn lint`)
   - Verifies JavaScript/TypeScript code (ESLint)
   - Verifies JSON/Markdown/YAML formatting (Prettier)
   - Fails push if unfixable issues remain

## Why This Matters

The pre-push hook prevents common CI/CD failures:

- ❌ TypeScript compilation errors
- ❌ Lint violations
- ❌ Code formatting inconsistencies

This saves time by catching issues locally before they reach the remote repository.

## Bypassing Hooks (Not Recommended)

In emergency situations only:

```bash
git push --no-verify
```

**Warning**: Bypassing hooks may cause CI/CD failures and should only be used when necessary.

## Troubleshooting

### Hook not running

```bash
# Reinstall hooks
yarn prepare
```

### Hook permission denied

```bash
chmod +x .husky/pre-push
```

### TypeScript errors

```bash
# Check errors manually
yarn typecheck
```
