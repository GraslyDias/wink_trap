# API URL Update Summary

## Changes Made

1. **API Base URL Update**
   - Changed the API base URL in `app/utils/api.js` to always use `https://akf.digital/wink_trap/api`
   - Added fallback to environment variable `NEXT_PUBLIC_API_URL` for flexibility

2. **WebSocket Host Update**
   - Updated WebSocket configuration in `app/utils/websocketService.js` 
   - Changed host from `window.location.host` to `akf.digital` for consistent connections

3. **Next.js Environment Configuration**
   - Updated `next.config.mjs` to include API and WebSocket environment variables
   - Added CORS headers configuration to support cross-origin WebSocket connections

4. **Environment Setup Documentation**
   - Created `ENV_SETUP.md` with instructions for local environment configuration
   - Included examples for both development and production environments

## Testing Your Changes

After making these changes:

1. Rebuild your Next.js application:
   ```
   npm run build
   npm run start
   ```

2. Verify API calls are working by checking the browser console
   - All API requests should go to `https://akf.digital/wink_trap/api`
   - WebSocket connections should go to `akf.digital:8080`

3. Test relationship status update functionality specifically
   - This uses the fixed API endpoints and should now work correctly

## Troubleshooting

If you encounter any issues:

1. Check the browser console for any connection errors
2. Verify that the WebSocket server is running at `akf.digital:8080`
3. Make sure your API server at `https://akf.digital/wink_trap/api` has CORS properly configured
4. Try manually setting the environment variables in `.env.local` as described in `ENV_SETUP.md` 