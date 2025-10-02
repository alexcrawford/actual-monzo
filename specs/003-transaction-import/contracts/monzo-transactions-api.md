# Contract: Monzo Transactions API

**Endpoint**: `GET https://api.monzo.com/transactions`

**Purpose**: Retrieve transactions for a Monzo account within a date range

**Authentication**: OAuth 2.0 Bearer token

## Request

### Headers
```
Authorization: Bearer {access_token}
```

### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `account_id` | string | Yes | Monzo account ID (format: `acc_[a-zA-Z0-9]{16,}`) |
| `since` | string | No | Start date (RFC 3339/ISO 8601 timestamp) |
| `before` | string | No | End date (RFC 3339/ISO 8601 timestamp) |
| `limit` | number | No | Max results per page (default: 100, max: 100) |
| `expand[]` | string | No | Expand related resources (use: `expand[]=merchant`) |

### Example Request
```http
GET /transactions?account_id=acc_00009ABC123DEF456&since=2025-09-01T00:00:00Z&before=2025-10-01T23:59:59Z&expand[]=merchant HTTP/1.1
Host: api.monzo.com
Authorization: Bearer {access_token}
```

## Response

### Success Response (200 OK)

**Content-Type**: `application/json`

```json
{
  "transactions": [
    {
      "id": "tx_00009ABC123DEF456",
      "account_id": "acc_00009ABC123DEF456",
      "amount": -750,
      "created": "2025-09-15T14:30:00.000Z",
      "currency": "GBP",
      "description": "Tesco Metro",
      "merchant": {
        "id": "merch_00009XYZ",
        "name": "Tesco",
        "category": "groceries"
      },
      "notes": "",
      "settled": "2025-09-15T14:30:05.000Z",
      "category": "groceries",
      "decline_reason": null
    },
    {
      "id": "tx_00009XYZ789GHI012",
      "account_id": "acc_00009ABC123DEF456",
      "amount": -1250,
      "created": "2025-09-14T19:45:00.000Z",
      "currency": "GBP",
      "description": "Pizza Express",
      "merchant": {
        "id": "merch_00009PQR",
        "name": "Pizza Express",
        "category": "eating_out"
      },
      "notes": "Dinner with friends",
      "settled": "2025-09-14T19:45:03.000Z",
      "category": "eating_out",
      "decline_reason": null
    }
  ]
}
```

### Pagination

When results exceed `limit`, use pagination:

```json
{
  "transactions": [...],
  "pagination": {
    "next_offset": "tx_00009DEF456GHI789"
  }
}
```

Subsequent requests include offset:
```
GET /transactions?account_id=...&since=...&offset=tx_00009DEF456GHI789
```

### Error Responses

#### 401 Unauthorized
```json
{
  "error": "unauthorized",
  "message": "Invalid or expired access token"
}
```

**Meaning**: Access token is invalid or expired
**Client Action**: Prompt user to re-authenticate (re-run setup)

#### 429 Too Many Requests
```json
{
  "error": "too_many_requests",
  "message": "Rate limit exceeded"
}
```

**Meaning**: Rate limit exceeded
**Client Action**: Implement exponential backoff (1s, 2s, 4s), then fail with clear message

#### 500 Internal Server Error
```json
{
  "error": "internal_server_error",
  "message": "An error occurred processing your request"
}
```

**Meaning**: Monzo API temporary issue
**Client Action**: Retry once after 2s delay, then fail with "Monzo API unavailable"

## Transaction Fields Reference

| Field | Type | Description | Notes |
|-------|------|-------------|-------|
| `id` | string | Unique transaction identifier | Immutable, use for duplicate detection |
| `account_id` | string | Monzo account ID | Matches request parameter |
| `amount` | number | Transaction amount in pence | Negative = debit, Positive = credit |
| `created` | string | Transaction creation timestamp | ISO 8601 format |
| `currency` | string | ISO 4217 currency code | Usually "GBP" |
| `description` | string | Transaction description | Fallback if merchant unavailable |
| `merchant` | object/null | Merchant details (if available) | Requires `expand[]=merchant` |
| `merchant.name` | string | Merchant name | Preferred for payee name |
| `merchant.category` | string | Monzo category | e.g., "groceries", "eating_out" |
| `notes` | string | User-added notes | From Monzo app |
| `settled` | string | Settlement timestamp | Empty string if pending |
| `category` | string | Transaction category slug | Monzo's categorization |
| `decline_reason` | string/null | Decline reason (if declined) | null = not declined |

## Client Implementation Requirements

### Filtering

**Declined Transactions**:
```typescript
const validTransactions = transactions.filter(tx => tx.decline_reason === null);
```

**Date Range**:
- Always provide `since` and `before` parameters
- Default: last 30 days if not specified by user
- Format: ISO 8601 with timezone (`.toISOString()`)

### Pagination Handling

```typescript
async function getAllTransactions(accountId: string, since: string, before: string): Promise<MonzoTransaction[]> {
  let allTransactions: MonzoTransaction[] = [];
  let offset: string | undefined;

  do {
    const params = {
      account_id: accountId,
      since,
      before,
      'expand[]': 'merchant',
      limit: 100,
      ...(offset && { offset })
    };

    const response = await api.get('/transactions', { params });
    allTransactions.push(...response.data.transactions);
    offset = response.data.pagination?.next_offset;
  } while (offset);

  return allTransactions;
}
```

### Error Handling

```typescript
try {
  const response = await axios.get(url, config);
  return response.data.transactions;
} catch (error) {
  if (error.response?.status === 401) {
    throw new Error('Access token expired. Please re-run setup command.');
  }
  if (error.response?.status === 429) {
    // Implement exponential backoff
    await sleep(retryDelay);
    return retry();
  }
  if (error.response?.status === 500) {
    // Single retry
    if (retryCount === 0) {
      await sleep(2000);
      return retry();
    }
    throw new Error('Monzo API is currently unavailable. Please try again later.');
  }
  throw error;
}
```

## Validation Requirements

Validate each transaction before import:

```typescript
function validateMonzoTransaction(tx: any): tx is MonzoTransaction {
  return (
    typeof tx.id === 'string' &&
    tx.id.startsWith('tx_') &&
    typeof tx.amount === 'number' &&
    Number.isInteger(tx.amount) &&
    typeof tx.created === 'string' &&
    !isNaN(Date.parse(tx.created)) &&
    tx.decline_reason === null // Not declined
  );
}
```

## Test Coverage Requirements

Contract tests must verify:
1. ✅ Request format (headers, query params, expand parameter)
2. ✅ Successful response parsing (200 OK)
3. ✅ Pagination handling (offset parameter)
4. ✅ Error responses (401, 429, 500)
5. ✅ Declined transaction filtering
6. ✅ Field validation (id format, amount integer, date parsing)
7. ✅ Merchant expansion (name extraction)
