<?php
/**
 * Wall Members API
 * This endpoint returns a list of members for a specific wall
 */

// Include direct CORS handling at the very beginning
require_once '../config/direct_cors.php';

// Set content type to JSON
header('Content-Type: application/json');

// Include configuration files
require_once '../config/database.php';
require_once '../utils/auth.php';

// Only allow GET requests for wall members
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

// Check if the wall exists and user is a member of it
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

// Query to get all wall members with profile information
$stmt = $conn->prepare("
    SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.profile_pic as avatar,
        wm.joined_at,
        (SELECT COUNT(*) FROM wall_crushes wc WHERE wc.wall_id = ? AND wc.crush_on = u.id) as crush_count,
        (SELECT crush_on FROM wall_crushes wc WHERE wc.wall_id = ? AND wc.user_id = u.id) as has_crush_on,
        (SELECT created_at FROM wall_crushes wc WHERE wc.wall_id = ? AND wc.user_id = u.id) as crush_set_time
    FROM users u
    JOIN wall_members wm ON u.id = wm.user_id
    WHERE wm.wall_id = ?
    ORDER BY wm.joined_at ASC
");
$stmt->bind_param("iiii", $internalWallId, $internalWallId, $internalWallId, $internalWallId);
$stmt->execute();
$result = $stmt->get_result();

// Prepare members array
$members = [];
while ($row = $result->fetch_assoc()) {
    $members[] = [
        'id' => $row['id'],
        'name' => $row['name'],
        'email' => $row['email'],
        'avatar' => $row['avatar'] ? $row['avatar'] : 'https://bit.ly/broken-link',
        'joined_at' => $row['joined_at'],
        'crushCount' => (int)$row['crush_count'],
        'hasCrushOn' => $row['has_crush_on'] ? (int)$row['has_crush_on'] : null,
        'crushSetTime' => $row['crush_set_time'] ?? null
    ];
}
$stmt->close();

// Return the list of members
echo json_encode([
    'success' => true,
    'message' => 'Wall members retrieved successfully',
    'current_user_id' => $user['id'],
    'members' => $members
]);

// Close connection
$conn->close(); 