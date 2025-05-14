<?php
/**
 * User Profile API
 * This endpoint handles retrieving and updating user profiles
 */

// Include direct CORS handling at the very beginning
require_once '../config/direct_cors.php';

// Create error logging function to debug CORS issues
function debugLog($message) {
    $logFile = __DIR__ . '/../../profile_debug.log';
    file_put_contents($logFile, date('[Y-m-d H:i:s] ') . $message . PHP_EOL, FILE_APPEND);
    error_log("[Profile API] " . $message);
}

// Polyfill for getallheaders if not available
if (!function_exists('getallheaders')) {
    function getallheaders() {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) === 'HTTP_') {
                $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
            }
        }
        return $headers;
    }
}

// Set error handler to catch all errors
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    debugLog("PHP Error ($errno): $errstr in $errfile on line $errline");
    return false; // Allow the standard error handler to run as well
});

// Suppress all PHP errors/warnings from outputting to allow clean JSON response
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Set content type to JSON
header('Content-Type: application/json');

debugLog("Request started with method: " . $_SERVER['REQUEST_METHOD']);
debugLog("Request URI: " . $_SERVER['REQUEST_URI']);

// Now load other configurations
require_once '../config/database.php';
require_once '../utils/auth.php';

// Log request details for debugging
debugLog("POST data: " . json_encode($_POST));
debugLog("FILES data: " . json_encode($_FILES));
debugLog("Headers: " . json_encode(getallheaders()));

try {
    // Verify user is authenticated
    $user = verifyAuth();
    if (!$user) {
        debugLog("Authentication failed in profile.php");
        exit(); // Error response is handled in verifyAuth()
    }

    // Log authenticated user
    debugLog("Authenticated user: " . json_encode($user));

    // Get database connection
    $conn = getDbConnection();

    // GET: Retrieve user profile
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        try {
            // Query to get user profile data
            $stmt = $conn->prepare("SELECT id, name, email, profile_pic FROM users WHERE id = ?");
            $stmt->bind_param("i", $user['id']);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result->num_rows === 0) {
                http_response_code(404); // Not Found
                echo json_encode(['success' => false, 'message' => 'User not found']);
            } else {
                $profileData = $result->fetch_assoc();
                
                // Return profile data
                echo json_encode([
                    'success' => true,
                    'message' => 'Profile retrieved successfully',
                    'data' => [
                        'id' => $profileData['id'],
                        'name' => $profileData['name'],
                        'email' => $profileData['email'],
                        'profile_pic' => $profileData['profile_pic'] ?: 'https://i.pravatar.cc/150' // Default if null
                    ]
                ]);
            }
            
            $stmt->close();
        } catch (Exception $e) {
            debugLog("Profile GET error: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error retrieving profile']);
        }
    }
    // PUT/POST: Update user profile
    else if ($_SERVER['REQUEST_METHOD'] === 'POST' || $_SERVER['REQUEST_METHOD'] === 'PUT') {
        try {
            debugLog("Starting profile update process");
            
            // Get data
            $name = isset($_POST['name']) ? trim($_POST['name']) : null;
            $email = isset($_POST['email']) ? trim($_POST['email']) : null;
            
            debugLog("Received name: " . ($name ?: 'null'));
            debugLog("Received email: " . ($email ?: 'null'));
            
            // Make sure upload directory exists
            $uploadDir = __DIR__ . '/../uploads/profiles/';
            debugLog("Using upload directory: " . $uploadDir);
            
            if (!file_exists($uploadDir)) {
                debugLog("Creating upload directory: " . $uploadDir);
                if (!mkdir($uploadDir, 0755, true)) {
                    $phpError = error_get_last();
                    debugLog("Failed to create directory: " . $uploadDir . " - Error: " . ($phpError ? $phpError['message'] : 'Unknown error'));
                    http_response_code(500);
                    echo json_encode(['success' => false, 'message' => 'Server error: Failed to create upload directory']);
                    exit();
                }
            } else {
                debugLog("Upload directory exists");
            }
            
            // Check if directory is writable
            if (!is_writable($uploadDir)) {
                debugLog("Upload directory is not writable: " . $uploadDir);
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Server error: Upload directory is not writable']);
                exit();
            } else {
                debugLog("Upload directory is writable");
            }
            
            // Prepare for database update
            $profilePicPath = null;
            $updateFields = [];
            $queryParams = [];
            $paramTypes = "";
            
            // Handle profile picture upload
            if (isset($_FILES['profile_pic']) && $_FILES['profile_pic']['error'] === UPLOAD_ERR_OK) {
                $tempFile = $_FILES['profile_pic']['tmp_name'];
                $fileName = $_FILES['profile_pic']['name'];
                $fileType = $_FILES['profile_pic']['type'];
                $fileSize = $_FILES['profile_pic']['size'];
                
                debugLog("Processing profile picture: $fileName ($fileType, $fileSize bytes)");
                
                // Validate file type
                $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                if (!in_array($fileType, $allowedTypes)) {
                    debugLog("Invalid file type: $fileType");
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => "Invalid file type. Only JPEG, PNG, GIF, and WEBP images are allowed."]);
                    exit();
                }
                
                // Generate unique filename
                $newFileName = 'profile_' . $user['id'] . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . pathinfo($fileName, PATHINFO_EXTENSION);
                $targetFile = $uploadDir . $newFileName;
                
                debugLog("Attempting to upload to: $targetFile");
                
                // Move the uploaded file
                if (move_uploaded_file($tempFile, $targetFile)) {
                    debugLog("File uploaded successfully");
                    // Update to use full URL with wink_trap base path and api/uploads
                    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
                    $host = $_SERVER['HTTP_HOST'];
                    $serverUrl = $protocol . '://' . $host . '/wink_trap';
                    $profilePicPath = $serverUrl . '/api/uploads/profiles/' . $newFileName;
                    debugLog("Profile picture URL set to: " . $profilePicPath);
                    
                    // Add to update fields
                    $updateFields[] = "profile_pic = ?";
                    $queryParams[] = $profilePicPath;
                    $paramTypes .= "s";
                } else {
                    $uploadError = error_get_last();
                    debugLog("Failed to upload file. Error: " . ($uploadError ? $uploadError['message'] : 'Unknown error'));
                    http_response_code(500);
                    echo json_encode(['success' => false, 'message' => 'Server error: Failed to upload profile picture']);
                    exit();
                }
            } else if (isset($_FILES['profile_pic'])) {
                $errorCode = $_FILES['profile_pic']['error'];
                $phpFileUploadErrors = [
                    0 => 'There is no error, the file uploaded with success',
                    1 => 'The uploaded file exceeds the upload_max_filesize directive in php.ini',
                    2 => 'The uploaded file exceeds the MAX_FILE_SIZE directive that was specified in the HTML form',
                    3 => 'The uploaded file was only partially uploaded',
                    4 => 'No file was uploaded',
                    6 => 'Missing a temporary folder',
                    7 => 'Failed to write file to disk',
                    8 => 'A PHP extension stopped the file upload',
                ];
                debugLog("File upload error code: " . $errorCode . " - " . ($phpFileUploadErrors[$errorCode] ?? 'Unknown error'));
            }
            
            // Add name to update fields if provided
            if (!empty($name)) {
                $updateFields[] = "name = ?";
                $queryParams[] = $name;
                $paramTypes .= "s";
                debugLog("Added name to update fields");
            }
            
            // Add email to update fields if provided
            if (!empty($email)) {
                // Validate email
                if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    debugLog("Invalid email format: $email");
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'Invalid email format']);
                    exit();
                }
                
                $updateFields[] = "email = ?";
                $queryParams[] = $email;
                $paramTypes .= "s";
                debugLog("Added email to update fields");
            }
            
            // If we have fields to update, update the database
            if (!empty($updateFields)) {
                debugLog("Updating " . count($updateFields) . " fields in database");
                
                // Build query
                $query = "UPDATE users SET " . implode(", ", $updateFields) . " WHERE id = ?";
                $queryParams[] = $user['id'];
                $paramTypes .= "i";
                
                debugLog("Update query: $query");
                debugLog("Param types: $paramTypes");
                
                // Execute query
                $stmt = $conn->prepare($query);
                if (!$stmt) {
                    debugLog("SQL prepare error: " . $conn->error);
                    http_response_code(500);
                    echo json_encode(['success' => false, 'message' => 'Database error: Failed to prepare query']);
                    exit();
                }
                
                // Bind parameters
                if (!$stmt->bind_param($paramTypes, ...$queryParams)) {
                    debugLog("Parameter binding error: " . $stmt->error);
                    http_response_code(500);
                    echo json_encode(['success' => false, 'message' => 'Database error: Failed to bind parameters']);
                    exit();
                }
                
                // Execute the query
                if (!$stmt->execute()) {
                    debugLog("Query execution error: " . $stmt->error);
                    http_response_code(500);
                    echo json_encode(['success' => false, 'message' => 'Database error: Failed to update profile']);
                    exit();
                }
                
                debugLog("Database update successful");
                $stmt->close();
                
                // Get updated profile
                $getStmt = $conn->prepare("SELECT id, name, email, profile_pic FROM users WHERE id = ?");
                $getStmt->bind_param("i", $user['id']);
                $getStmt->execute();
                $result = $getStmt->get_result();
                $updatedProfile = $result->fetch_assoc();
                $getStmt->close();
                
                $response = [
                    'success' => true,
                    'message' => 'Profile updated successfully',
                    'user' => [
                        'id' => $updatedProfile['id'],
                        'name' => $updatedProfile['name'],
                        'email' => $updatedProfile['email'],
                        'profile_pic' => $updatedProfile['profile_pic'] ?: 'https://i.pravatar.cc/150'
                    ],
                    'data' => [
                        'id' => $updatedProfile['id'],
                        'name' => $updatedProfile['name'],
                        'email' => $updatedProfile['email'],
                        'profile_pic' => $updatedProfile['profile_pic'] ?: 'https://i.pravatar.cc/150'
                    ]
                ];
                
                debugLog("Sending success response: " . json_encode($response));
                echo json_encode($response);
            } else {
                debugLog("No fields to update");
                
                // If no fields to update but we received a request, return current profile
                $getStmt = $conn->prepare("SELECT id, name, email, profile_pic FROM users WHERE id = ?");
                $getStmt->bind_param("i", $user['id']);
                $getStmt->execute();
                $result = $getStmt->get_result();
                $currentProfile = $result->fetch_assoc();
                $getStmt->close();
                
                $response = [
                    'success' => true,
                    'message' => 'No changes detected',
                    'user' => [
                        'id' => $currentProfile['id'],
                        'name' => $currentProfile['name'],
                        'email' => $currentProfile['email'],
                        'profile_pic' => $currentProfile['profile_pic'] ?: 'https://i.pravatar.cc/150'
                    ],
                    'data' => [
                        'id' => $currentProfile['id'],
                        'name' => $currentProfile['name'],
                        'email' => $currentProfile['email'],
                        'profile_pic' => $currentProfile['profile_pic'] ?: 'https://i.pravatar.cc/150'
                    ]
                ];
                
                debugLog("Sending no-change response: " . json_encode($response));
                echo json_encode($response);
            }
        } catch (Exception $e) {
            debugLog("Profile update exception: " . $e->getMessage() . "\nStack trace: " . $e->getTraceAsString());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    } else {
        // Method not allowed
        debugLog("Method not allowed: " . $_SERVER['REQUEST_METHOD']);
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
} catch (Exception $e) {
    debugLog("CRITICAL ERROR: " . $e->getMessage() . "\nStack trace: " . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

// Always close the database connection
if (isset($conn)) {
    $conn->close();
    debugLog("Database connection closed");
}

debugLog("Request completed"); 