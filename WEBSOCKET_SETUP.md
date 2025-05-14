# WebSocket Setup for Wink Trap

This guide provides instructions for setting up WebSocket functionality for real-time chat in the Wink Trap application.

## Overview

The WebSocket implementation enables:
- Real-time chat messaging
- Typing indicators
- Live crush updates and match notifications
- Connection status indicators

## Prerequisites

- PHP 7.4 or higher
- Composer
- MySQL database (same as your main Wink Trap application)
- Access to run background processes on your server

## Installation Steps

### 1. Install Required PHP Packages

```bash
cd /path/to/wink_trap
composer require cboden/ratchet
```

### 2. Configure WebSocket Server

The WebSocket server implementation is in `api/websocket_server.php`. Review the database connection settings in the `getDatabaseConnection()` method to match your database configuration.

```php
private function getDatabaseConnection()
{
    try {
        // Use the same database config as your main application
        $host = 'localhost';
        $dbname = 'wink_trap';
        $username = 'root';
        $password = '';
        
        // Update these values to match your configuration
        $db = new \PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
        $db->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        
        return $db;
    } catch (\PDOException $e) {
        echo "Database connection error: " . $e->getMessage() . "\n";
        return null;
    }
}
```

### 3. Configure WebSocket Client

The WebSocket client configuration is in `app/utils/websocketService.js`. If your WebSocket server runs on a different host or port, update the environment variable in your `.env` file:

```
# .env
NEXT_PUBLIC_WS_HOST=your-server.com:8080
```

If no environment variable is set, the WebSocket client will connect to the same host as the web application.

### 4. Running the WebSocket Server

#### Development Environment

For development, you can run the WebSocket server directly:

```bash
php api/websocket_server.php
```

This will start the server on port 8080.

#### Production Environment

For production, you should run the WebSocket server as a daemon/service.

**Using Supervisor (recommended for Linux/Unix systems):**

Create a supervisor configuration file `/etc/supervisor/conf.d/wink_trap_websocket.conf`:

```ini
[program:wink_trap_websocket]
command=php /path/to/wink_trap/api/websocket_server.php
autostart=true
autorestart=true
stderr_logfile=/var/log/wink_trap_websocket.err.log
stdout_logfile=/var/log/wink_trap_websocket.out.log
user=www-data
```

Then reload supervisor:

```bash
supervisorctl reread
supervisorctl update
```

**Using Windows as a Service:**

For Windows servers, you can use [NSSM (Non-Sucking Service Manager)](https://nssm.cc/) to create a Windows service:

```
nssm install WinkTrapWebSocket
```

Set the path to PHP executable and the WebSocket server script as arguments.

### 5. Firewall Configuration

Make sure your server firewall allows WebSocket connections:

- Open port 8080 for WebSocket traffic
- If using a reverse proxy, configure it to proxy WebSocket connections correctly

### 6. Testing the WebSocket Connection

Once your server is running, you can test the WebSocket connection in the browser console:

```javascript
const ws = new WebSocket('ws://your-server.com:8080?user_id=1&wall_id=1');
ws.onopen = () => console.log('Connected!');
ws.onmessage = (event) => console.log('Received:', JSON.parse(event.data));
ws.onerror = (error) => console.error('Error:', error);
```

### 7. Troubleshooting

**Connection Issues:**
- Check the WebSocket server logs
- Ensure the WebSocket port is accessible from the client
- Verify that the client is sending the correct user_id and wall_id parameters

**Message Delivery Issues:**
- Check database connectivity
- Verify that chat_id values correspond to existing private chats
- Check user permissions in the database

## Additional Information

### WebSocket Protocol Format

The WebSocket messages use the following JSON format:

```json
{
  "type": "chat_message | typing_indicator | crush_update | mutual_match | system_message",
  "payload": {
    // Message-specific data
    "sender_id": 123,
    "wall_id": 456,
    "timestamp": "2023-06-01T12:34:56Z",
    // Additional fields based on message type
  }
}
```

### Security Considerations

- The WebSocket server requires user authentication through the query parameters
- All message payloads include the sender's user ID for verification
- Messages are only delivered to authorized recipients

### Production Best Practices

- Use SSL/TLS for secure WebSocket connections (wss:// instead of ws://)
- Implement rate limiting to prevent abuse
- Monitor server performance and scale horizontally if needed
- Set up automated restart procedures in case of server crashes 