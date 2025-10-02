<!--
Sync Impact Report:
- Version change: Initial → 1.0.0
- Modified principles: All principles created (initial constitution)
- Added sections: Core Principles, API Integration Standards, Development Workflow, Governance
- Removed sections: None
- Templates requiring updates:
  ✅ plan-template.md - Constitution Check references aligned
  ✅ spec-template.md - Requirements alignment verified
  ✅ tasks-template.md - Task categorization aligned
- Follow-up TODOs: None
-->

# Actual-Monzo Constitution

## Core Principles

### I. API-First Integration
All financial data integrations must be built around official APIs with proper authentication flows. Never bypass or scrape banking interfaces. All OAuth flows must be secure and user-controlled. Credential storage must follow platform security best practices.

*Rationale: Financial data requires maximum security and reliability - official APIs provide audit trails, proper authentication, and compliance with banking regulations.*

### II. CLI-First Interface
Every feature must be accessible via command-line interface with both interactive and non-interactive modes. Commands must follow Unix conventions: single responsibility, composable flags, predictable exit codes. Support both JSON output for scripting and human-readable formats for interactive use.

*Rationale: CLI tools provide automation capabilities and scriptable workflows essential for financial data management.*

### III. Configuration Management
All user credentials, API keys, and preferences must be stored using secure configuration libraries. Support multiple environments (dev/prod). Never hardcode secrets. Provide clear setup workflows for first-time users.

*Rationale: Financial applications require secure credential management and easy environment switching for testing.*

### IV. Data Validation & Transformation
All financial data must be validated at ingestion and transformed consistently between systems. Transaction amounts, dates, and metadata must be preserved accurately. Provide data mapping for different account types and transaction categories.

*Rationale: Financial accuracy is non-negotiable - any data corruption could have serious consequences for budgeting and accounting.*

### V. Error Handling & Recovery
Robust error handling for API failures, network issues, and authentication problems. Provide clear error messages with suggested remediation steps. Support retry mechanisms for transient failures. Never leave operations in partially completed states.

*Rationale: Financial integrations involve multiple external systems that can fail - users need clear guidance to resolve issues.*

## API Integration Standards

All API integrations must implement:
- OAuth 2.0 flows with secure token storage
- Rate limiting and respectful API usage
- Comprehensive error handling for HTTP status codes
- Request/response logging for debugging (without sensitive data)
- Data validation for all API responses
- Graceful degradation when APIs are unavailable

## Development Workflow

**Test-Driven Development**: All API integrations and data transformations must have tests written before implementation. Mock external API calls in tests.

**Type Safety**: Use TypeScript strict mode for all code. Define interfaces for all API responses and data models.

**Documentation**: Maintain README with setup instructions, configuration examples, and troubleshooting guide. Document all CLI commands and their options.

**Security Review**: All credential handling and API integration code must be reviewed for security vulnerabilities before release.

## Governance

This constitution supersedes all other development practices. All pull requests must verify compliance with these principles. Any complexity that violates these principles must be explicitly justified with business requirements.

**Amendment Process**: Constitution changes require documentation of impact, approval from project maintainer, and migration plan for existing users.

**Compliance Review**: All features must pass security and API integration reviews before release.

**Version**: 1.0.0 | **Ratified**: 2025-09-29 | **Last Amended**: 2025-09-29