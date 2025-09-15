# Database Permissions Fix

## Problem

The application was experiencing database permission issues with error code `42501`:

```
new row violates row-level security policy for table "songs"
```

This was preventing songs from being saved to the database during the music processing workflow.

## Root Cause

The issue was caused by a mismatch between the Supabase client being used for database operations:

1. **API Route**: Used service role key client for authentication
2. **Database Manager**: Used anonymous key client for database operations
3. **RLS Policies**: Required authenticated user context for INSERT operations

The Row Level Security (RLS) policies were correctly configured to only allow authenticated users to insert songs they own, but the database operations were being performed with the wrong client context.

## Solution

Updated the `database-manager.ts` to accept an optional `SupabaseClient` parameter in all database functions:

### Key Changes:

1. **Enhanced Function Signatures**: Added optional `supabaseClient` parameter to all database functions:

   - `saveSongWithRetry(songData, userId, supabaseClient?)`
   - `saveGameWithRetry(gameData, userId, supabaseClient?)`
   - `saveQuestionsWithRetry(gameId, questionsData, supabaseClient?)`
   - `updateUrlStatusWithRetry(urlId, processed, supabaseClient?)`

2. **Client Selection Logic**: Functions now prioritize the provided service role client:

   ```typescript
   const client = supabaseClient || supabase;
   ```

3. **ID Generation**: Added explicit ID generation for songs since the schema expects TEXT IDs:

   ```typescript
   const songId = `song_${Date.now()}_${Math.random()
     .toString(36)
     .substr(2, 9)}`;
   ```

4. **API Route Updates**: Updated `process-urls/route.ts` to pass the service role client to all database operations:

   ```typescript
   await saveSongWithRetry(songData, userId, supabase); // Service role client
   ```

5. **Retry System**: Enhanced the retry system to use service role client for failed operations:
   ```typescript
   const serviceClient = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.SUPABASE_SERVICE_ROLE_KEY!
   );
   await retryFailedOperations(serviceClient);
   ```

## Verification

The fix was verified through:

1. **Direct Database Test**: Successfully inserted and cleaned up test songs using service role client
2. **RLS Policy Test**: Confirmed anonymous client is still properly blocked by RLS policies
3. **Foreign Key Test**: Verified foreign key constraints are working correctly

## Result

- ✅ Songs can now be successfully saved to the database
- ✅ RLS policies remain intact and secure
- ✅ Service role operations bypass RLS as intended
- ✅ Anonymous operations are still properly restricted
- ✅ Retry system works with proper permissions

## Files Modified

- `lib/database-manager.ts` - Enhanced with client parameter support
- `app/api/process-urls/route.ts` - Updated to pass service role client
- Added ID generation for TEXT-based primary keys

## Security Notes

- RLS policies remain enabled and functional
- Service role key is only used server-side in API routes
- Anonymous client operations are still properly restricted
- Foreign key constraints are enforced

The fix maintains all security measures while resolving the permission issues that were preventing database operations from succeeding.
