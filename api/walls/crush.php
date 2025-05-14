<?php
/**
 * Wall Crush API
 * This endpoint handles setting and removing crushes on other wall members
 */

// Include direct CORS handling at the very beginning
require_once '../config/direct_cors.php';

// Set content type to JSON
header('Content-Type: application/json');

// Include configuration files
require_once '../config/database.php';
require_once '../utils/auth.php';

// Only allow POST requests for crush operations
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
$wallId = isset($data['wall_id']) ? sanitizeInput($data['wall_id']) : '';
$action = isset($data['action']) ? sanitizeInput($data['action']) : '';

if (empty($wallId) || empty($action)) {
    http_response_code(400); // Bad Request
    echo json_encode(['success' => false, 'message' => 'Wall ID and action are required']);
    exit();
}

// Validate action
if (!in_array($action, ['set', 'remove'])) {
    http_response_code(400); // Bad Request
    echo json_encode(['success' => false, 'message' => 'Invalid action. Must be "set" or "remove"']);
    exit();
}

// For 'set' action, we need target_user_id
if ($action === 'set' && !isset($data['target_user_id'])) {
    http_response_code(400); // Bad Request
    echo json_encode(['success' => false, 'message' => 'Target user ID is required for set action']);
    exit();
}

$targetUserId = isset($data['target_user_id']) ? (int)sanitizeInput($data['target_user_id']) : 0;

// Get database connection
$conn = getDbConnection();

// Get the internal wall ID and check if user is a member
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

// Debug logging function
function debugLog($message) {
    // Debug logging is enabled for crush API to troubleshoot the 4-hour issue
    error_log("CRUSH_API: " . $message);
}

// Handle 'set' action
if ($action === 'set') {
    // Check if target user is a member of the wall
    $targetCheckStmt = $conn->prepare("
        SELECT id FROM wall_members 
        WHERE wall_id = ? AND user_id = ?
    ");
    $targetCheckStmt->bind_param("ii", $wallInternalId, $targetUserId);
    $targetCheckStmt->execute();
    $targetResult = $targetCheckStmt->get_result();
    
    if ($targetResult->num_rows === 0) {
        http_response_code(404); // Not Found
        echo json_encode(['success' => false, 'message' => 'Target user is not a member of this wall']);
        $targetCheckStmt->close();
        $conn->close();
        exit();
    }
    $targetCheckStmt->close();
    
    // Check if user already has a crush on someone else
    $crushCheckStmt = $conn->prepare("
        SELECT crush_on, created_at FROM wall_crushes 
        WHERE wall_id = ? AND user_id = ?
    ");
    $crushCheckStmt->bind_param("ii", $wallInternalId, $user['id']);
    $crushCheckStmt->execute();
    $crushResult = $crushCheckStmt->get_result();
    
    if ($crushResult->num_rows > 0) {
        $existingCrush = $crushResult->fetch_assoc();
        
        // If already has a crush on the same person, just return success
        if ((int)$existingCrush['crush_on'] === $targetUserId) {
            echo json_encode([
                'success' => true,
                'message' => 'You already have a crush on this person',
                'crushSetTime' => $existingCrush['created_at']
            ]);
            $crushCheckStmt->close();
            $conn->close();
            exit();
        }
        
        // Otherwise, update the existing crush
        $updateStmt = $conn->prepare("
            UPDATE wall_crushes 
            SET crush_on = ?, created_at = NOW() 
            WHERE wall_id = ? AND user_id = ?
        ");
        $updateStmt->bind_param("iii", $targetUserId, $wallInternalId, $user['id']);
        
        if ($updateStmt->execute()) {
            echo json_encode([
                'success' => true,
                'message' => 'Crush updated successfully',
                'crushSetTime' => date('Y-m-d H:i:s')
            ]);
        } else {
            http_response_code(500); // Internal Server Error
            echo json_encode(['success' => false, 'message' => 'Failed to update crush: ' . $conn->error]);
        }
        
        $updateStmt->close();
    } else {
        // Insert new crush
        $insertStmt = $conn->prepare("
            INSERT INTO wall_crushes (wall_id, user_id, crush_on, created_at)
            VALUES (?, ?, ?, NOW())
        ");
        $insertStmt->bind_param("iii", $wallInternalId, $user['id'], $targetUserId);
        
        if ($insertStmt->execute()) {
            echo json_encode([
                'success' => true,
                'message' => 'Crush set successfully',
                'crushSetTime' => date('Y-m-d H:i:s')
            ]);
        } else {
            http_response_code(500); // Internal Server Error
            echo json_encode(['success' => false, 'message' => 'Failed to set crush: ' . $conn->error]);
        }
        
        $insertStmt->close();
    }
    
    $crushCheckStmt->close();
}
// Handle 'remove' action
else if ($action === 'remove') {
    // Check if user has a crush to remove
    $crushCheckStmt = $conn->prepare("
        SELECT id, created_at FROM wall_crushes 
        WHERE wall_id = ? AND user_id = ?
    ");
    $crushCheckStmt->bind_param("ii", $wallInternalId, $user['id']);
    $crushCheckStmt->execute();
    $crushResult = $crushCheckStmt->get_result();
    
    if ($crushResult->num_rows === 0) {
        http_response_code(404); // Not Found
        echo json_encode(['success' => false, 'message' => 'You do not have a crush to remove']);
        $crushCheckStmt->close();
        $conn->close();
        exit();
    }
    
    $crush = $crushResult->fetch_assoc();
    $crushCheckStmt->close();
    
    // Check if 4 hours have passed since setting the crush
    $crushSetTime = new DateTime($crush['created_at']);
    $currentTime = new DateTime();
    
    // Log times for debugging
    debugLog("Crush set time: " . $crushSetTime->format('Y-m-d H:i:s'));
    debugLog("Current time: " . $currentTime->format('Y-m-d H:i:s'));
    
    // Calculate time difference in hours - use DateInterval for accurate calculation
    $interval = $currentTime->diff($crushSetTime);
    $totalHours = $interval->h + ($interval->days * 24);
    $totalMinutes = $interval->i;
    
    debugLog("Time difference: " . $totalHours . " hours and " . $totalMinutes . " minutes");
    $hoursSinceCrushSet = $totalHours + ($totalMinutes / 60);
    debugLog("Hours since crush set (decimal): " . $hoursSinceCrushSet);
    
    // Set the exact required waiting time in hours
    $requiredWaitingHours = 4;
    
    // Calculate when the crush will be removable
    $removableTime = clone $crushSetTime;
    $removableTime->add(new DateInterval('PT' . $requiredWaitingHours . 'H'));
    debugLog("Crush removable at: " . $removableTime->format('Y-m-d H:i:s'));
    
    // Check if we've reached the removable time
    $canRemove = $currentTime >= $removableTime;
    debugLog("Can remove crush? " . ($canRemove ? "Yes" : "No"));
    
    // Check for test mode - for debugging purposes
    $testMode = isset($data['test_mode']) && $data['test_mode'] === true;
    debugLog("Test mode enabled? " . ($testMode ? "Yes" : "No"));
    
    // Override time check in test mode or if 4 hours have passed
    if ($canRemove || $testMode) {
        debugLog("Removing crush - time check passed or test mode enabled");
        // Remove the crush
        $deleteStmt = $conn->prepare("
            DELETE FROM wall_crushes 
            WHERE wall_id = ? AND user_id = ?
        ");
        $deleteStmt->bind_param("ii", $wallInternalId, $user['id']);
        
        if ($deleteStmt->execute()) {
            echo json_encode([
                'success' => true,
                'message' => 'Crush removed successfully'
            ]);
        } else {
            http_response_code(500); // Internal Server Error
            echo json_encode(['success' => false, 'message' => 'Failed to remove crush: ' . $conn->error]);
        }
        
        $deleteStmt->close();
    } else {
        // Time check failed - user needs to wait longer
        // Calculate exact time remaining
        $timeRemainingInterval = $currentTime->diff($removableTime);
        $hoursRemaining = $timeRemainingInterval->h;
        $minutesRemaining = $timeRemainingInterval->i;
        
        if ($timeRemainingInterval->days > 0) {
            $hoursRemaining += $timeRemainingInterval->days * 24;
        }
        
        debugLog("Time remaining: " . $hoursRemaining . " hours and " . $minutesRemaining . " minutes");
        
        $timeMessage = '';
        if ($hoursRemaining > 0) {
            $timeMessage = $hoursRemaining . ' hour' . ($hoursRemaining !== 1 ? 's' : '');
            if ($minutesRemaining > 0) {
                $timeMessage .= ' and ' . $minutesRemaining . ' minute' . ($minutesRemaining !== 1 ? 's' : '');
            }
        } else {
            $timeMessage = $minutesRemaining . ' minute' . ($minutesRemaining !== 1 ? 's' : '');
        }
        
        debugLog("Time message: " . $timeMessage);
        
        http_response_code(400); // Bad Request
        echo json_encode([
            'success' => false, 
            'message' => 'You must wait at least 4 hours after setting a crush before removing it. Please wait ' . $timeMessage . ' more.',
            'timeRemaining' => [
                'hours' => $hoursRemaining,
                'minutes' => $minutesRemaining
            ],
            'crushSetTime' => $crushSetTime->format('Y-m-d H:i:s'),
            'removableAt' => $removableTime->format('Y-m-d H:i:s'),
            'currentTime' => $currentTime->format('Y-m-d H:i:s')
        ]);
        $conn->close();
        exit();
    }
}

// Close connection
$conn->close(); 