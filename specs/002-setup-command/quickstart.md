# Quickstart: Setup Command

**Feature**: Two-Phase Setup Command (Monzo OAuth + Actual Budget)
**Command**: `actual-monzo setup`
**Purpose**: Interactive configuration of Monzo authentication and Actual Budget connection

## Prerequisites

Before running setup:

1. **Monzo Developer Credentials**
   - Register OAuth client at [Monzo Developer Portal](https://developers.monzo.com/)
   - Obtain Client ID (starts with `oauth2client_`)
   - Obtain Client Secret (starts with `mnzconf` or `mnzpub`)
   - Register redirect URI: `http://localhost:3000/callback` (or ports 3001-3010)

2. **Actual Budget Server**
   - Running Actual Budget server (local or remote)
   - Server URL (e.g., `http://localhost:5006`)
   - Server password

3. **Monzo Mobile App**
   - Monzo app installed on mobile device
   - Access to email for authentication link
   - Ability to approve OAuth access via PIN/biometric

4. **Environment**
   - Node.js 18+ installed
   - Web browser available on same machine
   - Terminal with clickable link support (optional but recommended)

## Scenario 1: First-Time Setup (Happy Path)

**Goal**: Complete setup from scratch with no existing configuration.

**Steps**:

```bash
$ actual-monzo setup
```

**Phase 1: Monzo OAuth**

1. **Enter Client ID**:
   ```
   ? Enter your Monzo OAuth client ID: oauth2client_00009abc123
   ```

2. **Enter Client Secret** (masked):
   ```
   ? Enter your Monzo OAuth client secret: **********************
   ```

3. **OAuth Flow Begins**:
   ```
   ✓ Starting OAuth callback server on port 3000
   Opening browser for Monzo authorization...
   If browser doesn't open, click here: https://auth.monzo.com/?client_id=oauth2client_00009abc123&redirect_uri=http://localhost:3000/callback&response_type=code&state=550e8400-e29b-41d4-a716-446655440000

   Waiting for authorization... (press Ctrl+C to cancel)
   ```

4. **Browser Opens** → Monzo auth page:
   - Enter email address
   - Receive authentication email
   - Click link in email → Opens Monzo mobile app
   - Approve access with PIN/biometric in app
   - Browser redirects to `http://localhost:3000/callback`

5. **Authorization Success**:
   ```
   ✓ Authorization successful!
   ✓ Access token received (expires in 6 hours)
   ✓ Monzo configuration saved
   ```

**Phase 2: Actual Budget**

6. **Enter Server URL**:
   ```
   ? Enter your Actual Budget server URL: http://localhost:5006
   ```

7. **Enter Password** (masked):
   ```
   ? Enter your Actual Budget server password: ************
   ```

8. **Enter Data Directory** (with default):
   ```
   ? Enter budget data directory path: (~/.actual-budget/data) /Users/alex/.actual-budget/data
   ```

9. **Connection Validation**:
   ```
   ⠋ Validating Actual Budget connection...
   ✓ Connection validated successfully!
   ✓ Configuration saved to config.yaml
   ```

10. **Setup Complete**:
    ```
    ✓ Setup completed successfully!

    Configuration saved to: /Users/alex/Projects/actual-monzo/config.yaml

    Next steps:
    - Run `actual-monzo sync` to import Monzo transactions
    - Run `actual-monzo --help` to see all commands

    Note: Your Monzo access token will expire in 6 hours.
          Other commands will automatically refresh the token when needed.
    ```

**Result**: `config.yaml` created:
```yaml
monzo:
  clientId: "oauth2client_00009abc123"
  clientSecret: "mnzconf.xxx..."
  accessToken: "access_token_abc123..."
  refreshToken: "refresh_token_xyz789..."
  tokenExpiresAt: "2025-10-01T18:00:00.000Z"
  authorizedAt: "2025-10-01T12:00:00.000Z"

actualBudget:
  serverUrl: "http://localhost:5006"
  password: "my-budget-password"
  dataDirectory: "/Users/alex/.actual-budget/data"
  validatedAt: "2025-10-01T12:05:00.000Z"

setupCompletedAt: "2025-10-01T12:05:00.000Z"
```

**Exit Code**: `0` (SUCCESS)

---

## Scenario 2: Partial Setup Recovery

**Situation**: Previous setup succeeded for Monzo but failed for Actual Budget.

**Existing Config**:
```yaml
monzo:
  clientId: "oauth2client_00009abc123"
  clientSecret: "mnzconf.xxx..."
  accessToken: "access_token_abc123..."
  refreshToken: "refresh_token_xyz789..."
  tokenExpiresAt: "2025-10-01T18:00:00.000Z"
  authorizedAt: "2025-10-01T12:00:00.000Z"

actualBudget:
  serverUrl: "http://localhost:5006"
  password: "wrong-password"
  dataDirectory: "/Users/alex/.actual-budget/data"
  # No validatedAt - validation failed
```

**Steps**:

```bash
$ actual-monzo setup
```

**Output**:
```
Existing Monzo configuration found.
⠋ Validating existing Monzo tokens...
✓ Monzo tokens still valid (expires at 2025-10-01 18:00:00)

Skipping Monzo OAuth phase.
Proceeding to Actual Budget configuration...

? Enter your Actual Budget server URL: (http://localhost:5006)
? Enter your Actual Budget server password: ************

⠋ Validating Actual Budget connection...
✓ Connection validated successfully!
✓ Configuration saved to config.yaml

✓ Setup completed successfully!
```

**Key Behavior**:
- Detects existing `monzo.accessToken` but missing `actualBudget.validatedAt`
- Validates Monzo tokens via `/ping/whoami` endpoint
- Skips Monzo OAuth phase if tokens valid
- Proceeds directly to Actual Budget configuration
- Pre-fills serverUrl and dataDirectory from partial config

**Exit Code**: `0` (SUCCESS)

---

## Scenario 3: Expired Monzo Tokens During Recovery

**Situation**: Partial config exists, but Monzo tokens expired (>6 hours old).

**Steps**:

```bash
$ actual-monzo setup
```

**Output**:
```
Existing Monzo configuration found.
⠋ Validating existing Monzo tokens...
✗ Monzo tokens expired (expired at 2025-10-01 18:00:00)

Re-authorization required. Starting Monzo OAuth flow...

? Enter your Monzo OAuth client ID: (oauth2client_00009abc123)
? Enter your Monzo OAuth client secret: **********************

✓ Starting OAuth callback server on port 3000
Opening browser for Monzo authorization...
...
```

**Key Behavior**:
- Detects token expiry via `tokenExpiresAt < now`
- Re-runs full Monzo OAuth phase
- Pre-fills clientId and clientSecret from existing config
- Continues to Actual Budget after successful OAuth

---

## Scenario 4: Reconfiguration Menu (Full Config Exists)

**Situation**: Complete configuration exists, user wants to change something.

**Steps**:

```bash
$ actual-monzo setup
```

**Output**:
```
Existing configuration found.

? What would you like to do?
❯ Reconfigure Monzo only
  Reconfigure Actual Budget only
  Reconfigure both
  Exit

[User selects "Reconfigure Actual Budget only"]

Keeping existing Monzo configuration.

? Enter your Actual Budget server URL: (http://localhost:5006) https://budget.example.com
? Enter your Actual Budget server password: ************
? Enter budget data directory path: (/Users/alex/.actual-budget/data)

⠋ Validating Actual Budget connection...
✓ Connection validated successfully!
✓ Configuration saved to config.yaml

✓ Setup completed successfully!
```

**Options Explained**:
- **Reconfigure Monzo only**: Re-run OAuth, keep Actual Budget config
- **Reconfigure Actual Budget only**: Skip OAuth, reconfigure Actual Budget
- **Reconfigure both**: Full setup from scratch
- **Exit**: Cancel without changes

---

## Scenario 5: Port Conflict Error

**Situation**: Port 3000 already in use by another application.

**Steps**:

```bash
$ actual-monzo setup

? Enter your Monzo OAuth client ID: oauth2client_00009abc123
? Enter your Monzo OAuth client secret: **********************

⠋ Starting OAuth callback server on port 3000
✗ Port 3000 is already in use
⠋ Trying port 3001...
✗ Port 3001 is already in use
⠋ Trying port 3002...
✓ OAuth callback server started on port 3002

Opening browser for Monzo authorization...
If browser doesn't open, click here: https://auth.monzo.com/?client_id=oauth2client_00009abc123&redirect_uri=http://localhost:3002/callback&response_type=code&state=...
```

**Key Behavior**:
- Retries ports 3000-3010 sequentially
- Updates redirect URI to match selected port
- Continues setup once available port found

**Error Case** (all ports busy):
```
✗ Port 3000 is already in use
⠋ Trying port 3001...
✗ Port 3001 is already in use
...
✗ Port 3010 is already in use

✗ All ports (3000-3010) are in use

Please free up a port by closing other applications, then retry setup.
Suggestion: Check for running servers with: lsof -i :3000-3010

? What would you like to do?
❯ Retry (check ports again)
  Exit setup
```

**Exit Code**: `1` (ERROR) if user exits, `2` (USER_CANCELLED) if Ctrl+C

---

## Scenario 6: Network Error (Server Unreachable)

**Situation**: Actual Budget server URL incorrect or server not running.

**Steps**:

```bash
? Enter your Actual Budget server URL: http://localhost:9999
? Enter your Actual Budget server password: ************
? Enter budget data directory path: /Users/alex/.actual-budget/data

⠋ Validating Actual Budget connection...
✗ Connection failed

✗ Cannot reach Actual Budget server at http://localhost:9999
  Check server is running and URL is correct.

Suggestions:
- Verify server is running: docker ps, systemctl status actual-budget
- Check firewall/network settings
- Confirm port number (default is 5006)

? What would you like to do?
❯ Retry with same credentials
  Change server URL
  Exit setup

[User selects "Change server URL"]

? Enter your Actual Budget server URL: http://localhost:5006
? Enter your Actual Budget server password: (previous password kept) ************

⠋ Validating Actual Budget connection...
✓ Connection validated successfully!
```

**Key Behavior**:
- Displays specific network error message
- Provides actionable suggestions
- Offers recovery options with credential preservation
- Pre-fills previous values when retrying

---

## Scenario 7: Invalid Actual Budget Password

**Situation**: Server reachable but password incorrect.

**Steps**:

```bash
? Enter your Actual Budget server URL: http://localhost:5006
? Enter your Actual Budget server password: wrong-password

⠋ Validating Actual Budget connection...
✗ Connection failed

✗ Invalid password for Actual Budget server
  Please check your server password.

? What would you like to do?
❯ Re-enter password
  Change all credentials
  Exit setup

[User selects "Re-enter password"]

? Enter your Actual Budget server password: ************

⠋ Validating Actual Budget connection...
✓ Connection validated successfully!
```

**Key Behavior**:
- Preserves serverUrl and dataDirectory
- Only re-prompts for password
- Distinguishes auth error from network error

---

## Scenario 8: Data Directory Permission Error

**Situation**: Data directory path not writable.

**Steps**:

```bash
? Enter budget data directory path: /root/.actual-budget/data

⠋ Validating Actual Budget connection...
✗ Connection failed

✗ Cannot write to directory /root/.actual-budget/data
  Check path and permissions.

Suggestions:
- Choose different directory with write access
- Create directory manually: mkdir -p /root/.actual-budget/data
- Fix permissions: chmod 755 /root/.actual-budget/data
- Check disk space availability

? What would you like to do?
❯ Choose different directory
  Fix permissions and retry
  Exit setup

[User selects "Choose different directory"]

? Enter budget data directory path: /Users/alex/.actual-budget/data

⠋ Validating Actual Budget connection...
✓ Connection validated successfully!
```

**Key Behavior**:
- Preserves serverUrl and password
- Only re-prompts for dataDirectory
- Provides specific filesystem error guidance

---

## Scenario 9: User Denies Monzo Authorization

**Situation**: User opens Monzo app but denies access request.

**Steps**:

```bash
✓ Starting OAuth callback server on port 3000
Opening browser for Monzo authorization...

Waiting for authorization... (press Ctrl+C to cancel)

[User denies in Monzo app, browser redirects with error]

✗ Authorization denied

✗ Authorization denied by user
  Please approve access in the Monzo app to continue.

? What would you like to do?
❯ Retry OAuth flow
  Change client credentials
  Exit setup

[User selects "Retry OAuth flow"]

✓ Starting OAuth callback server on port 3000
Opening browser for Monzo authorization...
```

**Key Behavior**:
- Detects `error=access_denied` in callback URL
- Explains denial came from Monzo app
- Allows retry without re-entering credentials

---

## Scenario 10: Browser Launch Failure (Headless System)

**Situation**: No default browser configured or headless environment.

**Steps**:

```bash
✓ Starting OAuth callback server on port 3000
Opening browser for Monzo authorization...
✗ Could not open browser automatically

Please open this URL in your browser:
https://auth.monzo.com/?client_id=oauth2client_00009abc123&redirect_uri=http://localhost:3000/callback&response_type=code&state=550e8400-e29b-41d4-a716-446655440000

Waiting for authorization... (press Ctrl+C to cancel)
```

**Key Behavior**:
- Displays clickable URL for manual opening
- Continues waiting for callback
- Works on headless systems via copy-paste to browser on different machine

---

## Scenario 11: User Cancels Setup (Ctrl+C)

**Situation**: User presses Ctrl+C during OAuth wait.

**Steps**:

```bash
✓ Starting OAuth callback server on port 3000
Opening browser for Monzo authorization...

Waiting for authorization... (press Ctrl+C to cancel)

^C
✗ Setup cancelled by user

OAuth callback server stopped.
No changes were made to configuration.
```

**Exit Code**: `2` (USER_CANCELLED)

---

## Common Error Messages

### Monzo OAuth Errors

| Error | Cause | Message | Recovery |
|-------|-------|---------|----------|
| Invalid Client | Wrong client_id/secret | "Invalid client credentials. Check client ID and secret." | Re-enter credentials |
| Access Denied | User denied in app | "Authorization denied. Please approve access in Monzo app." | Retry OAuth |
| Invalid Grant | Code expired (>10 min) | "Authorization code expired. Please retry setup." | Restart OAuth flow |
| Port Conflict | All ports 3000-3010 busy | "All ports (3000-3010) are in use" | Close apps, retry |

### Actual Budget Errors

| Error | Cause | Message | Recovery |
|-------|-------|---------|----------|
| Network Error | Server unreachable | "Cannot reach server at {URL}" | Check server, change URL |
| Auth Error | Invalid password | "Invalid password for Actual Budget server" | Re-enter password |
| IO Error | Directory not writable | "Cannot write to directory {path}" | Choose new directory, fix permissions |

---

## Configuration File Reference

**Location**: Project root `/path/to/project/config.yaml`

**Complete Config**:
```yaml
monzo:
  clientId: "oauth2client_00009abc123"
  clientSecret: "mnzconf.secret123"
  accessToken: "access_token_abc123..."
  refreshToken: "refresh_token_xyz789..."
  tokenExpiresAt: "2025-10-01T18:00:00.000Z"
  authorizedAt: "2025-10-01T12:00:00.000Z"

actualBudget:
  serverUrl: "http://localhost:5006"
  password: "my-budget-password"
  dataDirectory: "/Users/alex/.actual-budget/data"
  validatedAt: "2025-10-01T12:05:00.000Z"

setupCompletedAt: "2025-10-01T12:05:00.000Z"
```

**Partial Config** (Monzo only):
```yaml
monzo:
  clientId: "oauth2client_00009abc123"
  clientSecret: "mnzconf.secret123"
  accessToken: "access_token_abc123..."
  refreshToken: "refresh_token_xyz789..."
  tokenExpiresAt: "2025-10-01T18:00:00.000Z"
  authorizedAt: "2025-10-01T12:00:00.000Z"

actualBudget:
  serverUrl: "http://localhost:5006"
  password: "incorrect-password"
  dataDirectory: "/Users/alex/.actual-budget/data"
  # No validatedAt - indicates failure

# No setupCompletedAt - indicates partial setup
```

---

## Security Best Practices

### Protect Configuration File

**File Permissions**:
```bash
# Recommended: Restrict config file to current user only
chmod 600 config.yaml

# Verify permissions
ls -la config.yaml
# Should show: -rw------- (owner read/write only)
```

**Version Control**:
```bash
# Add to .gitignore to prevent accidental commits
echo "config.yaml" >> .gitignore

# Verify config.yaml is ignored
git status
# config.yaml should NOT appear in untracked files
```

**CRITICAL**: Never commit `config.yaml` to version control. It contains:
- Monzo OAuth client secret
- Monzo access and refresh tokens
- Actual Budget server password

**Backup Strategy**:
- Store backup config in encrypted location (not in git)
- Use password manager or encrypted volume for backup
- Regularly rotate Actual Budget password

---

## Troubleshooting

### "State parameter mismatch"

**Cause**: CSRF token validation failed (rare).

**Solution**: Retry OAuth flow. If persists, check for browser extensions modifying URLs.

---

### "Monzo tokens valid but cannot access API"

**Cause**: Tokens revoked in Monzo app settings or 90-day limit reached.

**Solution**: Run `actual-monzo setup` and select "Reconfigure Monzo only".

---

### "Data directory grows too large"

**Cause**: Budget data cache accumulating.

**Solution**: Periodically clean dataDirectory, or use separate directory per budget.

---

## Next Steps After Setup

1. **Test Configuration**:
   ```bash
   actual-monzo validate-config
   ```

2. **Sync Transactions** (future command):
   ```bash
   actual-monzo sync
   ```

3. **View Help**:
   ```bash
   actual-monzo --help
   ```

---

## Exit Codes Reference

| Code | Meaning | Scenario |
|------|---------|----------|
| 0 | SUCCESS | Setup completed successfully |
| 1 | ERROR | Network error, validation failure, port conflict |
| 2 | USER_CANCELLED | User pressed Ctrl+C or selected "Exit" |
| 3 | CONFIGURATION_ERROR | Invalid existing config file |

---

*Based on specification in `/specs/002-setup-command/spec.md`*
