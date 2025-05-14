<?php
/**
 * Wink Trap API
 * Main entry point and documentation
 */

// Include session configuration
require_once __DIR__ . '/config/session.php';

// Set content type to JSON for API documentation
header('Content-Type: application/json');

// Display API documentation
echo json_encode([
    'api' => 'Wink Trap API',
    'version' => '1.0.0',
    'description' => 'Backend API for Wink Trap application - a social platform for private conversation spaces',
    'endpoints' => [
        'auth' => [
            [
                'path' => '/api/auth/register.php',
                'method' => 'POST',
                'description' => 'Register a new user',
                'params' => ['name', 'email', 'password']
            ],
            [
                'path' => '/api/auth/login.php',
                'method' => 'POST',
                'description' => 'Login and get auth token',
                'params' => ['email', 'password', 'remember_me (optional)']
            ],
            [
                'path' => '/api/auth/logout.php',
                'method' => 'POST',
                'description' => 'Logout and invalidate session/token',
                'params' => []
            ],
            [
                'path' => '/api/auth/verify.php',
                'method' => 'GET',
                'description' => 'Verify authentication and get user data',
                'params' => []
            ]
        ],
        'walls' => [
            [
                'path' => '/api/walls/create.php',
                'method' => 'POST',
                'description' => 'Create a new Whispering Wall',
                'params' => ['name', 'password', 'wallId', 'image (optional)']
            ],
            [
                'path' => '/api/walls/join.php',
                'method' => 'POST',
                'description' => 'Join an existing Whispering Wall',
                'params' => ['wallId', 'password']
            ],
            [
                'path' => '/api/walls/list.php',
                'method' => 'GET',
                'description' => 'List all walls the user has joined',
                'params' => []
            ]
        ],
        'users' => [
            [
                'path' => '/api/users/profile.php',
                'method' => 'GET',
                'description' => 'Get user profile',
                'params' => []
            ],
            [
                'path' => '/api/users/profile.php',
                'method' => 'POST/PUT',
                'description' => 'Update user profile',
                'params' => ['name (optional)', 'profilePic (optional)']
            ]
        ]
    ],
    'notes' => [
        'Authentication is required for all endpoints except login and register',
        'Authentication is maintained via PHP sessions (cookies) and persistent login tokens',
        'API tokens can be provided in the Authorization header (Bearer token) or as a query parameter',
        'All responses are in JSON format',
        'This API uses HTTP status codes to indicate success/failure'
    ]
], JSON_PRETTY_PRINT); 