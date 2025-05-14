# Environment Setup for Wink Trap

To properly configure the API and WebSocket connections, create a `.env.local` file in the root of your project with the following content:

```
# API and WebSocket Configuration
NEXT_PUBLIC_API_URL=https://akf.digital/wink_trap/api
NEXT_PUBLIC_WS_HOST=akf.digital:8080
```

## Configuration Details

- `NEXT_PUBLIC_API_URL`: The base URL for all API requests.
- `NEXT_PUBLIC_WS_HOST`: The host and port where the WebSocket server is running.

## Development vs Production

For local development, you might want to use:

```
NEXT_PUBLIC_API_URL=https://akf.digital/wink_trap/api
NEXT_PUBLIC_WS_HOST=localhost:8080
```

For production, use:

```
NEXT_PUBLIC_API_URL=https://akf.digital/wink_trap/api
NEXT_PUBLIC_WS_HOST=akf.digital:8080
```

Make sure your WebSocket server is properly configured and running on the specified host and port. 