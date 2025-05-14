This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Authentication System Updates

The authentication system has been enhanced to provide persistent login functionality:

1. Users will stay logged in even after closing the browser
2. The "remember me" feature keeps users logged in for 30 days
3. Sessions are now more secure with proper regeneration

To set up the database for the enhanced authentication system, run:

```sql
-- Run this script to create necessary tables
SOURCE /path/to/api/config/auth_tokens.sql
```

### Features of the new authentication system:

- Long-lived PHP sessions (30 days)
- Persistent login with secure tokens
- Automatic session regeneration for security
- Multiple authentication methods (session, remember token, API token)

### How it works:

1. When a user logs in, a session is created
2. A persistent token is stored in the database and sent as a cookie
3. If the session expires but the token cookie exists, the user is automatically logged back in
4. Tokens expire after 30 days for security
5. Logging out properly invalidates both the session and the token

## WebSocket Chat Functionality

Wink Trap includes real-time chat functionality using WebSockets. The implementation enables:
- Real-time chat messaging
- Typing indicators
- Live crush updates and match notifications
- Connection status indicators

### Starting the WebSocket Server

To start the WebSocket server:

1. For Windows, use the provided batch file:
   ```
   start_websocket_server.bat
   ```

2. For Linux/macOS or manual start:
   ```
   php api/websocket_server.php
   ```

The WebSocket server runs on port 8080 by default.

### Configuration

The WebSocket server configuration can be customized by editing `api/websocket_server.php`. 
Database settings are defined in the `getDatabaseConnection()` method.

For detailed setup and configuration instructions, see `WEBSOCKET_SETUP.md`.
