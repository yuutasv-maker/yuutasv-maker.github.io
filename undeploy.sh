#!/bin/bash
# =========================================================
# アンデプロイスクリプト (プロジェクト削除 & ポータル再生成)
# =========================================================

# 実行ディレクトリをスクリプトの場所に移動
cd "$(dirname "$0")"

# .env ファイルの読み込み
if [ ! -f .env ]; then
  echo "❌ エラー: .env ファイルが見つかりません。"
  exit 1
fi
export $(sed 's/#.*//' .env | xargs)

# 引数チェック
HISTORY_FILE=".deploy_history"
INPUT="$1"

if [ -z "$INPUT" ]; then
  echo "使い方: ./undeploy.sh <プロジェクト名 または 番号>"
  echo ""
  echo "📋 現在デプロイ済みのプロジェクト:"
  if [ -f "$HISTORY_FILE" ]; then
    cat -n "$HISTORY_FILE"
  else
    echo "  (なし)"
  fi
  exit 1
fi

# 番号が指定された場合、プロジェクト名に変換
if [[ "$INPUT" =~ ^[0-9]+$ ]]; then
  TARGET_NAME=$(sed -n "${INPUT}p" "$HISTORY_FILE" 2>/dev/null)
  if [ -z "$TARGET_NAME" ]; then
    echo "❌ エラー: 番号 ${INPUT} に対応するプロジェクトがありません。"
    echo ""
    echo "📋 現在デプロイ済みのプロジェクト:"
    cat -n "$HISTORY_FILE"
    exit 1
  fi
  echo "📌 番号 ${INPUT} → '${TARGET_NAME}' を選択しました。"
else
  TARGET_NAME="$INPUT"
fi

REMOTE_TARGET="${REMOTE_DIR%/}/${TARGET_NAME}"

# 履歴に存在するか確認
if ! grep -q "^${TARGET_NAME}$" "$HISTORY_FILE" 2>/dev/null; then
  echo "❌ エラー: '${TARGET_NAME}' はデプロイ履歴に見つかりません。"
  echo ""
  echo "📋 現在デプロイ済みのプロジェクト:"
  cat -n "$HISTORY_FILE"
  exit 1
fi

echo "🗑️  削除を開始します..."
echo "📂 対象: ${TARGET_NAME}"
echo "🌍 リモート: ${REMOTE_TARGET}"
echo "---------------------------------------------------"

# サーバー上のフォルダを削除
SSH_PORT=${SERVER_PORT:-22}
if command -v sshpass >/dev/null 2>&1 && [ -n "$SERVER_PASSWORD" ]; then
    sshpass -p "$SERVER_PASSWORD" ssh -p "${SSH_PORT}" -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_HOST}" "rm -rf ${REMOTE_TARGET}"
else
    ssh -p "${SSH_PORT}" "${SERVER_USER}@${SERVER_HOST}" "rm -rf ${REMOTE_TARGET}"
fi

if [ $? -eq 0 ]; then
    echo "✅ サーバー上のフォルダを削除しました。"
else
    echo "⚠️  サーバー上の削除でエラーが発生しました（フォルダが存在しない可能性があります）。"
fi

# ローカルフォルダも削除するか確認（自動で削除）
if [ -d "$TARGET_NAME" ]; then
    rm -rf "$TARGET_NAME"
    echo "✅ ローカルフォルダも削除しました。"
fi

# 履歴から削除
sed -i '' "/^${TARGET_NAME}$/d" "$HISTORY_FILE"
echo "✅ デプロイ履歴を更新しました。"

# ポータルの再生成
echo "🔄 ポータル画面（index.html）を更新中..."
HTML_LIST=""
if [ -s "$HISTORY_FILE" ]; then
    while read -r line; do
        DATE=$(date "+%Y-%m-%d %H:%M")
        HTML_LIST="${HTML_LIST}<div class='project-card-wrapper' data-project='${line}'><a href='${line}/' class='project-card'><div class='project-info'><h3>${line}</h3><p>Last updated: ${DATE}</p></div><svg class='arrow' viewBox='0 0 24 24' width='24' height='24'><path fill='currentColor' d='M8.59,16.59L13.17,12L8.59,7.41L10,6l6,6l-6,6L8.59,16.59z'/></svg></a><button class='delete-btn' onclick='requestDelete(\"${line}\")'>\u2715</button></div>"
    done < "$HISTORY_FILE"
fi

sed "s|<!-- PROJECT_LIST_HOLDER -->|${HTML_LIST}|" index_template.html > index.html

# index.html のアップロード
if command -v sshpass >/dev/null 2>&1 && [ -n "$SERVER_PASSWORD" ]; then
    sshpass -p "$SERVER_PASSWORD" rsync -v -e "ssh -p ${SSH_PORT} -o StrictHostKeyChecking=no" index.html "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/index.html"
else
    rsync -v -e "ssh -p ${SSH_PORT}" index.html "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/index.html"
fi

echo "✨ 削除完了！ '${TARGET_NAME}' をサーバーとポータルから除去しました。"
