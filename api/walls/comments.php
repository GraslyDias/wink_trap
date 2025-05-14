<?php
/**
 * Wall Confession Comments API
 * This endpoint handles adding and getting comments for confessions
 */

// Include direct CORS handling
require_once '../config/direct_cors.php';

// Set content type to JSON
header('Content-Type: application/json');

// Include configuration files
require_once '../config/database.php';
require_once '../utils/auth.php';

// Debug logging function
function debugLog($message) {
    // Uncomment to enable debug logging
    // error_log("COMMENTS_API: " . $message);
}

// Verify user is authenticated
$user = verifyAuth();
if (!$user) {
    exit(); // Error response is handled in verifyAuth()
}

// Handle GET request - Get comments for a confession
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Get confession_id from query parameter
    $confessionId = isset($_GET['confession_id']) ? sanitizeInput($_GET['confession_id']) : '';
    
    if (empty($confessionId)) {
        http_response_code(400); // Bad Request
        echo json_encode(['success' => false, 'message' => 'Confession ID is required']);
        exit();
    }
    
    // Get database connection
    $conn = getDbConnection();
    
    // Check if the confession exists
    $checkStmt = $conn->prepare("SELECT id, wall_id FROM wall_confessions WHERE id = ?");
    $checkStmt->bind_param("i", $confessionId);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    
    if ($checkResult->num_rows === 0) {
        http_response_code(404); // Not Found
        echo json_encode(['success' => false, 'message' => 'Confession not found']);
        $checkStmt->close();
        $conn->close();
        exit();
    }
    
    $confessionData = $checkResult->fetch_assoc();
    $wallInternalId = $confessionData['wall_id'];
    $checkStmt->close();
    
    // Check if user is a member of the wall this confession belongs to
    $memberCheckStmt = $conn->prepare("
        SELECT id FROM wall_members 
        WHERE wall_id = ? AND user_id = ?
    ");
    $memberCheckStmt->bind_param("ii", $wallInternalId, $user['id']);
    $memberCheckStmt->execute();
    $memberResult = $memberCheckStmt->get_result();
    
    if ($memberResult->num_rows === 0) {
        http_response_code(403); // Forbidden
        echo json_encode(['success' => false, 'message' => 'You are not a member of this wall']);
        $memberCheckStmt->close();
        $conn->close();
        exit();
    }
    $memberCheckStmt->close();
    
    // Get comments for the confession
    $commentStmt = $conn->prepare("
        SELECT 
            cc.id,
            u.id as user_id,
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
    $commentStmt->bind_param("i", $confessionId);
    $commentStmt->execute();
    $commentResult = $commentStmt->get_result();
    
    $comments = [];
    while ($comment = $commentResult->fetch_assoc()) {
        // Check if the user has liked this comment
        $likeCheckStmt = $conn->prepare("
            SELECT id FROM comment_likes 
            WHERE comment_id = ? AND user_id = ?
        ");
        $likeCheckStmt->bind_param("ii", $comment['id'], $user['id']);
        $likeCheckStmt->execute();
        $likeResult = $likeCheckStmt->get_result();
        $isLiked = $likeResult->num_rows > 0;
        $likeCheckStmt->close();
        
        // Get replies for this comment
        $replyStmt = $conn->prepare("
            SELECT 
                cr.id,
                u.id as user_id,
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
                'userId' => $reply['user_id'],
                'userName' => $reply['user_name'],
                'userAvatar' => $reply['user_avatar'] ?: 'https://i.pravatar.cc/150',
                'text' => $reply['text'],
                'timestamp' => $reply['timestamp']
            ];
        }
        $replyStmt->close();
        
        $comments[] = [
            'id' => $comment['id'],
            'userId' => $comment['user_id'],
            'userName' => $comment['user_name'],
            'userAvatar' => $comment['user_avatar'] ?: 'https://i.pravatar.cc/150',
            'text' => $comment['text'],
            'timestamp' => $comment['timestamp'],
            'likes' => (int)$comment['likes'],
            'isLiked' => $isLiked,
            'replies' => $replies
        ];
    }
    $commentStmt->close();
    
    // Return the comments
    echo json_encode([
        'success' => true,
        'message' => 'Comments retrieved successfully',
        'comments' => $comments
    ]);
    
    $conn->close();
}
// Handle POST request - Add a comment to a confession or a reply to a comment
else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get data from request body
    $data = json_decode(file_get_contents('php://input'), true);
    $confessionId = isset($data['confession_id']) ? sanitizeInput($data['confession_id']) : '';
    $commentId = isset($data['comment_id']) ? sanitizeInput($data['comment_id']) : '';
    $text = isset($data['text']) ? sanitizeInput($data['text']) : '';
    
    // Check if this is a comment or a reply
    $isReply = !empty($commentId);
    
    if ($isReply) {
        debugLog("Adding reply - Comment ID: $commentId, User ID: {$user['id']}, Text: $text");
        
        if (empty($commentId) || empty($text)) {
            http_response_code(400); // Bad Request
            echo json_encode(['success' => false, 'message' => 'Comment ID and reply text are required']);
            exit();
        }
        
        // Get database connection
        $conn = getDbConnection();
        
        // Check if the comment exists and get the wall_id
        $checkStmt = $conn->prepare("
            SELECT cc.id, wc.wall_id 
            FROM confession_comments cc
            JOIN wall_confessions wc ON cc.confession_id = wc.id
            WHERE cc.id = ?
        ");
        $checkStmt->bind_param("i", $commentId);
        $checkStmt->execute();
        $checkResult = $checkStmt->get_result();
        
        if ($checkResult->num_rows === 0) {
            http_response_code(404); // Not Found
            echo json_encode(['success' => false, 'message' => 'Comment not found']);
            $checkStmt->close();
            $conn->close();
            exit();
        }
        
        $commentData = $checkResult->fetch_assoc();
        $wallInternalId = $commentData['wall_id'];
        $checkStmt->close();
        
        // Check if user is a member of the wall this comment belongs to
        $memberCheckStmt = $conn->prepare("
            SELECT id FROM wall_members 
            WHERE wall_id = ? AND user_id = ?
        ");
        $memberCheckStmt->bind_param("ii", $wallInternalId, $user['id']);
        $memberCheckStmt->execute();
        $memberResult = $memberCheckStmt->get_result();
        
        if ($memberResult->num_rows === 0) {
            http_response_code(403); // Forbidden
            echo json_encode(['success' => false, 'message' => 'You are not a member of this wall']);
            $memberCheckStmt->close();
            $conn->close();
            exit();
        }
        $memberCheckStmt->close();
        
        // Insert the reply
        $stmt = $conn->prepare("
            INSERT INTO comment_replies (comment_id, user_id, text, created_at) 
            VALUES (?, ?, ?, NOW())
        ");
        $stmt->bind_param("iis", $commentId, $user['id'], $text);
        
        if ($stmt->execute()) {
            $replyId = $stmt->insert_id;
            $stmt->close();
            
            // Get the created reply details
            $getStmt = $conn->prepare("
                SELECT 
                    cr.id,
                    u.id as user_id,
                    u.name as user_name,
                    u.profile_pic as user_avatar,
                    cr.text,
                    cr.created_at as timestamp
                FROM comment_replies cr
                JOIN users u ON cr.user_id = u.id
                WHERE cr.id = ?
            ");
            $getStmt->bind_param("i", $replyId);
            $getStmt->execute();
            $result = $getStmt->get_result();
            $reply = $result->fetch_assoc();
            $getStmt->close();
            
            debugLog("Reply added successfully. Reply ID: $replyId");
            
            // Return success with the new reply
            echo json_encode([
                'success' => true,
                'message' => 'Reply added successfully',
                'reply' => [
                    'id' => $reply['id'],
                    'userId' => $reply['user_id'],
                    'userName' => $reply['user_name'],
                    'userAvatar' => $reply['user_avatar'] ?: 'https://i.pravatar.cc/150',
                    'text' => $reply['text'],
                    'timestamp' => $reply['timestamp']
                ]
            ]);
        } else {
            debugLog("Error adding reply: " . $conn->error);
            
            http_response_code(500); // Internal Server Error
            echo json_encode(['success' => false, 'message' => 'Failed to add reply: ' . $conn->error]);
            $stmt->close();
        }
        
        $conn->close();
        exit();
    }
    
    // This is a comment to a confession (not a reply)
    debugLog("Adding comment - Confession ID: $confessionId, User ID: {$user['id']}, Text: $text");
    
    if (empty($confessionId) || empty($text)) {
        http_response_code(400); // Bad Request
        echo json_encode(['success' => false, 'message' => 'Confession ID and comment text are required']);
        exit();
    }
    
    // Get database connection
    $conn = getDbConnection();
    
    // Check if the confession exists
    $checkStmt = $conn->prepare("SELECT id, wall_id FROM wall_confessions WHERE id = ?");
    $checkStmt->bind_param("i", $confessionId);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    
    if ($checkResult->num_rows === 0) {
        http_response_code(404); // Not Found
        echo json_encode(['success' => false, 'message' => 'Confession not found']);
        $checkStmt->close();
        $conn->close();
        exit();
    }
    
    $confessionData = $checkResult->fetch_assoc();
    $wallInternalId = $confessionData['wall_id'];
    $checkStmt->close();
    
    // Check if user is a member of the wall this confession belongs to
    $memberCheckStmt = $conn->prepare("
        SELECT id FROM wall_members 
        WHERE wall_id = ? AND user_id = ?
    ");
    $memberCheckStmt->bind_param("ii", $wallInternalId, $user['id']);
    $memberCheckStmt->execute();
    $memberResult = $memberCheckStmt->get_result();
    
    if ($memberResult->num_rows === 0) {
        http_response_code(403); // Forbidden
        echo json_encode(['success' => false, 'message' => 'You are not a member of this wall']);
        $memberCheckStmt->close();
        $conn->close();
        exit();
    }
    $memberCheckStmt->close();
    
    // Insert the comment
    $stmt = $conn->prepare("
        INSERT INTO confession_comments (confession_id, user_id, text, created_at) 
        VALUES (?, ?, ?, NOW())
    ");
    $stmt->bind_param("iis", $confessionId, $user['id'], $text);
    
    if ($stmt->execute()) {
        $commentId = $stmt->insert_id;
        $stmt->close();
        
        // Get the created comment details
        $getStmt = $conn->prepare("
            SELECT 
                cc.id,
                u.id as user_id,
                u.name as user_name,
                u.profile_pic as user_avatar,
                cc.text,
                cc.created_at as timestamp
            FROM confession_comments cc
            JOIN users u ON cc.user_id = u.id
            WHERE cc.id = ?
        ");
        $getStmt->bind_param("i", $commentId);
        $getStmt->execute();
        $result = $getStmt->get_result();
        $comment = $result->fetch_assoc();
        $getStmt->close();
        
        debugLog("Comment added successfully. Comment ID: $commentId");
        
        // Return success with the new comment
        echo json_encode([
            'success' => true,
            'message' => 'Comment added successfully',
            'comment' => [
                'id' => $comment['id'],
                'userId' => $comment['user_id'],
                'userName' => $comment['user_name'],
                'userAvatar' => $comment['user_avatar'] ?: 'https://i.pravatar.cc/150',
                'text' => $comment['text'],
                'timestamp' => $comment['timestamp'],
                'likes' => 0,
                'isLiked' => false,
                'replies' => []
            ]
        ]);
    } else {
        debugLog("Error adding comment: " . $conn->error);
        
        http_response_code(500); // Internal Server Error
        echo json_encode(['success' => false, 'message' => 'Failed to add comment: ' . $conn->error]);
        $stmt->close();
    }
    
    $conn->close();
}
// Handle unsupported request methods
else {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}