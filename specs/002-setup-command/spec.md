# Feature Specification: Setup Command

**Feature Branch**: `002-setup-command`
**Created**: 2025-09-29
**Status**: Draft
**Input**: User description: "setup command for monzo and actual budget configuration"

## Execution Flow (main)
```
1. Parse user description from Input
   → If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   → Identify: actors, actions, data, constraints
3. For each unclear aspect:
   → Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   → If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   → Each requirement must be testable
   → Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   → If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   → If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## Clarifications

### Session 2025-09-29
- Q: Should the redirect URI be fixed, configurable by user, or multiple predefined options? → A: Configurable by user (defaults to localhost:port)
- Q: How should sensitive tokens be stored locally? → A: Plain text file (env/json/yaml)
- Q: When token refresh fails, what should happen to the user's session? → A: Fail gracefully with clear error message
- Q: When should client credentials be validated? → A: Immediately when entered (before OAuth)
- Q: What should happen if user doesn't return to CLI within reasonable time for OAuth callback? → A: Timeout and require restart

### Session 2025-10-01 (Spec Review)
- Q: How should client credentials be validated before OAuth? → A: No validation - let OAuth flow fail if invalid
- Q: Custom redirect URI (Cloudflare Tunnel) - user manages tunnel or tool manages it? → A: Out of scope - localhost only
- Q: Should setup command handle token refresh or API commands? → A: Other commands handle refresh when making API calls
- Q: How long to wait for OAuth callback? → A: No timeout - wait indefinitely

### Session 2025-10-01 (Actual Budget Addition)
- Q: What Actual Budget connection info to collect? → A: Server URL, password, data directory
- Q: Sequential phases or collect all upfront? → A: Sequential - Monzo OAuth first, then Actual Budget config
- Q: Validate Actual Budget connection during setup? → A: Yes - test connection and report success/failure

### Session 2025-10-01 (Spec Review Resolution)
- Q: Token storage security level? → A: Plain text acceptable (read-only transaction access)
- Q: Config file location and format? → A: Project root, YAML format preferred
- Q: Port conflict handling? → A: Server will error on bind - display error with actionable guidance
- Q: When does callback server start? → A: After user inputs credentials, display clickable link, start listening immediately
- Q: Partial setup (Monzo succeeds, Actual Budget fails)? → A: Save Monzo config, next run validates existing Monzo via /me endpoint, proceeds to Actual Budget
- Q: Error recovery UX? → A: Provide actionable information and present recovery actions (retry, change credentials, etc.)

## User Scenarios & Testing *(mandatory)*

### Primary User Story
A user running the CLI tool on their local machine wants to connect their Monzo bank account to their Actual Budget instance for automated financial management. The setup command guides them through two sequential phases: (1) configuring Monzo OAuth credentials and completing authentication (which includes mobile app approval), then (2) configuring their Actual Budget server connection (URL, password, data directory). The system validates both connections and stores configuration for future use. The tool assumes it runs on the same machine where the user can open a web browser for the OAuth redirect flow.

### Acceptance Scenarios

**Monzo Configuration:**
1. **Given** a user has created a Monzo developer client, **When** they run the setup command, **Then** system collects their client credentials and guides them through OAuth authorization
2. **Given** a user completes OAuth authorization in their Monzo app, **When** they return to the CLI, **Then** system exchanges the authorization code for access tokens and proceeds to Actual Budget configuration
3. **Given** invalid Monzo credentials, **When** user attempts OAuth flow, **Then** OAuth fails and system provides clear error messages

**Actual Budget Configuration:**
4. **Given** Monzo authentication succeeds, **When** setup proceeds to Actual Budget phase, **Then** system collects server URL, password, and data directory
5. **Given** user provides Actual Budget credentials, **When** system validates connection, **Then** successful connection proceeds to save configuration
6. **Given** invalid Actual Budget credentials, **When** system tests connection, **Then** validation fails with clear error message and allows retry

**Re-configuration:**
7. **Given** a user has existing configuration, **When** they run setup again, **Then** system allows updating either Monzo or Actual Budget settings independently

### Edge Cases

**Monzo-specific:**
- What happens when OAuth authorization expires or is revoked? (User must run setup again)
- How does system handle network failures during token exchange? (Display error, allow retry)
- What happens if user cancels authorization in Monzo app? (OAuth returns error, setup fails gracefully)
- User can cancel waiting for OAuth callback with Ctrl+C at any time

**Actual Budget-specific:**
- What happens when Actual Budget server is unreachable? (Connection validation fails, display error, allow retry)
- What happens with incorrect password? (Validation fails with authentication error)
- What happens if data directory path doesn't exist? (Create directory or prompt user to create)
- What happens if data directory is not writable? (Display permissions error, request valid path)

## Requirements *(mandatory)*

### Functional Requirements

**Monzo Configuration (Phase 1):**
- **FR-001**: System MUST collect Monzo client ID and client secret from user during setup
- **FR-002**: System MUST initiate OAuth 2.0 authorization flow with Monzo using localhost redirect
- **FR-003**: System MUST open user's default web browser to Monzo authorization URL
- **FR-004**: System MUST handle OAuth callback via temporary local server and exchange authorization code for access tokens
- **FR-005**: System MUST store Monzo access tokens and refresh tokens in YAML configuration file in project root
- **FR-006**: System MUST collect client credentials and proceed to OAuth flow without pre-validation (invalid credentials will fail during OAuth)
- **FR-007**: System MUST provide clear instructions for creating Monzo developer client and configuring redirect URI
- **FR-008**: System MUST use localhost redirect URI only (http://localhost:PORT format)
- **FR-009**: System MUST start temporary callback server after collecting credentials, display clickable authorization link, and immediately begin listening for OAuth redirect
- **FR-010**: System MUST wait indefinitely for OAuth callback (user can cancel with Ctrl+C)
- **FR-010a**: System MUST store refresh tokens for use by other commands (token refresh will be handled by future API commands such as sync - NOT by setup command)
- **FR-010b**: System MUST handle port binding failures by displaying actionable error message with guidance

**Note on Token Refresh**: The setup command stores access_token, refresh_token, and tokenExpiresAt but does NOT implement token refresh logic. Token refresh will be implemented in future commands (e.g., sync command) that make Monzo API calls. When those commands detect expired tokens, they will use the refresh_token to obtain new access tokens automatically.

**Actual Budget Configuration (Phase 2):**
- **FR-011**: System MUST collect Actual Budget server URL from user after successful Monzo authentication
- **FR-012**: System MUST collect Actual Budget server password from user with secure input handling
- **FR-013**: System MUST collect data directory path for local budget data cache
- **FR-014**: System MUST validate Actual Budget connection succeeds with provided credentials
- **FR-015**: System MUST store Actual Budget configuration (server URL, password, data directory) in YAML configuration file in project root
- **FR-016**: System MUST provide clear success/failure feedback for Actual Budget connection validation
- **FR-017**: System MUST allow retry if Actual Budget connection validation fails
- **FR-018**: System MUST validate data directory exists or can be created with write permissions

**General:**
- **FR-019**: System MUST allow users to reconfigure either Monzo or Actual Budget settings independently
- **FR-020**: System MUST run on local machine where user has browser access (not remote/headless environments)
- **FR-021**: System MUST save partial configuration when Monzo phase succeeds but Actual Budget phase fails
- **FR-022**: System MUST validate existing Monzo configuration on subsequent runs by testing API connectivity before proceeding to Actual Budget configuration
- **FR-023**: System MUST provide actionable error messages and recovery actions (retry, change credentials, etc.) for all failure scenarios

### Key Entities *(include if feature involves data)*
- **Monzo Configuration**: Stores Monzo client credentials (client ID, client secret) and OAuth tokens (access token, refresh token)
- **Actual Budget Configuration**: Stores Actual Budget server connection details (server URL, password, data directory path)
- **OAuth Session**: Represents the authorization flow state with authorization codes and tokens
- **Setup Session**: Represents the complete two-phase setup process (Monzo authentication → Actual Budget configuration)

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [ ] No implementation details (languages, frameworks, APIs)
- [ ] Focused on user value and business needs
- [ ] Written for non-technical stakeholders
- [ ] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [ ] Requirements are testable and unambiguous
- [ ] Success criteria are measurable
- [ ] Scope is clearly bounded
- [ ] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [ ] Review checklist passed

---