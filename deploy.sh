#!/bin/bash
# =========================================================
# デプロイスクリプト (GitHub Pages用)
# =========================================================

# 実行ディレクトリをスクリプトの場所に移動
cd "$(dirname "$0")"

# .env ファイルの読み込み（存在する場合）
if [ -f .env ]; then
  export $(sed 's/#.*//' .env | xargs)
fi

# 対象ディレクトリの決定
TARGET_DIR="$1"
if [ -z "$TARGET_DIR" ]; then
  echo "使い方: ./deploy.sh <デプロイ対象のフォルダ名>"
  exit 1
fi

if [ ! -d "$TARGET_DIR" ]; then
  echo "❌ エラー: 対象フォルダ '${TARGET_DIR}' が見つかりません。"
  exit 1
fi

# フォルダ名を取得
FOLDER_NAME=$(basename "${TARGET_DIR%/}")
TARGET_DIR="${TARGET_DIR%/}/"

echo "🚀 デプロイプロセスを開始します..."
echo "📂 対象フォルダ: ${TARGET_DIR}"
echo "---------------------------------------------------"

# デプロイ履歴の更新
HISTORY_FILE=".deploy_history"
if [ ! -f "$HISTORY_FILE" ]; then
    touch "$HISTORY_FILE"
fi

if ! grep -q "^${FOLDER_NAME}$" "$HISTORY_FILE" 2>/dev/null; then
    echo "$FOLDER_NAME" >> "$HISTORY_FILE"
fi

# index.html の生成
echo "🔄 ポータル画面（index.html）を更新中..."
HTML_LIST=""
while read -r line; do
    if [ -n "$line" ]; then
        DATE=$(date "+%Y-%m-%d %H:%M")
        HTML_LIST="${HTML_LIST}<div class='project-card-wrapper'><a href='${line}/' class='project-card'><div class='project-info'><h3>${line}</h3><p>Last updated: ${DATE}</p></div><svg class='arrow' viewBox='0 0 24 24' width='24' height='24'><path fill='currentColor' d='M8.59,16.59L13.17,12L8.59,7.41L10,6l6,6l-6,6L8.59,16.59z'/></svg></a></div>"
    fi
done < "$HISTORY_FILE"

sed "s|<!-- PROJECT_LIST_HOLDER -->|${HTML_LIST}|" index_template.html > index.html

# Gitステージングとコミット・プッシュ
echo "📝 変更をGitに追加しています..."
git add "${TARGET_DIR}" index.html "$HISTORY_FILE"

if ! git diff --cached --quiet; then
    git commit -m "deploy: add ${FOLDER_NAME}"
    
    # リモートとブランチの取得（デフォルト値: origin main）
    REMOTE="${DEPLOY_REMOTE:-origin}"
    BRANCH="${DEPLOY_BRANCH:-main}"
    
    echo "🚀 GitHubへプッシュしています (${REMOTE} ${BRANCH})..."
    git push "${REMOTE}" "${BRANCH}"
    if [ $? -eq 0 ]; then
        echo "✨ デプロイが完了し、GitHub Pagesへ送信されました！"
    else
        echo "❌ エラー: GitHubへのプッシュに失敗しました。"
        exit 1
    fi
else
    echo "ℹ️ 変更がないため、コミットとプッシュはスキップされました。"
fi
