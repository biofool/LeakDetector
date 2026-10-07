<?php
// api-proxy.php — forwards /LeakDetector/{api,uploads}/* to the LeakDetector
// API on the origin VM. peec.biz is PHP-only shared hosting; this proxy keeps
// a single public URL (https://peec.biz/LeakDetector/...) so no CORS and no
// extra TLS cert is needed. Pattern follows coach-proxy.php (issue: deploy).
//
// Override the upstream with leak-proxy.local.php next to this file:
//   <?php $leak_api_origin = 'https://192-9-226-218.sslip.io';
$leak_api_origin = 'https://192-9-226-218.sslip.io';
$local = __DIR__ . '/leak-proxy.local.php';
if (file_exists($local)) require $local;

$uri = $_SERVER['REQUEST_URI'];
$rest = preg_replace('#^/LeakDetector/#', '', $uri);
if ($rest === $uri) { http_response_code(404); exit; } // not our prefix

// /LeakDetector/api/<x> → /api/v1/<x>; /LeakDetector/api/v1/<x> passes through;
// /LeakDetector/uploads/<x> → /uploads/<x>
if (str_starts_with($rest, 'api/v1/'))     $path = '/' . $rest;
elseif (str_starts_with($rest, 'api/'))   $path = '/api/v1/' . substr($rest, 4);
else                                      $path = '/' . $rest;

$ctype = $_SERVER['CONTENT_TYPE'] ?? '';
$multipart = str_starts_with($ctype, 'multipart/form-data');

$headers = ['X-Forwarded-For: ' . ($_SERVER['REMOTE_ADDR'] ?? ''), 'X-Forwarded-Proto: https'];
foreach (['HTTP_AUTHORIZATION' => 'Authorization', 'HTTP_ACCEPT' => 'Accept'] as $s => $h) {
    if (!empty($_SERVER[$s])) $headers[] = "$h: {$_SERVER[$s]}";
}
// multipart: PHP consumed php://input; rebuild via CURLFile and let curl set
// Content-Type/boundary. Other bodies: forward raw.
if (!$multipart && $ctype) $headers[] = "Content-Type: $ctype";

$ch = curl_init($leak_api_origin . $path);
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST   => $_SERVER['REQUEST_METHOD'],
    CURLOPT_RETURNTRANSFER  => true,
    CURLOPT_HEADER          => false,
    CURLOPT_HTTPHEADER      => $headers,
    CURLOPT_TIMEOUT         => 60,
]);
if ($multipart) {
    $post = $_POST;
    foreach ($_FILES as $name => $f) {
        if (is_uploaded_file($f['tmp_name'])) $post[$name] = new CURLFile($f['tmp_name'], $f['type'], $f['name']);
    }
    if ($post) curl_setopt($ch, CURLOPT_POSTFIELDS, $post);
} else {
    $body = file_get_contents('php://input');
    if ($body !== false && $body !== '') curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$resp = curl_exec($ch);
if ($resp === false) {
    error_log('leak-proxy upstream error: ' . curl_error($ch));
    http_response_code(502);
    header('Content-Type: application/json');
    echo '{"error":{"code":"upstream_unreachable","message":"api unreachable"}}';
    curl_close($ch);
    exit;
}
http_response_code(curl_getinfo($ch, CURLINFO_RESPONSE_CODE) ?: 502);
header('Content-Type: ' . (curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: 'application/json'));
curl_close($ch);
echo $resp;
