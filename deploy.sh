#!/bin/bash
# =========================================================
# デプロイスクリプト (プロジェクト別サブフォルダ & ポータル生成)
# =========================================================

# 実行ディレクトリをスクリプトの場所に移動
cd "$(dirname "$0")"

# .env ファイルの読み込み（コメントを無視して各行をエクスポート）
if [ ! -f .env ]; then
  echo "❌ エラー: .env ファイルが見つかりません。"
  exit 1
fi
# Trailing comments (#...) を削除してからエクスポート
export $(sed 's/#.*//' .env | xargs)

# 対象ディレクトリの決定
TARGET_DIR="${1:-$LOCAL_DIR}"
if [ -z "$TARGET_DIR" ] || [ ! -d "$TARGET_DIR" ]; then
  echo "❌ エラー: 対象フォルダ '${TARGET_DIR}' が見つかりません。"
  exit 1
fi

# フォルダ名を取得
FOLDER_NAME=$(basename "${TARGET_DIR%/}")
REMOTE_TARGET="${REMOTE_DIR%/}/${FOLDER_NAME}"
TARGET_DIR="${TARGET_DIR%/}/"

echo "🚀 デプロイを開始します..."
echo "📂 ローカル対象: ${TARGET_DIR}"
echo "🌍 リモート先: ${REMOTE_TARGET}"
echo "---------------------------------------------------"

# サーバー側の履歴を同期（ブラウザ削除を反映）
HISTORY_FILE=".deploy_history"
SSH_PORT=${SERVER_PORT:-22}
if command -v sshpass >/dev/null 2>&1 && [ -n "$SERVER_PASSWORD" ]; then
    sshpass -p "$SERVER_PASSWORD" scp -P "${SSH_PORT}" -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/.deploy_history" "${HISTORY_FILE}.server" 2>/dev/null
else
    scp -P "${SSH_PORT}" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/.deploy_history" "${HISTORY_FILE}.server" 2>/dev/null
fi
# サーバー側の履歴が存在すればそちらを正とする
if [ -f "${HISTORY_FILE}.server" ]; then
    cp "${HISTORY_FILE}.server" "$HISTORY_FILE"
    rm "${HISTORY_FILE}.server"
fi

# デプロイ履歴の更新
if ! grep -q "^${FOLDER_NAME}$" "$HISTORY_FILE" 2>/dev/null; then
    echo "$FOLDER_NAME" >> "$HISTORY_FILE"
fi

# デプロイ実行
if [ "$DEPLOY_METHOD" = "rsync" ]; then
    SSH_PORT=${SERVER_PORT:-22}
    
    # 接続確認用のmkdir
    if command -v sshpass >/dev/null 2>&1 && [ -n "$SERVER_PASSWORD" ]; then
        # sshpassが使える場合
        sshpass -p "$SERVER_PASSWORD" ssh -p "${SSH_PORT}" -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_HOST}" "mkdir -p ${REMOTE_TARGET}"
        sshpass -p "$SERVER_PASSWORD" rsync --archive --update --delete --verbose --exclude '.env' --exclude '.git' \
          -e "ssh -p ${SSH_PORT} -o StrictHostKeyChecking=no" "${TARGET_DIR}" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_TARGET}/"
    else
        # sshpassがないかパスワードが空の場合（SSHキーを期待）
        ssh -p "${SSH_PORT}" "${SERVER_USER}@${SERVER_HOST}" "mkdir -p ${REMOTE_TARGET}"
        rsync --archive --update --delete --verbose --exclude '.env' --exclude '.git' \
          -e "ssh -p ${SSH_PORT}" "${TARGET_DIR}" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_TARGET}/"
    fi
    SUCCESS=$?
elif [ "$DEPLOY_METHOD" = "lftp" ]; then
    FTP_PORT=${SERVER_PORT:-21}
    lftp -u "${SERVER_USER},${SERVER_PASSWORD}" -p "${FTP_PORT}" "${SERVER_HOST}" <<EOF
    set ftp:ssl-allow yes
    mkdir -p "${REMOTE_TARGET}"
    mirror -R --only-newer --delete --parallel=3 --exclude-glob .env --exclude-glob .git "${TARGET_DIR}" "${REMOTE_TARGET}"
    quit
EOF
    SUCCESS=$?
fi

if [ "$SUCCESS" -eq 0 ]; then
    echo "✅ プロジェクトのデプロイが完了しました。"
    
    # index.html の生成
    echo "🔄 ポータル画面（index.html）を更新中..."
    HTML_LIST=""
    while read -r line; do
        DATE=$(date "+%Y-%m-%d %H:%M")
        HTML_LIST="${HTML_LIST}<div class='project-card-wrapper' data-project='${line}'><a href='${line}/' class='project-card'><div class='project-info'><h3>${line}</h3><p>Last updated: ${DATE}</p></div><svg class='arrow' viewBox='0 0 24 24' width='24' height='24'><path fill='currentColor' d='M8.59,16.59L13.17,12L8.59,7.41L10,6l6,6l-6,6L8.59,16.59z'/></svg></a><button class='delete-btn' onclick='requestDelete(\"${line}\")'>✕</button></div>"
    done < "$HISTORY_FILE"

    sed "s|<!-- PROJECT_LIST_HOLDER -->|${HTML_LIST}|" index_template.html > index.html

    # index.html, delete.php, .deploy_history のアップロード
    if [ "$DEPLOY_METHOD" = "rsync" ]; then
        if command -v sshpass >/dev/null 2>&1 && [ -n "$SERVER_PASSWORD" ]; then
            sshpass -p "$SERVER_PASSWORD" rsync -v -e "ssh -p ${SSH_PORT} -o StrictHostKeyChecking=no" index.html delete.php "$HISTORY_FILE" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/"
        else
            rsync -v -e "ssh -p ${SSH_PORT}" index.html delete.php "$HISTORY_FILE" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/"
        fi
    elif [ "$DEPLOY_METHOD" = "lftp" ]; then
        lftp -u "${SERVER_USER},${SERVER_PASSWORD}" -p "${FTP_PORT}" "${SERVER_HOST}" -e "put -o index.html index.html; put -o delete.php delete.php; put -o .deploy_history ${HISTORY_FILE}; quit"
    fi
    echo "✨ すべての処理が完了しました！"
else
    echo "❌ デプロイに失敗しました。"
    exit 1
fi
