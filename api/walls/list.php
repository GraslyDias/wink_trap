<?php
/**
 * List Walls API
 * This endpoint returns a list of walls that the user has joined
 */

// Include direct CORS handling at the very beginning
require_once '../config/direct_cors.php';

// Set content type to JSON
header('Content-Type: application/json');

// Include configuration files
require_once '../config/database.php';
require_once '../utils/auth.php';

// Only allow GET requests for listing walls
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

// Get database connection
$conn = getDbConnection();

// Query to get all walls the user has joined
$stmt = $conn->prepare("
    SELECT w.id, w.wall_id, w.name, w.image_url, w.created_by,
           (SELECT COUNT(*) FROM wall_members WHERE wall_id = w.id) as member_count,
           (SELECT email FROM users WHERE id = w.created_by) as creator_email
    FROM walls w
    JOIN wall_members wm ON w.id = wm.wall_id
    WHERE wm.user_id = ?
    ORDER BY wm.joined_at DESC
");
$stmt->bind_param("i", $user['id']);
$stmt->execute();
$result = $stmt->get_result();

$walls = [];
while ($row = $result->fetch_assoc()) {
    $walls[] = [
        'id' => $row['wall_id'], // Use the custom wall ID
        'name' => $row['name'],
        'image' => $row['image_url'],
        'members' => $row['member_count'],
        'isJoined' => true,
        'createdBy' => $row['creator_email'] // Add creator's email
    ];
}

// Return the list of walls
echo json_encode([
    'success' => true,
    'message' => 'Walls retrieved successfully',
    'walls' => $walls
]);

// Close connection
$stmt->close();
$conn->close(); 