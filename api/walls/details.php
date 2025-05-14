<?php
/**
 * Wall Details API
 * This endpoint returns details about a specific wall
 */

// Include direct CORS handling at the very beginning
require_once '../config/direct_cors.php';

// Set content type to JSON
header('Content-Type: application/json');

// Include configuration files
require_once '../config/database.php';
require_once '../utils/auth.php';

// Only allow GET requests for wall details
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

// Verify user is authenticated
$user = verifyAuth();
if (!$user) {
    exit(); // Error response is handled in verifyAuth()
}

// Get wall_id from query parameter
$wallId = isset($_GET['id']) ? sanitizeInput($_GET['id']) : '';

if (empty($wallId)) {
    http_response_code(400); // Bad Request
    echo json_encode(['success' => false, 'message' => 'Wall ID is required']);
    exit();
}

// Get database connection
$conn = getDbConnection();

// Check if the user is a member of this wall
$memberCheckStmt = $conn->prepare("
    SELECT wm.id
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
$memberCheckStmt->close();

// Query to get wall details
$stmt = $conn->prepare("
    SELECT w.id, w.wall_id, w.name, w.description, w.image_url, w.created_by, w.created_at,
           (SELECT COUNT(*) FROM wall_members WHERE wall_id = w.id) as member_count,
           (SELECT email FROM users WHERE id = w.created_by) as creator_email
    FROM walls w
    WHERE w.wall_id = ?
");
$stmt->bind_param("s", $wallId);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    http_response_code(404); // Not Found
    echo json_encode(['success' => false, 'message' => 'Wall not found']);
    $stmt->close();
    $conn->close();
    exit();
}

$wallData = $result->fetch_assoc();
$stmt->close();

// Format the response
$response = [
    'success' => true,
    'message' => 'Wall details retrieved successfully',
    'wall' => [
        'id' => $wallData['wall_id'],
        'name' => $wallData['name'],
        'description' => $wallData['description'] ?? '',
        'image' => $wallData['image_url'],
        'members' => $wallData['member_count'],
        'created_at' => $wallData['created_at'],
        'created_by' => $wallData['creator_email']
    ]
];

// Return the wall details
echo json_encode($response);

// Close connection
$conn->close(); 