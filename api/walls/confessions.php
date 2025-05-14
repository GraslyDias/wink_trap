<?php
/**
 * Wall Confessions API
 * This endpoint handles fetching and posting confessions on a wall
 */

// Include direct CORS handling at the very beginning
require_once '../config/direct_cors.php';

// Set content type to JSON
header('Content-Type: application/json');

// Include configuration files
require_once '../config/database.php';
require_once '../utils/auth.php';

// Verify user is authenticated
$user = verifyAuth();
if (!$user) {
    exit(); // Error response is handled in verifyAuth()
}

// Get wall_id from query parameter
$wallId = isset($_GET['id']) ? sanitizeInput($_GET['id']) : '';
if (empty($wallId) && $_SERVER['REQUEST_METHOD'] === 'GET') {
    http_response_code(400); // Bad Request
    echo json_encode(['success' => false, 'message' => 'Wall ID is required']);
    exit();
}

// For POST requests, get wall_id from the POST data
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $wallId = isset($data['wall_id']) ? sanitizeInput($data['wall_id']) : '';
    
    if (empty($wallId)) {
        http_response_code(400); // Bad Request
        echo json_encode(['success' => false, 'message' => 'Wall ID is required']);
        exit();
    }
}

// Get database connection
$conn = getDbConnection();

// Check if the wall exists and user is a member of it
$memberCheckStmt = $conn->prepare("
    SELECT wm.id, w.id as wall_internal_id
    FROM wall_members wm
    JOIN walls w ON wm.wall_id = w.id
    WHERE w.wall_id = ? AND wm.user_id = ?
");
$memberCheckStmt->bind_param("si", $wallId, $user['id']);
$memberCheckStmt->execute();
$memberResult = $memberCheckStmt->get_result();

if ($memberResult->num_rows === 0) {
    http_response_code(403); // Forbidden
    echo json_encode(['success' => false, 'message' => 'You are not a member of this wall']);
    $memberCheckStmt->close();
    $conn->close();
    exit();
}

// Get the internal wall ID
$wallInternalId = $memberResult->fetch_assoc()['wall_internal_id'];
$memberCheckStmt->close();

// Handle GET request - Fetch confessions
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Query to get all confessions for this wall
    $stmt = $conn->prepare("
        SELECT 
            c.id, 
            c.text, 
            c.created_at as timestamp, 
            DATE_ADD(c.created_at, INTERVAL 24 HOUR) as expires_at,
            (SELECT COUNT(*) FROM confession_likes cl WHERE cl.confession_id = c.id) as likes
        FROM wall_confessions c
        WHERE c.wall_id = ? AND c.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        ORDER BY c.created_at DESC
    ");
    $stmt->bind_param("i", $wallInternalId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    // Prepare confessions array
    $confessions = [];
    $likedByUser = []; // Array to store confession IDs liked by current user
    
    while ($row = $result->fetch_assoc()) {
        // Check if user has liked this confession
        $likeCheckStmt = $conn->prepare("
            SELECT id FROM confession_likes 
            WHERE confession_id = ? AND user_id = ?
        ");
        $likeCheckStmt->bind_param("ii", $row['id'], $user['id']);
        $likeCheckStmt->execute();
        $likeResult = $likeCheckStmt->get_result();
        
        // If user has liked this confession, add to likedByUser array
        if ($likeResult->num_rows > 0) {
            $likedByUser[] = $row['id'];
        }
        $likeCheckStmt->close();
        
        // Get comments for this confession
        $commentStmt = $conn->prepare("
            SELECT 
                cc.id,
                u.name as user_name,
                u.profile_pic as user_avatar,
                cc.text,
                cc.created_at as timestamp,
                (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = cc.id) as likes
            FROM confession_comments cc
            JOIN users u ON cc.user_id = u.id
            WHERE cc.confession_id = ?
            ORDER BY cc.created_at ASC
        ");
        $commentStmt->bind_param("i", $row['id']);
        $commentStmt->execute();
        $commentResult = $commentStmt->get_result();
        
        $comments = [];
        while ($comment = $commentResult->fetch_assoc()) {
            // Get replies for this comment
            $replyStmt = $conn->prepare("
                SELECT 
                    cr.id,
                    u.name as user_name,
                    u.profile_pic as user_avatar,
                    cr.text,
                    cr.created_at as timestamp
                FROM comment_replies cr
                JOIN users u ON cr.user_id = u.id
                WHERE cr.comment_id = ?
                ORDER BY cr.created_at ASC
            ");
            $replyStmt->bind_param("i", $comment['id']);
            $replyStmt->execute();
            $replyResult = $replyStmt->get_result();
            
            $replies = [];
            while ($reply = $replyResult->fetch_assoc()) {
                $replies[] = [
                    'id' => $reply['id'],
                    'userName' => $reply['user_name'],
                    'userAvatar' => $reply['user_avatar'] ?: 'https://i.pravatar.cc/150',
                    'text' => $reply['text'],
                    'timestamp' => $reply['timestamp'],
                    'likes' => 0
                ];
            }
            $replyStmt->close();
            
            $comments[] = [
                'id' => $comment['id'],
                'userName' => $comment['user_name'],
                'userAvatar' => $comment['user_avatar'] ?: 'https://i.pravatar.cc/150',
                'text' => $comment['text'],
                'timestamp' => $comment['timestamp'],
                'likes' => (int)$comment['likes'],
                'replies' => $replies
            ];
        }
        $commentStmt->close();
        
        $confessions[] = [
            'id' => $row['id'],
            'text' => $row['text'],
            'timestamp' => $row['timestamp'],
            'expiresAt' => $row['expires_at'],
            'likes' => (int)$row['likes'],
            'comments' => $comments
        ];
    }
    $stmt->close();
    
    // Return the list of confessions and which ones are liked by the user
    echo json_encode([
        'success' => true,
        'message' => 'Confessions retrieved successfully',
        'confessions' => $confessions,
        'liked_by_user' => $likedByUser
    ]);
}
// Handle POST request - Create a new confession
else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get confession text from POST data
    $data = json_decode(file_get_contents('php://input'), true);
    $confessionText = isset($data['text']) ? sanitizeInput($data['text']) : '';
    
    if (empty($confessionText)) {
        http_response_code(400); // Bad Request
        echo json_encode(['success' => false, 'message' => 'Confession text is required']);
        exit();
    }
    
    // Insert the new confession
    $stmt = $conn->prepare("
        INSERT INTO wall_confessions (wall_id, user_id, text, created_at) 
        VALUES (?, ?, ?, NOW())
    ");
    $stmt->bind_param("iis", $wallInternalId, $user['id'], $confessionText);
    
    if ($stmt->execute()) {
        $confessionId = $stmt->insert_id;
        $stmt->close();
        
        // Get the created confession details
        $getStmt = $conn->prepare("
            SELECT 
                id, 
                text, 
                created_at as timestamp, 
                DATE_ADD(created_at, INTERVAL 24 HOUR) as expires_at
            FROM wall_confessions
            WHERE id = ?
        ");
        $getStmt->bind_param("i", $confessionId);
        $getStmt->execute();
        $result = $getStmt->get_result();
        $confession = $result->fetch_assoc();
        $getStmt->close();
        
        // Return success with the new confession
        echo json_encode([
            'success' => true,
            'message' => 'Confession posted successfully',
            'confession' => [
                'id' => $confession['id'],
                'text' => $confession['text'],
                'timestamp' => $confession['timestamp'],
                'expiresAt' => $confession['expires_at'],
                'likes' => 0,
                'comments' => []
            ]
        ]);
    } else {
        http_response_code(500); // Internal Server Error
        echo json_encode(['success' => false, 'message' => 'Failed to post confession: ' . $conn->error]);
        $stmt->close();
    }
}
// Handle other request methods
else {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}

// Close connection
$conn->close(); 