<?php
// report.php — server-rendered public report page. .htaccess routes
// /LeakDetector/r/{id} and /LeakDetector/reports/{id} here, so the tracking
// page is readable without JavaScript (the React SPA is a client-rendered
// shell). Data comes from the same backend upstream as api-proxy.php.
// No JavaScript is used on this page at all.

$leak_api_origin = 'https://192-9-226-218.sslip.io';
$local = __DIR__ . '/leak-proxy.local.php';
if (file_exists($local)) require $local;

$BASE = '/LeakDetector';
$id = (int)($_GET['id'] ?? 0);
$confirmed = $_GET['confirmed'] ?? null;
$OPEN = ['received', 'investigating', 'contractor_assigned'];

function h(?string $s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

function api(string $origin, string $path, string $method = 'GET'): array {
  $ch = curl_init($origin . $path);
  curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_HTTPHEADER => ['Accept: application/json'],
  ]);
  $body = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  return [$code, $body === false ? null : json_decode((string)$body, true)];
}

// "I've seen it too" — plain form POST forwarded to the API, then PRG back.
if ($id > 0 && ($_POST['action'] ?? '') === 'confirm') {
  [$code, $resp] = api($leak_api_origin, "/api/v1/reports/$id/confirm", 'POST');
  $q = $code === 200 ? 'ok' : (($resp['error'] ?? '') === 'is_duplicate' ? 'duplicate' : 'error');
  header("Location: $BASE/r/$id?confirmed=$q");
  exit;
}

[$code, $r] = api($leak_api_origin, "/api/v1/reports/$id");

$LOC = ['footpath' => 'Footpath', 'berm' => 'Berm', 'road' => 'Road',
        'water_meter' => 'Water meter', 'outside_tap' => 'Outside tap',
        'other_public' => 'Other public place'];
$SEV = ['major' => 'Major', 'minor' => 'Minor'];
$STATUS = ['received' => 'Received', 'investigating' => 'Under investigation',
           'contractor_assigned' => 'Contractor assigned', 'resolved' => 'Resolved',
           'closed_private' => 'Private property'];
$SLA = ['on_track' => 'On track', 'due_soon' => 'Due soon', 'breached' => 'SLA breached'];
$STATUS_CLS = ['received' => 'b-blue', 'investigating' => 'b-amber',
               'contractor_assigned' => 'b-amber', 'resolved' => 'b-green',
               'closed_private' => 'b-slate'];

function nzdate(?string $iso): string {
  if (!$iso) return '';
  $d = new DateTime($iso);
  $d->setTimezone(new DateTimeZone('Pacific/Auckland'));
  return $d->format('j M Y, g:i a');
}

$host = ($_SERVER['HTTP_HOST'] ?? 'peec.biz');
$scheme = 'https';
$trackUrl = "$scheme://$host$BASE/r/$id";

$page = function (string $title, string $body) use ($trackUrl): void {
  header('Content-Type: text/html; charset=utf-8');
  echo '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    . '<meta name="viewport" content="width=device-width,initial-scale=1">'
    . '<link rel="canonical" href="' . h($trackUrl) . '">'
    . '<title>' . h($title) . ' — LeakDetector</title>'
    . '<style>
      body{font-family:system-ui,sans-serif;margin:0;background:#f8fafc;color:#0f172a}
      main{max-width:36rem;margin:0 auto;padding:1.5rem 1rem}
      .card{background:#fff;border:1px solid #e2e8f0;border-radius:1rem;padding:1rem;margin-top:1rem}
      h1{font-size:1.5rem;margin:0}
      .muted{color:#64748b;font-size:.875rem}
      .badge{display:inline-block;border-radius:999px;padding:.15rem .6rem;font-size:.75rem;font-weight:600}
      .b-blue{background:#dbeafe;color:#1e40af}.b-amber{background:#fef3c7;color:#92400e}
      .b-green{background:#d1fae5;color:#065f46}.b-slate{background:#e2e8f0;color:#475569}
      .note{background:#ecfeff;color:#155e75;border-radius:.5rem;padding:.75rem;font-size:.875rem}
      .photos{display:flex;gap:.5rem;flex-wrap:wrap}
      .photos img{height:5rem;width:5rem;object-fit:cover;border-radius:.5rem}
      .btn{display:inline-block;border:1px solid #0e7490;border-radius:.75rem;padding:.6rem 1rem;
           color:#155e75;font-weight:600;text-decoration:none;background:#fff;cursor:pointer;font-size:.9rem}
      .ok{background:#d1fae5;color:#065f46;border-radius:.75rem;padding:.75rem;font-size:.875rem}
      .err{background:#fee2e2;color:#991b1b;border-radius:.75rem;padding:.75rem;font-size:.875rem}
      ol.hist{padding-left:1.25rem;font-size:.85rem;color:#475569}
      a{color:#0e7490}
    </style></head><body><main>' . $body . '</main></body></html>';
};

if ($id <= 0 || $code === 404) {
  http_response_code(404);
  $page('Report not found', '<h1>Report not found</h1><p class="muted">No report with that reference.</p>');
  exit;
}
if (!$r) {
  http_response_code(502);
  $page('Report unavailable', '<h1>Report unavailable</h1><p class="muted">The report service did not respond. Try again shortly.</p>');
  exit;
}

$status = $r['status'] ?? 'received';
$c = $r['council_zone']['contact'] ?? [];
$hasContact = array_filter([$c['entity'] ?? null, $c['phone'] ?? null, $c['form_url'] ?? null, $c['app'] ?? null, $c['sms_number'] ?? null]);

$body = '<p><a href="' . $BASE . '/map">&larr; Map</a></p>'
  . '<h1>' . h($r['ref'] ?? "Report #$id") . ' <span class="badge ' . ($STATUS_CLS[$status] ?? 'b-slate') . '">' . h($STATUS[$status] ?? $status) . '</span></h1>'
  . '<p class="muted">' . h($LOC[$r['location_type'] ?? ''] ?? $r['location_type'] ?? '')
  . ' &middot; ' . h($SEV[$r['severity'] ?? ''] ?? $r['severity'] ?? '')
  . ' &middot; reported ' . h(nzdate($r['created_at'] ?? null)) . '</p>';

$body .= '<p class="muted">Location: ' . h(number_format((float)($r['lat'] ?? 0), 5)) . ', '
  . h(number_format((float)($r['lng'] ?? 0), 5))
  . ' &middot; <a href="https://www.openstreetmap.org/?mlat=' . h((string)($r['lat'] ?? '')) . '&mlon=' . h((string)($r['lng'] ?? '')) . '#map=18/' . h((string)($r['lat'] ?? '')) . '/' . h((string)($r['lng'] ?? '')) . '">view on map</a></p>';

$body .= '<div class="card">';
if (!empty($r['description'])) $body .= '<p>' . h($r['description']) . '</p>';
$badges = [];
if (!empty($r['sla_status']) && $status !== 'resolved') $badges[] = '<span class="badge b-amber">' . h($SLA[$r['sla_status']] ?? $r['sla_status']) . '</span>';
if (!empty($r['verified'])) $badges[] = '<span class="badge b-green">Verified by council</span>';
if (($r['confirmation_count'] ?? 0) > 0) $badges[] = '<span class="badge b-slate">' . (int)$r['confirmation_count'] . ' other(s) saw this too</span>';
if (!empty($r['is_duplicate_of'])) $badges[] = '<span class="badge b-slate">Duplicate of <a href="' . $BASE . '/r/' . (int)$r['is_duplicate_of'] . '">WL-' . str_pad((string)$r['is_duplicate_of'], 6, '0', STR_PAD_LEFT) . '</a></span>';
if ($badges) $body .= '<p>' . implode(' ', $badges) . '</p>';
if (!empty($r['public_note'])) $body .= '<p class="note">Council update: ' . h($r['public_note']) . '</p>';
if (!empty($r['photos'])) {
  $body .= '<div class="photos">';
  foreach ($r['photos'] as $p) {
    $body .= '<a href="' . h($p['url']) . '"><img src="' . h($p['thumb_url'] ?: $p['url']) . '" alt="leak photo"></a>';
  }
  $body .= '</div>';
}
$body .= '<p class="muted">' . h($r['council_zone']['council'] ?? '') . ' — ' . h($r['council_zone']['name'] ?? '')
  . (!empty($r['sla_due_at']) ? ' &middot; SLA due ' . h(nzdate($r['sla_due_at'])) : '') . '</p>';
$body .= '</div>';

// Council contact channels.
if ($hasContact) {
  $body .= '<div class="card"><h2 style="font-size:.95rem;margin:0 0 .5rem">Report it to the council directly</h2>';
  $body .= '<p class="muted">Serviced by ' . h($c['entity'] ?? $r['council_zone']['council'] ?? '') . '</p><p>';
  if (!empty($c['phone'])) {
    $tel = preg_replace('/[^\d+]/', '', explode('/', $c['phone'])[0]);
    $body .= '<a class="btn" href="tel:' . h($tel) . '">Call ' . h($c['phone']) . '</a> ';
  }
  if (!empty($c['sms_number'])) {
    $smsBody = 'Water leak, ' . ($r['category'] ?? '') . '. Lat ' . number_format((float)$r['lat'], 5) . ', long ' . number_format((float)$r['lng'], 5) . '. Photos: ' . $trackUrl;
    $body .= '<a class="btn" href="sms:' . h($c['sms_number']) . '?&body=' . rawurlencode($smsBody) . '">Text ' . h($c['sms_number']) . '</a> ';
  }
  if (!empty($c['form_url'])) $body .= '<a class="btn" href="' . h($c['form_url']) . '">Report online</a>';
  $body .= '</p>';
  if (!empty($c['app'])) $body .= '<p class="muted">You can also report via ' . h($c['app']) . '.</p>';
  $body .= '</div>';
}

// Status history — same flow as the SPA timeline.
if (!empty($r['status_history'])) {
  $body .= '<div class="card"><h2 style="font-size:.95rem;margin:0 0 .5rem">Status history</h2><ol class="hist">';
  foreach ($r['status_history'] as $s) {
    $body .= '<li>' . h($STATUS[$s['to_status']] ?? $s['to_status']) . ' — ' . h(nzdate($s['at'] ?? null)) . '</li>';
  }
  $body .= '</ol></div>';
}

// Confirm action / banners.
if ($confirmed === 'ok') $body .= '<p class="ok">Thanks — we have logged your confirmation.</p>';
elseif ($confirmed === 'duplicate') $body .= '<p class="err">This report is marked as a duplicate — please confirm the original instead.</p>';
elseif ($confirmed === 'error') $body .= '<p class="err">Could not record that confirmation. Try again shortly.</p>';

if (in_array($status, $OPEN, true)) {
  $body .= '<form method="post" action="' . $BASE . '/r/' . $id . '"><input type="hidden" name="action" value="confirm">'
    . '<button class="btn" type="submit">I&#8217;ve seen this leak too</button></form>';
}
if ($status === 'resolved') {
  $body .= '<p class="ok">Resolved' . (!empty($r['resolved_at']) ? ' — ' . h(nzdate($r['resolved_at'])) : '') . '</p>';
}

$page(($r['ref'] ?? "Report #$id"), $body);
