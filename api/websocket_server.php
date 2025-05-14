<?php
/**
 * Wink Trap WebSocket Server
 * 
 * This file implements a WebSocket server for real-time chat functionality.
 * Run with: php api/websocket_server.php
 */

require __DIR__ . '/../vendor/autoload.php';

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;

/**
 * Chat WebSocket Server
 */
class ChatServer implements MessageComponentInterface
{
    protected $clients;
    protected $userConnections = [];
    protected $wallConnections = [];
    protected $connectionData = [];

    public function __construct()
    {
        $this->clients = new \SplObjectStorage;
        echo "Chat server started at " . date('Y-m-d H:i:s') . "\n";
        echo "Listening for connections...\n";
    }

    /**
     * Handle new connections
     */
    public function onOpen(ConnectionInterface $conn)
    {
        $this->clients->attach($conn);
        
        // Parse query parameters
        $query = $conn->httpRequest->getUri()->getQuery();
        parse_str($query, $params);
        
        // Set user and wall info if provided
        $userId = isset($params['user_id']) ? (int)$params['user_id'] : null;
        $wallId = isset($params['wall_id']) ? (int)$params['wall_id'] : null;
        
        // Store connection data
        $this->connectionData[$conn->resourceId] = [
            'user_id' => $userId,
            'wall_id' => $wallId,
            'connected_at' => time()
        ];
        
        // Map user to connection
        if ($userId) {
            if (!isset($this->userConnections[$userId])) {
                $this->userConnections[$userId] = [];
            }
            $this->userConnections[$userId][] = $conn->resourceId;
            
            // Map wall to connection
            if ($wallId) {
                if (!isset($this->wallConnections[$wallId])) {
                    $this->wallConnections[$wallId] = [];
                }
                $this->wallConnections[$wallId][] = $conn->resourceId;
            }
        }
        
        echo "New connection ({$conn->resourceId}) established: User ID: {$userId}, Wall ID: {$wallId}\n";
        
        // Send welcome message
        $conn->send(json_encode([
            'type' => 'system_message',
            'payload' => [
                'type' => 'connection',
                'status' => 'connected',
                'message' => 'Connected to chat server',
                'timestamp' => date('c')
            ]
        ]));
    }

    /**
     * Handle incoming messages
     */
    public function onMessage(ConnectionInterface $from, $msg)
    {
        $fromUserId = $this->connectionData[$from->resourceId]['user_id'] ?? null;
        $fromWallId = $this->connectionData[$from->resourceId]['wall_id'] ?? null;
        
        if (!$fromUserId || !$fromWallId) {
            $from->send(json_encode([
                'type' => 'system_message',
                'payload' => [
                    'type' => 'error',
                    'message' => 'User ID or Wall ID not provided',
                    'timestamp' => date('c')
                ]
            ]));
            return;
        }
        
        echo "Received message from connection {$from->resourceId} (User: {$fromUserId}, Wall: {$fromWallId})\n";
        
        try {
            $data = json_decode($msg, true);
            
            if (!$data || !isset($data['type']) || !isset($data['payload'])) {
                throw new Exception('Invalid message format');
            }
            
            // Get message type and payload
            $type = $data['type'];
            $payload = $data['payload'];
            
            // Add sender data if not already present
            if (!isset($payload['sender_id'])) {
                $payload['sender_id'] = $fromUserId;
            }
            
            if (!isset($payload['wall_id'])) {
                $payload['wall_id'] = $fromWallId;
            }
            
            if (!isset($payload['timestamp'])) {
                $payload['timestamp'] = date('c');
            }
            
            // Save to database if needed
            $this->saveMessageToDatabase($type, $payload);
            
            // Process message based on type
            switch ($type) {
                case 'chat_message':
                    $this->handleChatMessage($from, $payload);
                    break;
                
                case 'typing_indicator':
                    $this->handleTypingIndicator($from, $payload);
                    break;
                
                case 'crush_update':
                    $this->handleCrushUpdate($from, $payload);
                    break;
                
                case 'mutual_match':
                    $this->handleMutualMatch($from, $payload);
                    break;
                
                default:
                    echo "Unknown message type: {$type}\n";
                    break;
            }
        } catch (Exception $e) {
            echo "Error processing message: " . $e->getMessage() . "\n";
            $from->send(json_encode([
                'type' => 'system_message',
                'payload' => [
                    'type' => 'error',
                    'message' => 'Error processing message: ' . $e->getMessage(),
                    'timestamp' => date('c')
                ]
            ]));
        }
    }

    /**
     * Handle chat messages
     */
    private function handleChatMessage($from, $payload)
    {
        // Extract message data
        $chatId = $payload['chat_id'] ?? null;
        $message = $payload['message'] ?? '';
        $senderId = $payload['sender_id'] ?? null;
        $isSystemMessage = $payload['is_system_message'] ?? false;
        
        if (!$chatId || !$senderId) {
            echo "Missing required data for chat message\n";
            return;
        }
        
        // Get sender info from database
        $senderInfo = $this->getUserInfo($senderId);
        if ($senderInfo && !$isSystemMessage) {
            $payload['sender_name'] = $senderInfo['name'];
            $payload['sender_avatar'] = $senderInfo['avatar'];
        }
        
        // Find chat participants
        $participants = $this->getChatParticipants($chatId);
        
        if (empty($participants)) {
            echo "No participants found for chat ID: {$chatId}\n";
            return;
        }
        
        // Prepare message for sending
        $messageData = json_encode([
            'type' => 'chat_message',
            'payload' => $payload
        ]);
        
        // Send to all participants who are connected
        foreach ($participants as $participantId) {
            if ($participantId == $senderId && !$isSystemMessage) {
                // Skip sending back to sender for regular messages
                // (system messages should be sent to everyone)
                continue;
            }
            
            $this->sendToUser($participantId, $messageData);
        }
        
        echo "Chat message processed from user {$senderId} to chat {$chatId}\n";
    }

    /**
     * Handle typing indicators
     */
    private function handleTypingIndicator($from, $payload)
    {
        // Extract typing data
        $chatId = $payload['chat_id'] ?? null;
        $isTyping = $payload['is_typing'] ?? false;
        $senderId = $payload['sender_id'] ?? null;
        
        if (!$chatId || !$senderId) {
            echo "Missing required data for typing indicator\n";
            return;
        }
        
        // Find chat participants
        $participants = $this->getChatParticipants($chatId);
        
        if (empty($participants)) {
            echo "No participants found for chat ID: {$chatId}\n";
            return;
        }
        
        // Prepare typing indicator for sending
        $typingData = json_encode([
            'type' => 'typing_indicator',
            'payload' => $payload
        ]);
        
        // Send to all participants except the sender
        foreach ($participants as $participantId) {
            if ($participantId != $senderId) {
                $this->sendToUser($participantId, $typingData);
            }
        }
    }

    /**
     * Handle crush updates
     */
    private function handleCrushUpdate($from, $payload)
    {
        // Extract crush data
        $wallId = $payload['wall_id'] ?? null;
        $userId = $payload['sender_id'] ?? null;
        $targetUserId = $payload['target_user_id'] ?? null;
        $action = $payload['action'] ?? 'set'; // 'set' or 'remove'
        
        if (!$wallId || !$userId || !$targetUserId) {
            echo "Missing required data for crush update\n";
            return;
        }
        
        // Prepare crush update for sending
        $crushData = json_encode([
            'type' => 'crush_update',
            'payload' => $payload
        ]);
        
        // Send to target user
        $this->sendToUser($targetUserId, $crushData);
        
        // Check if this creates a mutual crush
        if ($action === 'set' && $this->checkMutualCrush($userId, $targetUserId, $wallId)) {
            $this->handleMutualMatch($from, [
                'wall_id' => $wallId,
                'user_id' => $userId,
                'target_user_id' => $targetUserId,
                'timestamp' => date('c')
            ]);
        }
    }

    /**
     * Handle mutual match notifications
     */
    private function handleMutualMatch($from, $payload)
    {
        // Extract match data
        $wallId = $payload['wall_id'] ?? null;
        $userId = $payload['user_id'] ?? null;
        $targetUserId = $payload['target_user_id'] ?? null;
        
        if (!$wallId || !$userId || !$targetUserId) {
            echo "Missing required data for mutual match\n";
            return;
        }
        
        // Prepare match notification
        $matchData = json_encode([
            'type' => 'mutual_match',
            'payload' => $payload
        ]);
        
        // Send to both users
        $this->sendToUser($userId, $matchData);
        $this->sendToUser($targetUserId, $matchData);
        
        echo "Mutual match notification sent for users {$userId} and {$targetUserId}\n";
    }

    /**
     * Handle closed connections
     */
    public function onClose(ConnectionInterface $conn)
    {
        $userId = $this->connectionData[$conn->resourceId]['user_id'] ?? null;
        $wallId = $this->connectionData[$conn->resourceId]['wall_id'] ?? null;
        
        // Remove from connections
        if ($userId && isset($this->userConnections[$userId])) {
            $index = array_search($conn->resourceId, $this->userConnections[$userId]);
            if ($index !== false) {
                unset($this->userConnections[$userId][$index]);
                $this->userConnections[$userId] = array_values($this->userConnections[$userId]);
            }
            
            // Remove user entry if no more connections
            if (empty($this->userConnections[$userId])) {
                unset($this->userConnections[$userId]);
            }
        }
        
        // Remove from wall connections
        if ($wallId && isset($this->wallConnections[$wallId])) {
            $index = array_search($conn->resourceId, $this->wallConnections[$wallId]);
            if ($index !== false) {
                unset($this->wallConnections[$wallId][$index]);
                $this->wallConnections[$wallId] = array_values($this->wallConnections[$wallId]);
            }
            
            // Remove wall entry if no more connections
            if (empty($this->wallConnections[$wallId])) {
                unset($this->wallConnections[$wallId]);
            }
        }
        
        // Remove connection data
        unset($this->connectionData[$conn->resourceId]);
        
        // Remove from clients collection
        $this->clients->detach($conn);
        
        echo "Connection {$conn->resourceId} has disconnected\n";
    }

    /**
     * Handle errors
     */
    public function onError(ConnectionInterface $conn, \Exception $e)
    {
        echo "Error occurred for connection {$conn->resourceId}: {$e->getMessage()}\n";
        $conn->close();
    }

    /**
     * Send message to specific user across all their connections
     */
    private function sendToUser($userId, $message)
    {
        if (!isset($this->userConnections[$userId]) || empty($this->userConnections[$userId])) {
            echo "User {$userId} is not connected\n";
            return false;
        }
        
        $sent = false;
        foreach ($this->clients as $client) {
            if (in_array($client->resourceId, $this->userConnections[$userId])) {
                $client->send($message);
                $sent = true;
            }
        }
        
        return $sent;
    }

    /**
     * Send message to all users in a wall
     */
    private function sendToWall($wallId, $message, $excludeUserId = null)
    {
        if (!isset($this->wallConnections[$wallId]) || empty($this->wallConnections[$wallId])) {
            echo "No users connected to wall {$wallId}\n";
            return false;
        }
        
        $sent = false;
        foreach ($this->clients as $client) {
            if (in_array($client->resourceId, $this->wallConnections[$wallId])) {
                $userId = $this->connectionData[$client->resourceId]['user_id'] ?? null;
                
                // Skip excluded user
                if ($excludeUserId && $userId == $excludeUserId) {
                    continue;
                }
                
                $client->send($message);
                $sent = true;
            }
        }
        
        return $sent;
    }

    /**
     * Save message to database
     * This method should be implemented to store messages permanently
     */
    private function saveMessageToDatabase($type, $payload)
    {
        // For chat messages, we need to save to the database
        if ($type === 'chat_message' && isset($payload['chat_id'], $payload['message'], $payload['sender_id'])) {
            // Connect to database
            $db = $this->getDatabaseConnection();
            
            if (!$db) {
                echo "Database connection failed, message not saved\n";
                return false;
            }
            
            try {
                // Prepare statement
                $stmt = $db->prepare(
                    "INSERT INTO chat_messages (chat_id, sender_id, message, is_system_message, created_at) 
                     VALUES (?, ?, ?, ?, NOW())"
                );
                
                // Execute statement
                $isSystemMessage = isset($payload['is_system_message']) && $payload['is_system_message'] ? 1 : 0;
                $stmt->execute([
                    $payload['chat_id'],
                    $payload['sender_id'],
                    $payload['message'],
                    $isSystemMessage
                ]);
                
                $messageId = $db->lastInsertId();
                echo "Message saved to database with ID: {$messageId}\n";
                
                // Add the ID to the payload
                $payload['id'] = $messageId;
                
                return true;
            } catch (\PDOException $e) {
                echo "Database error: " . $e->getMessage() . "\n";
                return false;
            } finally {
                $db = null; // Close connection
            }
        }
        
        return true; // No need to save other types of messages
    }

    /**
     * Get database connection
     */
    private function getDatabaseConnection()
    {
        try {
            // Use the same database config as your main application
            $host = 'localhost';
            $dbname = 'wink_trap';
            $username = 'root';
            $password = '';
            
            $db = new \PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
            $db->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
            
            return $db;
        } catch (\PDOException $e) {
            echo "Database connection error: " . $e->getMessage() . "\n";
            return null;
        }
    }

    /**
     * Get user information from database
     */
    private function getUserInfo($userId)
    {
        $db = $this->getDatabaseConnection();
        
        if (!$db) {
            return null;
        }
        
        try {
            $stmt = $db->prepare("SELECT id, name, avatar FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            
            $result = $stmt->fetch(\PDO::FETCH_ASSOC);
            
            return $result ?: null;
        } catch (\PDOException $e) {
            echo "Database error getting user info: " . $e->getMessage() . "\n";
            return null;
        } finally {
            $db = null; // Close connection
        }
    }

    /**
     * Get chat participants
     */
    private function getChatParticipants($chatId)
    {
        $db = $this->getDatabaseConnection();
        
        if (!$db) {
            return [];
        }
        
        try {
            $stmt = $db->prepare(
                "SELECT user_id, target_user_id FROM private_chats WHERE id = ?"
            );
            $stmt->execute([$chatId]);
            
            $result = $stmt->fetch(\PDO::FETCH_ASSOC);
            
            if (!$result) {
                return [];
            }
            
            return [$result['user_id'], $result['target_user_id']];
        } catch (\PDOException $e) {
            echo "Database error getting chat participants: " . $e->getMessage() . "\n";
            return [];
        } finally {
            $db = null; // Close connection
        }
    }

    /**
     * Check if two users have mutual crush
     */
    private function checkMutualCrush($userId1, $userId2, $wallId)
    {
        $db = $this->getDatabaseConnection();
        
        if (!$db) {
            return false;
        }
        
        try {
            $stmt = $db->prepare(
                "SELECT COUNT(*) FROM crushes 
                 WHERE wall_id = ? 
                 AND ((user_id = ? AND target_user_id = ?) 
                 AND (user_id = ? AND target_user_id = ?))"
            );
            $stmt->execute([$wallId, $userId1, $userId2, $userId2, $userId1]);
            
            $count = (int)$stmt->fetchColumn();
            
            return $count === 2; // Both users have crushes on each other
        } catch (\PDOException $e) {
            echo "Database error checking mutual crush: " . $e->getMessage() . "\n";
            return false;
        } finally {
            $db = null; // Close connection
        }
    }
}

// Run the server
$server = IoServer::factory(
    new HttpServer(
        new WsServer(
            new ChatServer()
        )
    ),
    8080
);

echo "WebSocket server started on port 8080\n";
$server->run(); 