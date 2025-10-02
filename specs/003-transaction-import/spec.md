# Feature Specification: Transaction Import

**Feature Branch**: `003-transaction-import`
**Created**: 2025-10-01
**Status**: Draft
**Input**: User description: "transaction import"

## Execution Flow (main)
```
1. Parse user description from Input
   → If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   → Identified: users, import transactions, Monzo API, Actual Budget
3. For each unclear aspect:
   → Marked with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   → User flow: fetch transactions from Monzo, import to Actual Budget
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

### Session 2025-10-01
- Q: When a user runs the import command without specifying dates, what should the default date range be? → A: Last 30 days from today
- Q: How should the Monzo-to-Actual Budget account mapping be configured? → A: During initial setup (setup command prompts for account pairs)
- Q: How should pending (unsettled) transactions be handled during import? → A: Import immediately (treat same as settled transactions)
- Q: Should declined transactions be imported or filtered out? → A: Filter out (exclude declined transactions entirely)
- Q: When one account import fails but others succeed, how should the system respond? → A: Continue with successful accounts, report failures at end

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
A user who has already configured their Monzo account connection wants to retrieve their recent transactions from Monzo and add them to their Actual Budget. They need a simple command to fetch transactions for a specific date range and import them into the correct Actual Budget account, avoiding duplicates if the command is run multiple times.

### Acceptance Scenarios
1. **Given** a user has completed setup with valid Monzo credentials and Actual Budget connection, **When** they run the import command for a specific date range, **Then** all transactions from their Monzo account(s) within that range are imported to the corresponding Actual Budget account(s)

2. **Given** transactions already exist in Actual Budget from a previous import, **When** the user runs the import command again with an overlapping date range, **Then** duplicate transactions are not created

3. **Given** a user has multiple Monzo accounts (e.g., current account and joint account), **When** they run the import command, **Then** transactions from all configured accounts are imported to their respective Actual Budget accounts

4. **Given** a user's access token has expired, **When** they attempt to import transactions, **Then** the system prompts them to re-authenticate or provides clear guidance on refreshing their token

5. **Given** a user runs the import without specifying a date range, **When** the command executes, **Then** transactions from the last 30 days are imported

6. **Given** a user has configured account mappings during setup, **When** they run the import command, **Then** transactions are routed to the correct Actual Budget accounts according to the configured mappings

7. **Given** a Monzo account has both pending and settled transactions, **When** the import runs, **Then** both pending and settled transactions are imported without differentiation

8. **Given** a Monzo account has declined transactions within the date range, **When** the import runs, **Then** declined transactions are excluded from the import

9. **Given** a user has multiple accounts and one account fails during import, **When** the import completes, **Then** successful accounts have their transactions imported and failures are reported at the end

### Edge Cases
- What happens when Monzo API is unavailable or returns errors?
- How does system handle transactions with no matching Actual Budget account?
- What if transaction amounts or descriptions contain unusual characters or formats?
- What happens when network connection is lost mid-import?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST retrieve transactions from all configured Monzo accounts for a user-specified date range
- **FR-001a**: System MUST default to the last 30 days from today when no date range is specified
- **FR-002**: System MUST map each Monzo account to its corresponding Actual Budget account using mappings configured during the setup command
- **FR-002a**: Setup command MUST prompt users to create account mappings between each Monzo account and an Actual Budget account
- **FR-002b**: System MUST persist account mappings in configuration for use during import
- **FR-003**: System MUST detect and skip duplicate transactions when importing to avoid creating duplicates in Actual Budget
- **FR-004**: System MUST preserve transaction details including date, amount, merchant/description, and category [NEEDS CLARIFICATION: should Monzo categories map to Actual Budget categories automatically?]
- **FR-005**: System MUST handle authentication token expiry gracefully and provide clear user guidance
- **FR-006**: System MUST validate that required configuration exists before attempting import
- **FR-007**: System MUST provide progress indication during import [NEEDS CLARIFICATION: is batch size or performance target specified?]
- **FR-008**: System MUST report import results including successful imports, skipped duplicates, and any errors
- **FR-009**: Users MUST be able to specify start and end dates for the import range
- **FR-010**: System MUST continue importing from successful accounts when one account fails, and report all failures at completion
- **FR-011**: System MUST process transaction amounts correctly, preserving sign (debits vs credits) and currency [NEEDS CLARIFICATION: how are multi-currency transactions handled?]
- **FR-012**: System MUST import both pending and settled transactions, treating them identically
- **FR-013**: System MUST exclude declined transactions from import

### Key Entities *(include if feature involves data)*
- **Transaction**: A financial transaction from Monzo with attributes including date, amount, description/merchant, category, status (pending/settled/declined), and account identifier; both pending and settled transactions are imported, declined transactions are excluded
- **Account Mapping**: Association between a Monzo account and an Actual Budget account, configured during setup and persisted in configuration, enabling transactions to be imported to the correct destination
- **Import Session**: A single execution of the import command, tracking the date range, accounts processed, transactions imported, and any errors encountered; continues processing all accounts even when individual account failures occur
- **Date Range**: The time period for which transactions should be fetched, with start and end boundaries; defaults to last 30 days when not specified

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [ ] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
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
- [ ] Review checklist passed (pending clarifications)

---
