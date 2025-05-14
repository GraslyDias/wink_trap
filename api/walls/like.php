<?php
/**
 * Wall Confession Like API
 * This endpoint handles liking/unliking confessions
 */

// Debug logging function
function debugLog($message) {
    // Uncomment to enable debug logging
    // error_log("LIKE_API: " . $message);
}

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

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

// Get POST data
$data = json_decode(file_get_contents('php://input'), true);
$confessionId = isset($data['confession_id']) ? sanitizeInput($data['confession_id']) : '';
$commentId = isset($data['comment_id']) ? sanitizeInput($data['comment_id']) : '';
$action = isset($data['action']) ? sanitizeInput($data['action']) : 'like'; // Default to like

debugLog("Request received - Confession ID: $confessionId, Comment ID: $commentId, Action: $action, User ID: {$user['id']}");

// Check that we have either a confession ID or a comment ID
if (empty($confessionId) && empty($commentId)) {
    http_response_code(400); // Bad Request
    echo json_encode(['success' => false, 'message' => 'Either Confession ID or Comment ID is required']);
    exit();
}

// Get database connection
$conn = getDbConnection();

// Handle comment like if comment_id is provided
if (!empty($commentId)) {
    // Check if the comment exists
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
    
    // Check if the user has already liked this comment
    $likeCheckStmt = $conn->prepare("
        SELECT id FROM comment_likes 
        WHERE comment_id = ? AND user_id = ?
    ");
    $likeCheckStmt->bind_param("ii", $commentId, $user['id']);
    $likeCheckStmt->execute();
    $likeCheckResult = $likeCheckStmt->get_result();
    $alreadyLiked = $likeCheckResult->num_rows > 0;
    $likeCheckStmt->close();
    
    // Handle like/unlike action for comments
    if ($action === 'like' && !$alreadyLiked) {
        debugLog("Adding like to comment - Comment ID: $commentId, User ID: {$user['id']}");
        
        // Add like
        $stmt = $conn->prepare("
            INSERT INTO comment_likes (comment_id, user_id, created_at) 
            VALUES (?, ?, NOW())
        ");
        $stmt->bind_param("ii", $commentId, $user['id']);
        
        if ($stmt->execute()) {
            $likeId = $stmt->insert_id;
            $stmt->close();
            
            // Get updated like count
            $countStmt = $conn->prepare("
                SELECT COUNT(*) as like_count 
                FROM comment_likes 
                WHERE comment_id = ?
            ");
            $countStmt->bind_param("i", $commentId);
            $countStmt->execute();
            $countResult = $countStmt->get_result();
            $likeCount = $countResult->fetch_assoc()['like_count'];
            $countStmt->close();
            
            debugLog("Comment like added successfully. New count: $likeCount");
            
            echo json_encode([
                'success' => true,
                'message' => 'Comment liked successfully',
                'like_count' => (int)$likeCount,
                'is_liked' => true
            ]);
        } else {
            debugLog("Error adding comment like: " . $conn->error);
            
            http_response_code(500); // Internal Server Error
            echo json_encode(['success' => false, 'message' => 'Failed to like comment: ' . $conn->error]);
            $stmt->close();
        }
    } else if ($action === 'unlike' && $alreadyLiked) {
        debugLog("Removing like from comment - Comment ID: $commentId, User ID: {$user['id']}");
        
        // Remove like
        $stmt = $conn->prepare("
            DELETE FROM comment_likes 
            WHERE comment_id = ? AND user_id = ?
        ");
        $stmt->bind_param("ii", $commentId, $user['id']);
        
        if ($stmt->execute()) {
            $stmt->close();
            
            // Get updated like count
            $countStmt = $conn->prepare("
                SELECT COUNT(*) as like_count 
                FROM comment_likes 
                WHERE comment_id = ?
            ");
            $countStmt->bind_param("i", $commentId);
            $countStmt->execute();
            $countResult = $countStmt->get_result();
            $likeCount = $countResult->fetch_assoc()['like_count'];
            $countStmt->close();
            
            debugLog("Comment like removed successfully. New count: $likeCount");
            
            echo json_encode([
                'success' => true,
                'message' => 'Comment unliked successfully',
                'like_count' => (int)$likeCount,
                'is_liked' => false
            ]);
        } else {
            debugLog("Error removing comment like: " . $conn->error);
            
            http_response_code(500); // Internal Server Error
            echo json_encode(['success' => false, 'message' => 'Failed to unlike comment: ' . $conn->error]);
            $stmt->close();
        }
    } else {
        // Already liked/unliked or invalid action
        $message = $alreadyLiked ? 'You have already liked this comment' : 'You have not liked this comment yet';
        debugLog("No action taken for comment - " . $message);
        
        // Get current like count
        $countStmt = $conn->prepare("
            SELECT COUNT(*) as like_count 
            FROM comment_likes 
            WHERE comment_id = ?
        ");
        $countStmt->bind_param("i", $commentId);
        $countStmt->execute();
        $countResult = $countStmt->get_result();
        $likeCount = $countResult->fetch_assoc()['like_count'];
        $countStmt->close();
        
        echo json_encode([
            'success' => true,
            'message' => $message,
            'like_count' => (int)$likeCount,
            'is_liked' => $alreadyLiked
        ]);
    }
    
    $conn->close();
    exit();
}

// For confessions - only execute this if we're not handling a comment
// Check if the confession exists
$checkStmt = $conn->prepare("
    SELECT id, wall_id FROM wall_confessions WHERE id = ?
");
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

// Check if the user has already liked this confession
$likeCheckStmt = $conn->prepare("
    SELECT id FROM confession_likes 
    WHERE confession_id = ? AND user_id = ?
");
$likeCheckStmt->bind_param("ii", $confessionId, $user['id']);
$likeCheckStmt->execute();
$likeCheckResult = $likeCheckStmt->get_result();
$alreadyLiked = $likeCheckResult->num_rows > 0;
$likeCheckStmt->close();

// Handle like/unlike action
if ($action === 'like' && !$alreadyLiked) {
    debugLog("Adding like - Confession ID: $confessionId, User ID: {$user['id']}");
    
    // Add like
    $stmt = $conn->prepare("
        INSERT INTO confession_likes (confession_id, user_id, created_at) 
        VALUES (?, ?, NOW())
    ");
    $stmt->bind_param("ii", $confessionId, $user['id']);
    
    if ($stmt->execute()) {
        $likeId = $stmt->insert_id;
        $stmt->close();
        
        // Get updated like count
        $countStmt = $conn->prepare("
            SELECT COUNT(*) as like_count 
            FROM confession_likes 
            WHERE confession_id = ?
        ");
        $countStmt->bind_param("i", $confessionId);
        $countStmt->execute();
        $countResult = $countStmt->get_result();
        $likeCount = $countResult->fetch_assoc()['like_count'];
        $countStmt->close();
        
        debugLog("Like added successfully. New count: $likeCount");
        
        echo json_encode([
            'success' => true,
            'message' => 'Confession liked successfully',
            'like_count' => (int)$likeCount
        ]);
    } else {
        debugLog("Error adding like: " . $conn->error);
        
        http_response_code(500); // Internal Server Error
        echo json_encode(['success' => false, 'message' => 'Failed to like confession: ' . $conn->error]);
        $stmt->close();
    }
} else if ($action === 'unlike' && $alreadyLiked) {
    debugLog("Removing like - Confession ID: $confessionId, User ID: {$user['id']}");
    
    // Remove like
    $stmt = $conn->prepare("
        DELETE FROM confession_likes 
        WHERE confession_id = ? AND user_id = ?
    ");
    $stmt->bind_param("ii", $confessionId, $user['id']);
    
    if ($stmt->execute()) {
        $stmt->close();
        
        // Get updated like count
        $countStmt = $conn->prepare("
            SELECT COUNT(*) as like_count 
            FROM confession_likes 
            WHERE confession_id = ?
        ");
        $countStmt->bind_param("i", $confessionId);
        $countStmt->execute();
        $countResult = $countStmt->get_result();
        $likeCount = $countResult->fetch_assoc()['like_count'];
        $countStmt->close();
        
        debugLog("Like removed successfully. New count: $likeCount");
        
        echo json_encode([
            'success' => true,
            'message' => 'Confession unliked successfully',
            'like_count' => (int)$likeCount
        ]);
    } else {
        debugLog("Error removing like: " . $conn->error);
        
        http_response_code(500); // Internal Server Error
        echo json_encode(['success' => false, 'message' => 'Failed to unlike confession: ' . $conn->error]);
        $stmt->close();
    }
} else {
    // Already liked/unliked or invalid action
    $message = $alreadyLiked ? 'You have already liked this confession' : 'You have not liked this confession yet';
    debugLog("No action taken - " . $message);
    
    // Get current like count
    $countStmt = $conn->prepare("
        SELECT COUNT(*) as like_count 
        FROM confession_likes 
        WHERE confession_id = ?
    ");
    $countStmt->bind_param("i", $confessionId);
    $countStmt->execute();
    $countResult = $countStmt->get_result();
    $likeCount = $countResult->fetch_assoc()['like_count'];
    $countStmt->close();
    
    echo json_encode([
        'success' => true,
        'message' => $message,
        'like_count' => (int)$likeCount,
        'already_liked' => $alreadyLiked
    ]);
}

// Close connection
$conn->close(); 