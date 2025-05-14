<?php
/**
 * Session Configuration
 * This file contains settings for session management
 */

// Log important session information
if (function_exists('debugLog')) {
    debugLog('Session config - Current session status: ' . session_status());
}

// Ensure session directory is writable
$sessionSavePath = ini_get('session.save_path');
if (empty($sessionSavePath) && function_exists('debugLog')) {
    debugLog('Session config - No session.save_path defined in php.ini');
}

// Set session cookie name
session_name('wink_trap_session');

// Set session lifetime to 30 days (in seconds)
$session_lifetime = 30 * 24 * 60 * 60; // 30 days

// Configure session garbage collection
ini_set('session.gc_maxlifetime', $session_lifetime);

// Set session cookie parameters for better persistence
if (PHP_VERSION_ID >= 70300) {
    // PHP 7.3 and above
    $sessionParams = [
        'lifetime' => $session_lifetime,
        'path' => '/',
        'domain' => '',  // Current domain
        'secure' => isset($_SERVER['HTTPS']), // Secure if HTTPS
        'httponly' => true, // Not accessible via JavaScript
        'samesite' => 'Lax' // Allow cross-site cookies for your app but with some protection
    ];
    
    if (function_exists('debugLog')) {
        debugLog('Session config - Setting cookie params (PHP 7.3+): ' . json_encode($sessionParams));
    }
    
    session_set_cookie_params($sessionParams);
} else {
    // Older PHP versions
    if (function_exists('debugLog')) {
        debugLog('Session config - Setting cookie params (pre PHP 7.3)');
    }
    
    session_set_cookie_params(
        $session_lifetime,
        '/',
        '',
        isset($_SERVER['HTTPS']),
        true
    );
}

// Set session cookie
if (!isset($_COOKIE[session_name()])) {
    setcookie(
        session_name(),
        session_id(),
        time() + $session_lifetime,
        '/',
        '',
        isset($_SERVER['HTTPS']),
        true
    );
}

// Start the session if it's not already started
if (session_status() == PHP_SESSION_NONE) {
    if (function_exists('debugLog')) {
        debugLog('Session config - Starting new session');
    }
    
    $result = session_start();
    
    if (function_exists('debugLog')) {
        debugLog('Session config - Session start result: ' . ($result ? 'success' : 'failed'));
        debugLog('Session config - New session ID: ' . session_id());
    }
}

/**
 * Function to regenerate session ID periodically for security
 * This helps prevent session fixation attacks
 */
function regenerateSessionIfNeeded() {
    // Regenerate session ID every 30 minutes
    $regenerate_period = 30 * 60; // 30 minutes
    
    if (!isset($_SESSION['last_regeneration']) || 
        (time() - $_SESSION['last_regeneration']) > $regenerate_period) {
        
        if (function_exists('debugLog')) {
            debugLog('Session regeneration - Regenerating session ID');
            debugLog('Session regeneration - Old session ID: ' . session_id());
        }
        
        // Regenerate session ID
        session_regenerate_id(true);
        
        // Update regeneration time
        $_SESSION['last_regeneration'] = time();
        
        if (function_exists('debugLog')) {
            debugLog('Session regeneration - New session ID: ' . session_id());
        }
    }
} 