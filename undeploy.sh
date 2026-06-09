#!/bin/bash
# =========================================================
# アンデプロイスクリプト (GitHub Pages用)
# =========================================================

# 実行ディレクトリをスクリプトの場所に移動
cd "$(dirname "$0")"

# .env ファイルの読み込み（存在する場合）
if [ -f .env ]; then
  export $(sed 's/#.*//' .env | xargs)
fi

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

# 履歴に存在するか確認
if ! grep -q "^${TARGET_NAME}$" "$HISTORY_FILE" 2>/dev/null; then
  echo "❌ エラー: '${TARGET_NAME}' はデプロイ履歴に見つかりません。"
  echo ""
  echo "📋 現在デプロイ済みのプロジェクト:"
  cat -n "$HISTORY_FILE"
  exit 1
fi

echo "🗑️  削除プロセスを開始します..."
echo "📂 対象プロジェクト: ${TARGET_NAME}"
echo "---------------------------------------------------"

# ローカルフォルダの削除
if [ -d "$TARGET_NAME" ]; then
    rm -rf "$TARGET_NAME"
    echo "✅ ローカルフォルダ '${TARGET_NAME}' を削除しました。"
fi

# 履歴から削除
# macOSとLinux両対応のsed処理
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "/^${TARGET_NAME}$/d" "$HISTORY_FILE"
else
    sed -i "/^${TARGET_NAME}$/d" "$HISTORY_FILE"
fi
echo "✅ デプロイ履歴から削除しました。"

# ポータルの再生成
echo "🔄 ポータル画面（index.html）を更新中..."
HTML_LIST=""
if [ -s "$HISTORY_FILE" ]; then
    while read -r line; do
        if [ -n "$line" ]; then
            DATE=$(date "+%Y-%m-%d %H:%M")
            HTML_LIST="${HTML_LIST}<div class='project-card-wrapper'><a href='${line}/' class='project-card'><div class='project-info'><h3>${line}</h3><p>Last updated: ${DATE}</p></div><svg class='arrow' viewBox='0 0 24 24' width='24' height='24'><path fill='currentColor' d='M8.59,16.59L13.17,12L8.59,7.41L10,6l6,6l-6,6L8.59,16.59z'/></svg></a></div>"
        fi
    done < "$HISTORY_FILE"
fi

sed "s|<!-- PROJECT_LIST_HOLDER -->|${HTML_LIST}|" index_template.html > index.html

# Gitステージングとコミット・プッシュ
echo "📝 変更をGitに追加しています..."
# 削除されたフォルダを含めてステージングするため、git add -A を使用します
git add -A "$TARGET_NAME" 2>/dev/null
git add index.html "$HISTORY_FILE"

if ! git diff --cached --quiet; then
    git commit -m "undeploy: remove ${TARGET_NAME}"
    
    # リモートとブランチの取得
    REMOTE="${DEPLOY_REMOTE:-origin}"
    BRANCH="${DEPLOY_BRANCH:-main}"
    
    echo "🚀 GitHubへプッシュしています (${REMOTE} ${BRANCH})..."
    git push "${REMOTE}" "${BRANCH}"
    if [ $? -eq 0 ]; then
        echo "✨ 削除処理が完了し、GitHub Pagesへ送信されました！"
    else
        echo "❌ エラー: GitHubへのプッシュに失敗しました。"
        exit 1
    fi
else
    echo "ℹ️ 変更がないため、コミットとプッシュはスキップされました。"
fi
