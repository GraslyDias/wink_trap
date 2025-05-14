<?php
/**
 * Wall Private Chat API
 * This endpoint handles private chat between mutual crushes
 */

// Include direct CORS handling at the very beginning
require_once '../config/direct_cors.php';

// Set content type to JSON
header('Content-Type: application/json');

// Include configuration files
require_once '../config/database.php';
require_once '../utils/auth.php';

// Only allow POST requests for chat operations
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

// Verify user is authenticated
$user = verifyAuth();
if (!$user) {
    exit(); // Error response is handled in verifyAuth()
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);

// Check required fields
$action = isset($data['action']) ? sanitizeInput($data['action']) : '';
$wallId = isset($data['wall_id']) ? sanitizeInput($data['wall_id']) : '';

if (empty($action) || empty($wallId)) {
    http_response_code(400); // Bad Request
    echo json_encode(['success' => false, 'message' => 'Action and wall ID are required']);
    exit();
}

// Get database connection
$conn = getDbConnection();

// Get the internal wall ID
$wallIdStmt = $conn->prepare("SELECT id FROM walls WHERE wall_id = ?");
$wallIdStmt->bind_param("s", $wallId);
$wallIdStmt->execute();
$wallIdResult = $wallIdStmt->get_result();

if ($wallIdResult->num_rows === 0) {
    http_response_code(404); // Not Found
    echo json_encode(['success' => false, 'message' => 'Wall not found']);
    $wallIdStmt->close();
    $conn->close();
    exit();
}

$internalWallId = $wallIdResult->fetch_assoc()['id'];
$wallIdStmt->close();

// Debug function
function debugLog($message) {
    error_log("CHAT_API: " . $message);
}

// Handle different actions
switch ($action) {
    case 'create_chat':
        handleCreateChat($conn, $user, $internalWallId, $data);
        break;
    case 'get_chats':
        handleGetChats($conn, $user);
        break;
    case 'send_message':
        handleSendMessage($conn, $user, $data);
        break;
    case 'get_messages':
        handleGetMessages($conn, $user, $data);
        break;
    case 'update_relationship':
        handleUpdateRelationship($conn, $user, $data);
        break;
    default:
        http_response_code(400); // Bad Request
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
        break;
}

// Close connection
$conn->close();

/**
 * Handle creating a chat between mutual crushes
 */
function handleCreateChat($conn, $user, $internalWallId, $data) {
    // Required data
    $targetUserId = isset($data['target_user_id']) ? (int)sanitizeInput($data['target_user_id']) : 0;
    
    if (empty($targetUserId)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Target user ID is required']);
        return;
    }
    
    debugLog("Creating chat between user {$user['id']} and target user {$targetUserId}");
    
    // Verify both users are in the wall
    $memberCheckStmt = $conn->prepare("
        SELECT COUNT(*) as member_count
        FROM wall_members 
        WHERE wall_id = ? AND (user_id = ? OR user_id = ?)
    ");
    $memberCheckStmt->bind_param("iii", $internalWallId, $user['id'], $targetUserId);
    $memberCheckStmt->execute();
    $memberResult = $memberCheckStmt->get_result();
    $memberCount = $memberResult->fetch_assoc()['member_count'];
    $memberCheckStmt->close();
    
    if ($memberCount < 2) {
        debugLog("Both users must be members of the wall. Only found {$memberCount} members.");
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Both users must be members of the wall']);
        return;
    }
    
    debugLog("Verified both users are in the wall. Checking for mutual crush...");
    
    // Check if user has crush on target
    $userCrushStmt = $conn->prepare("
        SELECT COUNT(*) as crush_count
        FROM wall_crushes 
        WHERE wall_id = ? AND user_id = ? AND crush_on = ?
    ");
    $userCrushStmt->bind_param("iii", $internalWallId, $user['id'], $targetUserId);
    $userCrushStmt->execute();
    $userCrushResult = $userCrushStmt->get_result();
    $userHasCrushOnTarget = $userCrushResult->fetch_assoc()['crush_count'] > 0;
    $userCrushStmt->close();
    
    // Check if target has crush on user
    $targetCrushStmt = $conn->prepare("
        SELECT COUNT(*) as crush_count
        FROM wall_crushes 
        WHERE wall_id = ? AND user_id = ? AND crush_on = ?
    ");
    $targetCrushStmt->bind_param("iii", $internalWallId, $targetUserId, $user['id']);
    $targetCrushStmt->execute();
    $targetCrushResult = $targetCrushStmt->get_result();
    $targetHasCrushOnUser = $targetCrushResult->fetch_assoc()['crush_count'] > 0;
    $targetCrushStmt->close();
    
    debugLog("User has crush on target: " . ($userHasCrushOnTarget ? "YES" : "NO"));
    debugLog("Target has crush on user: " . ($targetHasCrushOnUser ? "YES" : "NO"));
    
    // In development mode, allow chat creation without mutual crush
    $devMode = isset($data['dev_mode']) && $data['dev_mode'] === true;
    $isMutualCrush = $userHasCrushOnTarget && $targetHasCrushOnUser;
    
    // If not mutual crush and not in dev mode, return error
    if (!$isMutualCrush && !$devMode) {
        debugLog("Mutual crush does not exist and not in dev mode");
        http_response_code(400);
        echo json_encode([
            'success' => false, 
            'message' => 'Mutual crush does not exist',
            'debug' => [
                'user_has_crush' => $userHasCrushOnTarget,
                'target_has_crush' => $targetHasCrushOnUser
            ]
        ]);
        return;
    }
    
    debugLog("Mutual crush exists or in dev mode. Creating chat...");
    
    // Create a unique match ID (smaller ID first)
    $user1Id = min($user['id'], $targetUserId);
    $user2Id = max($user['id'], $targetUserId);
    $matchId = "match-{$user1Id}-{$user2Id}";
    
    // Check if chat already exists
    $chatCheckStmt = $conn->prepare("
        SELECT id FROM private_chats WHERE match_id = ?
    ");
    $chatCheckStmt->bind_param("s", $matchId);
    $chatCheckStmt->execute();
    $chatResult = $chatCheckStmt->get_result();
    
    // If chat exists, return it
    if ($chatResult->num_rows > 0) {
        $chatId = $chatResult->fetch_assoc()['id'];
        $chatCheckStmt->close();
        
        debugLog("Chat already exists with ID: {$chatId}");
        
        // Return success
        echo json_encode([
            'success' => true,
            'message' => 'Chat already exists',
            'chat_id' => $chatId,
            'match_id' => $matchId,
            'is_mutual' => $isMutualCrush
        ]);
        return;
    }
    $chatCheckStmt->close();
    
    debugLog("Creating new chat between users {$user1Id} and {$user2Id}");
    
    // Create new chat
    $createChatStmt = $conn->prepare("
        INSERT INTO private_chats (match_id, user1_id, user2_id, created_at)
        VALUES (?, ?, ?, NOW())
    ");
    $createChatStmt->bind_param("sii", $matchId, $user1Id, $user2Id);
    
    if (!$createChatStmt->execute()) {
        debugLog("Failed to create chat: " . $conn->error);
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to create chat: ' . $conn->error]);
        $createChatStmt->close();
        return;
    }
    
    $chatId = $conn->insert_id;
    $createChatStmt->close();
    
    debugLog("Chat created with ID: {$chatId}");
    
    // Add welcome message
    $welcomeMsg = "You both have crushes on each other! You can now chat privately.";
    $addMsgStmt = $conn->prepare("
        INSERT INTO chat_messages (chat_id, sender_id, message, is_system_message, created_at)
        VALUES (?, ?, ?, 1, NOW())
    ");
    $addMsgStmt->bind_param("iis", $chatId, $user['id'], $welcomeMsg);
    $addMsgStmt->execute();
    $addMsgStmt->close();
    
    // Create initial relationship status
    $initRelStmt = $conn->prepare("
        INSERT INTO relationships (chat_id, status, updated_at, anniversary_checked)
        VALUES (?, 'Just matched', NOW(), 0)
    ");
    $initRelStmt->bind_param("i", $chatId);
    $initRelStmt->execute();
    $initRelStmt->close();
    
    debugLog("Chat setup complete. Relationship initialized.");
    
    // Return success
    echo json_encode([
        'success' => true,
        'message' => 'Chat created successfully',
        'chat_id' => $chatId,
        'match_id' => $matchId,
        'is_mutual' => $isMutualCrush
    ]);
}

/**
 * Handle getting all chats for the current user
 */
function handleGetChats($conn, $user) {
    // Get all chats where the user is a participant
    $chatsStmt = $conn->prepare("
        SELECT 
            pc.id, 
            pc.match_id, 
            pc.created_at,
            CASE 
                WHEN pc.user1_id = ? THEN pc.user2_id
                ELSE pc.user1_id
            END as partner_id,
            r.status as relationship_status,
            r.updated_at as status_updated
        FROM private_chats pc
        LEFT JOIN relationships r ON pc.id = r.chat_id
        WHERE pc.user1_id = ? OR pc.user2_id = ?
    ");
    $chatsStmt->bind_param("iii", $user['id'], $user['id'], $user['id']);
    $chatsStmt->execute();
    $chatsResult = $chatsStmt->get_result();
    
    $chats = [];
    while ($row = $chatsResult->fetch_assoc()) {
        // Get partner details
        $partnerStmt = $conn->prepare("
            SELECT id, name, email, profile_pic as avatar FROM users WHERE id = ?
        ");
        $partnerStmt->bind_param("i", $row['partner_id']);
        $partnerStmt->execute();
        $partnerResult = $partnerStmt->get_result();
        $partner = $partnerResult->fetch_assoc();
        $partnerStmt->close();
        
        // Get last message
        $msgStmt = $conn->prepare("
            SELECT 
                id, 
                sender_id, 
                message, 
                is_system_message, 
                created_at 
            FROM chat_messages 
            WHERE chat_id = ? 
            ORDER BY created_at DESC 
            LIMIT 1
        ");
        $msgStmt->bind_param("i", $row['id']);
        $msgStmt->execute();
        $msgResult = $msgStmt->get_result();
        $lastMessage = $msgResult->fetch_assoc();
        $msgStmt->close();
        
        $chats[] = [
            'id' => $row['id'],
            'match_id' => $row['match_id'],
            'created_at' => $row['created_at'],
            'partner' => $partner,
            'relationship_status' => $row['relationship_status'] ?? 'Just matched',
            'status_updated' => $row['status_updated'],
            'last_message' => $lastMessage
        ];
    }
    $chatsStmt->close();
    
    // Return the chats
    echo json_encode([
        'success' => true,
        'message' => 'Chats retrieved successfully',
        'chats' => $chats
    ]);
}

/**
 * Handle sending a message in a chat
 */
function handleSendMessage($conn, $user, $data) {
    // Required data
    $chatId = isset($data['chat_id']) ? (int)sanitizeInput($data['chat_id']) : 0;
    $message = isset($data['message']) ? sanitizeInput($data['message']) : '';
    
    if (empty($chatId) || empty($message)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Chat ID and message are required']);
        return;
    }
    
    // Verify user is a participant in this chat
    $chatCheckStmt = $conn->prepare("
        SELECT id FROM private_chats 
        WHERE id = ? AND (user1_id = ? OR user2_id = ?)
    ");
    $chatCheckStmt->bind_param("iii", $chatId, $user['id'], $user['id']);
    $chatCheckStmt->execute();
    $chatResult = $chatCheckStmt->get_result();
    
    if ($chatResult->num_rows === 0) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'You are not a participant in this chat']);
        $chatCheckStmt->close();
        return;
    }
    $chatCheckStmt->close();
    
    // Add message
    $msgStmt = $conn->prepare("
        INSERT INTO chat_messages (chat_id, sender_id, message, is_system_message, created_at)
        VALUES (?, ?, ?, 0, NOW())
    ");
    $msgStmt->bind_param("iis", $chatId, $user['id'], $message);
    
    if (!$msgStmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to send message: ' . $conn->error]);
        $msgStmt->close();
        return;
    }
    
    $messageId = $conn->insert_id;
    $msgStmt->close();
    
    // Get message details
    $getMsgStmt = $conn->prepare("
        SELECT 
            cm.id, 
            cm.sender_id, 
            u.name as sender_name,
            u.profile_pic as sender_avatar,
            cm.message, 
            cm.is_system_message, 
            cm.created_at
        FROM chat_messages cm
        JOIN users u ON cm.sender_id = u.id
        WHERE cm.id = ?
    ");
    $getMsgStmt->bind_param("i", $messageId);
    $getMsgStmt->execute();
    $msgResult = $getMsgStmt->get_result();
    $message = $msgResult->fetch_assoc();
    $getMsgStmt->close();
    
    // Return success
    echo json_encode([
        'success' => true,
        'message' => 'Message sent successfully',
        'data' => $message
    ]);
}

/**
 * Handle getting messages for a chat
 */
function handleGetMessages($conn, $user, $data) {
    // Required data
    $chatId = isset($data['chat_id']) ? (int)sanitizeInput($data['chat_id']) : 0;
    
    if (empty($chatId)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Chat ID is required']);
        return;
    }
    
    // Verify user is a participant in this chat
    $chatCheckStmt = $conn->prepare("
        SELECT id FROM private_chats 
        WHERE id = ? AND (user1_id = ? OR user2_id = ?)
    ");
    $chatCheckStmt->bind_param("iii", $chatId, $user['id'], $user['id']);
    $chatCheckStmt->execute();
    $chatResult = $chatCheckStmt->get_result();
    
    if ($chatResult->num_rows === 0) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'You are not a participant in this chat']);
        $chatCheckStmt->close();
        return;
    }
    $chatCheckStmt->close();
    
    // Get messages
    $msgsStmt = $conn->prepare("
        SELECT 
            cm.id, 
            cm.sender_id, 
            u.name as sender_name,
            u.profile_pic as sender_avatar,
            cm.message, 
            cm.is_system_message, 
            cm.created_at
        FROM chat_messages cm
        LEFT JOIN users u ON cm.sender_id = u.id
        WHERE cm.chat_id = ?
        ORDER BY cm.created_at ASC
    ");
    $msgsStmt->bind_param("i", $chatId);
    $msgsStmt->execute();
    $msgsResult = $msgsStmt->get_result();
    
    $messages = [];
    while ($row = $msgsResult->fetch_assoc()) {
        $messages[] = $row;
    }
    $msgsStmt->close();
    
    // Return the messages
    echo json_encode([
        'success' => true,
        'message' => 'Messages retrieved successfully',
        'messages' => $messages
    ]);
}

/**
 * Handle updating relationship status
 */
function handleUpdateRelationship($conn, $user, $data) {
    // Required data
    $chatId = isset($data['chat_id']) ? (int)sanitizeInput($data['chat_id']) : 0;
    $status = isset($data['status']) ? sanitizeInput($data['status']) : '';
    
    if (empty($chatId) || empty($status)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Chat ID and status are required']);
        return;
    }
    
    debugLog("Updating relationship status for chat ID {$chatId} to '{$status}'");
    
    // Verify user is a participant in this chat
    $chatCheckStmt = $conn->prepare("
        SELECT id FROM private_chats 
        WHERE id = ? AND (user1_id = ? OR user2_id = ?)
    ");
    $chatCheckStmt->bind_param("iii", $chatId, $user['id'], $user['id']);
    $chatCheckStmt->execute();
    $chatResult = $chatCheckStmt->get_result();
    
    if ($chatResult->num_rows === 0) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'You are not a participant in this chat']);
        $chatCheckStmt->close();
        return;
    }
    $chatCheckStmt->close();
    
    // Check if relationship exists
    $checkRelStmt = $conn->prepare("
        SELECT id FROM relationships WHERE chat_id = ?
    ");
    $checkRelStmt->bind_param("i", $chatId);
    $checkRelStmt->execute();
    $relResult = $checkRelStmt->get_result();
    $relationshipExists = $relResult->num_rows > 0;
    $checkRelStmt->close();
    
    if ($relationshipExists) {
        // Update the existing relationship
        $updateStmt = $conn->prepare("
            UPDATE relationships 
            SET status = ?, updated_at = NOW()
            WHERE chat_id = ?
        ");
        $updateStmt->bind_param("si", $status, $chatId);
        
        if (!$updateStmt->execute()) {
            debugLog("Failed to update relationship: " . $conn->error);
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to update relationship: ' . $conn->error]);
            $updateStmt->close();
            return;
        }
        $updateStmt->close();
    } else {
        // Create a new relationship
        $createStmt = $conn->prepare("
            INSERT INTO relationships (chat_id, status, updated_at, anniversary_checked)
            VALUES (?, ?, NOW(), 0)
        ");
        $createStmt->bind_param("is", $chatId, $status);
        
        if (!$createStmt->execute()) {
            debugLog("Failed to create relationship: " . $conn->error);
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to create relationship: ' . $conn->error]);
            $createStmt->close();
            return;
        }
        $createStmt->close();
    }
    
    // Add a system message
    $systemMessage = "Relationship status updated to: {$status}";
    $addMsgStmt = $conn->prepare("
        INSERT INTO chat_messages (chat_id, sender_id, message, is_system_message, created_at)
        VALUES (?, ?, ?, 1, NOW())
    ");
    $addMsgStmt->bind_param("iis", $chatId, $user['id'], $systemMessage);
    $addMsgStmt->execute();
    $addMsgStmt->close();
    
    // Return success
    echo json_encode([
        'success' => true,
        'message' => 'Relationship status updated successfully',
        'data' => [
            'chat_id' => $chatId,
            'status' => $status,
            'updated_at' => date('Y-m-d H:i:s')
        ]
    ]);
} 