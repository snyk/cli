# MonitorError 422 → SNYK-9999 Bug

## Summary

When the `/monitor-dependencies` API endpoint returns a **422 Unprocessable Entity** error, it gets transformed into **SNYK-9999** with status **500** before being displayed to the user.

## The Bug

**Location:** `src/lib/errors/monitor-error.ts` line 14

```typescript
constructor(errorCode, message) {
  this.code = errorCode;  // Stores 422 correctly
  this.userMessage = message;
  this.errorCatalog = new Snyk.ServerError('');  // ❌ Always SNYK-9999 (status 500)!
}
```

## Test Results

Run: `npx jest test/jest/unit/lib/errors/monitor-error-422-bug-final.spec.ts`

```
🐛 BUG DEMONSTRATED:
   Registry returned: HTTP 422
   MonitorError.code: 422 ✅
   errorCatalog.metadata.status: 500 ❌ (should be 422)
   errorCatalog.metadata.errorCode: SNYK-9999 ❌ (should be specific)

🐛 All different HTTP codes map to SNYK-9999:
   HTTP 400 → SNYK-9999 (status: 500) ❌
   HTTP 404 → SNYK-9999 (status: 500) ❌
   HTTP 422 → SNYK-9999 (status: 500) ❌
   HTTP 429 → SNYK-9999 (status: 500) ❌

📤 What CLIv2 receives:
{
  "errors": [{
    "status": "500",
    "code": "SNYK-9999",
    "title": "Unable to process request",
    "detail": "Invalid scan result data"
  }]
}
```

## Impact

- **User Experience:** Users see a generic "server error" (SNYK-9999) instead of understanding their request was invalid (422)
- **Debugging:** Makes it harder to diagnose what went wrong
- **Error Handling:** Different 4xx errors (400, 404, 422, 429) all appear the same to users

## Root Cause

1. `MonitorError` unconditionally creates `Snyk.ServerError` (which is for 5xx errors)
2. `src/cli/ipc.ts` line 42-44 replaces the `MonitorError` with its `errorCatalog`
3. The original HTTP status code (422) is lost in this transformation

## Affected Flow

```
Registry → 422
  ↓
makeRequest → rejects with { code: 422 }
  ↓
monitorDependencies → catches error
  ↓
new MonitorError(422, msg)
  ├─ this.code = 422  ✅ Preserved here
  └─ this.errorCatalog = Snyk.ServerError  ❌ Always SNYK-9999/500
      ↓
IPC layer (ipc.ts:42-44)
  ↓
err = err.errorCatalog  ❌ Replaces error, loses 422
  ↓
CLIv2 receives: SNYK-9999 (status 500)
```

## Files Involved

- `src/lib/errors/monitor-error.ts` - Creates the bug
- `src/lib/ecosystems/monitor.ts` - Throws MonitorError
- `src/cli/ipc.ts` - Replaces error with errorCatalog
- `src/lib/request/promise.ts` - Initial error rejection

## Tests

- **Unit Test:** `test/jest/unit/lib/errors/monitor-error-422-bug-final.spec.ts` (✅ PASSES - proves bug exists)
- **Integration Test:** `test/jest/acceptance/snyk-container/monitor-422-error.spec.ts` (documents behavior)

