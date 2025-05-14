<?php
/**
 * CORS Configuration
 * This file manages Cross-Origin Resource Sharing (CORS) headers for API requests
 */

// Check if we have a debugLog function
if (function_exists('debugLog')) {
    debugLog('CORS configuration loading');
}

// Enable strict error handling but prevent display
error_reporting(E_ALL);
ini_set('display_errors', 0);

// Function to configure CORS headers for API endpoints
function configureCors() {
    try {
        // Check if headers were already sent
        if (headers_sent($file, $line)) {
            if (function_exists('debugLog')) {
                debugLog("CORS Warning: Headers already sent in $file on line $line");
            }
            return false;
        }
        
        // Disable error display in output (important for JSON responses)
        ini_set('display_errors', 0);
        error_reporting(E_ALL);
        
        // Get the request origin
        $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
        
        // Define allowed origins
        $allowedOrigins = [
            'http://localhost:3000',   // Next.js development server
            'http://localhost',        // Direct access
            'http://127.0.0.1:3000',   // Alternative local address
            'http://127.0.0.1',        // Alternative direct access
            // Add your production domain here when ready
        ];
        
        // Check if Access-Control-Allow-Origin hasn't been set yet by Apache
        // to avoid duplicate headers
        if (!headers_list_contains('Access-Control-Allow-Origin')) {
            // Check if the origin is allowed
            if (in_array($origin, $allowedOrigins)) {
                header("Access-Control-Allow-Origin: $origin");
                if (function_exists('debugLog')) {
                    debugLog('CORS: Origin matched an allowed origin: ' . $origin);
                }
            } else if (!empty($origin)) {
                // For development, allow the request origin if it exists
                header("Access-Control-Allow-Origin: $origin");
                if (function_exists('debugLog')) {
                    debugLog('CORS: Using non-allowed origin: ' . $origin);
                }
            } else {
                // Fallback to the first allowed origin
                header("Access-Control-Allow-Origin: {$allowedOrigins[0]}");
                if (function_exists('debugLog')) {
                    debugLog('CORS: No origin in request, using default: ' . $allowedOrigins[0]);
                }
            }
        } else {
            if (function_exists('debugLog')) {
                debugLog('CORS: Access-Control-Allow-Origin already set, not setting again');
            }
        }
        
        // Set other CORS headers if they haven't been set yet
        if (!headers_list_contains('Access-Control-Allow-Methods')) {
            header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
        }
        
        if (!headers_list_contains('Access-Control-Allow-Headers')) {
            header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
        }
        
        if (!headers_list_contains('Access-Control-Allow-Credentials')) {
            header("Access-Control-Allow-Credentials: true");
        }
        
        if (!headers_list_contains('Access-Control-Max-Age')) {
            header("Access-Control-Max-Age: 86400"); // 24 hours
        }

        if (function_exists('debugLog')) {
            debugLog('CORS headers set successfully');
            debugLog('Request method: ' . ($_SERVER['REQUEST_METHOD'] ?? 'Not set'));
            debugLog('Origin header: ' . ($_SERVER['HTTP_ORIGIN'] ?? 'Not set'));
        }
        
        // Handle preflight OPTIONS requests
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            if (function_exists('debugLog')) {
                debugLog('CORS: Handling OPTIONS preflight request');
            }
            
            // For OPTIONS requests, return 200 OK with CORS headers only
            http_response_code(200);
            exit;
        }
        
        // Always set JSON content type for API responses unless it's an OPTIONS request
        if ($_SERVER['REQUEST_METHOD'] !== 'OPTIONS' && !headers_list_contains('Content-Type')) {
            header('Content-Type: application/json');
        }
        
        // Set session cookie parameters for better security and cross-domain compatibility
        if (PHP_VERSION_ID >= 70300) {
            // PHP 7.3 and above
            $sessionParams = [
                'lifetime' => 86400, // 1 day
                'path' => '/',
                'domain' => '', // Current domain
                'secure' => isset($_SERVER['HTTPS']), // Secure if HTTPS
                'httponly' => true, // Not accessible via JavaScript
                'samesite' => 'None' // Allow cross-site cookies for your app
            ];
            
            if (function_exists('debugLog')) {
                debugLog('CORS: Setting session cookie params (PHP 7.3+)');
            }
            session_set_cookie_params($sessionParams);
        } else {
            // Older PHP versions
            $lifetime = 86400; // 1 day
            $path = '/';
            $domain = ''; // Current domain
            $secure = isset($_SERVER['HTTPS']); // Secure if HTTPS
            $httponly = true; // Not accessible via JavaScript
            
            if (function_exists('debugLog')) {
                debugLog('CORS: Setting session cookie params (older PHP)');
            }
            session_set_cookie_params(
                $lifetime,
                $path,
                $domain,
                $secure,
                $httponly
            );
        }
        
        return true;
    } catch (Exception $e) {
        if (function_exists('debugLog')) {
            debugLog('CORS ERROR: ' . $e->getMessage());
        }
        return false;
    }
}

// Helper function to check if a header already exists in the headers list
function headers_list_contains($header_name) {
    $headers = headers_list();
    $header_name_lower = strtolower($header_name);
    
    foreach ($headers as $header) {
        // Split the header on the colon to get the header name
        $parts = explode(':', $header, 2);
        if (count($parts) === 2) {
            $existing_header_name = trim($parts[0]);
            if (strtolower($existing_header_name) === $header_name_lower) {
                return true;
            }
        }
    }
    return false;
}

// Register a custom error handler to prevent PHP errors from breaking JSON output
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    if (function_exists('debugLog')) {
        debugLog("PHP Error ($errno): $errstr in $errfile on line $errline");
    } else {
        error_log("PHP Error ($errno): $errstr in $errfile on line $errline");
    }
    return true; // Prevent standard error handler from running
});

// Call the function to configure CORS headers when this file is included
$corsResult = configureCors();

if (function_exists('debugLog')) {
    debugLog('CORS configuration result: ' . ($corsResult ? 'success' : 'failed'));
} 