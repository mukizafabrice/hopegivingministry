<?php
declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');

$state_file = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'js' . DIRECTORY_SEPARATOR . 'live.json';
$admin_user = 'admin';
$admin_passwords = ['admin', 'hope2026', 'Hope2026'];

function send_json(int $status_code, array $data): void {
    http_response_code($status_code);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

function default_state(): array {
    return [
        'enabled' => false,
        'url' => '',
        'updatedAt' => 0
    ];
}

function read_state(string $file): array {
    if (!is_file($file)) {
        return default_state();
    }

    $json = file_get_contents($file);
    $state = $json === false ? null : json_decode($json, true);

    if (!is_array($state)) {
        return default_state();
    }

    return [
        'enabled' => !empty($state['enabled']),
        'url' => isset($state['url']) && is_string($state['url']) ? $state['url'] : '',
        'updatedAt' => isset($state['updatedAt']) ? (int)$state['updatedAt'] : 0
    ];
}

function write_state(string $file, array $state): bool {
    $directory = dirname($file);
    if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
        return false;
    }

    $json = json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        return false;
    }

    return file_put_contents($file, $json) !== false;
}

function normalize_url(string $url): string {
    $url = trim($url);
    if ($url === '') {
        return '';
    }

    $parsed = parse_url($url);
    $scheme = is_array($parsed) && isset($parsed['scheme']) ? strtolower((string)$parsed['scheme']) : '';

    if (!is_array($parsed) || empty($parsed['host']) || !in_array($scheme, ['http', 'https'], true)) {
        throw new InvalidArgumentException('Enter a valid http(s) stream URL.');
    }

    return $url;
}

function request_body(): array {
    $raw = file_get_contents('php://input');
    $data = $raw ? json_decode($raw, true) : $_POST;
    return is_array($data) ? $data : [];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    send_json(200, read_state($state_file));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_json(405, ['message' => 'Method not allowed.']);
}

$data = request_body();
$action = isset($data['action']) ? (string)$data['action'] : '';

if ($action === 'login') {
    $username = isset($data['username']) ? (string)$data['username'] : '';
    $password = isset($data['password']) ? (string)$data['password'] : '';

    if ($username === $admin_user && in_array($password, $admin_passwords, true)) {
        session_regenerate_id(true);
        $_SESSION['hgmAdmin'] = true;
        send_json(200, ['ok' => true]);
    }

    send_json(401, ['message' => 'Invalid username or password.']);
}

if ($action === 'save') {
    if (empty($_SESSION['hgmAdmin'])) {
        send_json(401, ['message' => 'Admin session expired. Please log in again.']);
    }

    $enabled = filter_var($data['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN);
    $url = isset($data['url']) ? trim((string)$data['url']) : '';

    try {
        $url = normalize_url($url);
    } catch (InvalidArgumentException $error) {
        send_json(400, ['message' => $error->getMessage()]);
    }

    if ($enabled && $url === '') {
        send_json(400, ['message' => 'Add a stream URL before turning live on.']);
    }

    if (!$enabled) {
        $url = '';
    }

    $state = [
        'enabled' => $enabled,
        'url' => $url,
        'updatedAt' => (int)(microtime(true) * 1000)
    ];

    if (!write_state($state_file, $state)) {
        send_json(500, ['message' => 'Unable to update live stream file.']);
    }

    send_json(200, ['ok' => true, 'state' => $state]);
}

if ($action === 'logout') {
    unset($_SESSION['hgmAdmin']);
    send_json(200, ['ok' => true]);
}

send_json(400, ['message' => 'Unknown action.']);
