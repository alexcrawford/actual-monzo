# actual-monzo Development Guidelines

Last updated: 2025-10-01

## Active Technologies
- TypeScript 5.2+ with Node.js 18+
- Commander.js for CLI framework
- Inquirer.js for interactive prompts
- Chalk for terminal styling
- Ora for spinners
- js-yaml for config file handling
- Zod for schema validation
- @actual-app/api for Actual Budget integration
- Axios for HTTP requests (Monzo API)
- YAML config file in project root (`config.yaml`)

## Project Structure
```
src/
  commands/       # CLI commands (setup, import)
  services/       # Business logic (OAuth, API clients)
  types/          # TypeScript type definitions
  utils/          # Utilities (config, OAuth server, browser)
tests/
  contract/       # Contract tests
  integration/    # Integration tests
  unit/           # Unit tests
```

## Commands
- `pnpm test` - Run all tests
- `pnpm build` - Build the project
- `pnpm lint` - Run ESLint
- `node dist/index.js setup` - Run setup command

## Code Style
TypeScript strict mode with ESLint rules enforced

<!-- MANUAL ADDITIONS START -->
## Git Commits
- This project does NOT use ClickUp task IDs
- Do NOT use the git-committer agent
- Use standard git commit messages following conventional commits format
<!-- MANUAL ADDITIONS END -->
