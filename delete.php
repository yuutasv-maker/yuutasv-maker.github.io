<?php
// =========================================================
// プロジェクト削除 API (ポータルからの削除用)
// =========================================================

header('Content-Type: application/json');

// 簡易トークン認証（不正アクセス防止）
$SECRET_TOKEN = 'antigravity-delete-2026';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$token = $input['token'] ?? '';
$project = $input['project'] ?? '';

if ($token !== $SECRET_TOKEN) {
    http_response_code(403);
    echo json_encode(['error' => 'Invalid token']);
    exit;
}

// プロジェクト名のバリデーション（ディレクトリトラバーサル防止）
if (empty($project) || preg_match('/[\/\\\\\.]{2,}|[^a-zA-Z0-9_\-]/', $project)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid project name']);
    exit;
}

$base_dir = __DIR__;
$target_dir = $base_dir . '/' . $project;

if (!is_dir($target_dir)) {
    http_response_code(404);
    echo json_encode(['error' => 'Project not found']);
    exit;
}

// 再帰的にディレクトリを削除
function deleteDir($dir) {
    if (!is_dir($dir)) return false;
    $items = array_diff(scandir($dir), ['.', '..']);
    foreach ($items as $item) {
        $path = $dir . '/' . $item;
        is_dir($path) ? deleteDir($path) : unlink($path);
    }
    return rmdir($dir);
}

$success = deleteDir($target_dir);

if ($success) {
    // index.html からカードを除去
    $index_path = $base_dir . '/index.html';
    if (file_exists($index_path)) {
        $html = file_get_contents($index_path);
        // data-project='PROJECT_NAME' を持つ wrapper div を丸ごと除去
        $pattern = "/<div class='project-card-wrapper' data-project='" . preg_quote($project, '/') . "'>[^§]*?<\/div>\s*<\/div>/s";
        $html = preg_replace($pattern, '', $html);
        file_put_contents($index_path, $html);
    }

    // .deploy_history からも除去（deploy.sh との同期用）
    $history_path = $base_dir . '/.deploy_history';
    if (file_exists($history_path)) {
        $lines = file($history_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        $lines = array_filter($lines, function($l) use ($project) { return trim($l) !== $project; });
        file_put_contents($history_path, implode("\n", $lines) . "\n");
    }

    echo json_encode(['success' => true, 'message' => "Deleted: $project"]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to delete']);
}
