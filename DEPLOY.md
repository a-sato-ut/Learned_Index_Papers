# GitHub Pagesへのデプロイ手順

## 自動デプロイ（推奨）

GitHub Actionsワークフローが設定されているため、`main`ブランチ（または`master`ブランチ）にプッシュすると自動的にデプロイされます。

### 自動デプロイの流れ

1. コードを変更してコミット
2. `main`ブランチにプッシュ:
```bash
git push origin main
```

3. GitHub Actionsが自動的に以下を実行：
   - バックエンドでデータ生成（`uv run python process_data.py`）
   - 生成されたJSONファイルをフロントエンドの`public`フォルダにコピー
   - フロントエンドをビルド（`npm run build`）
   - ビルド結果を`docs`フォルダにコピー
   - `docs`フォルダの変更をコミットしてプッシュ
   - GitHub Pagesが自動的に更新される

4. 数分待つと、`https://<username>.github.io/<repository-name>/`で最新のサイトにアクセスできます

### 初回設定

初回のみ、GitHubリポジトリの **Settings > Pages** で以下を設定：
- **Source**: Branch を選択
- **Branch**: `main`（または`master`）を選択
- **Folder**: `/docs` を選択
- **Save** をクリック

### 手動デプロイ（必要に応じて）

GitHub Actionsのワークフローを手動で実行することもできます：
1. リポジトリの **Actions** タブにアクセス
2. 左側のメニューから **Deploy to GitHub Pages** ワークフローを選択
3. 右上の **Run workflow** をクリック
4. ブランチを選択して **Run workflow** をクリック

## 手動デプロイ手順（自動デプロイが使えない場合）

## 前提条件

- GitHubリポジトリが既に作成されていること
- リポジトリにアクセス権限があること

## 手動デプロイ手順

### 1. データ生成とビルド

```bash
# バックエンドでデータを生成
cd backend
uv run python process_data.py

# 生成されたJSONファイルをフロントエンドのpublicフォルダにコピー
cp data/static/all_data.json ../frontend/public/all_data.json

# フロントエンドをビルド
cd ../frontend
npm run build
```

### 2. docsフォルダにコピー

```bash
# プロジェクトルートに戻る
cd ..

# ビルド結果をdocsフォルダにコピー
cp -r frontend/build/* docs/
```

### 3. GitHubリポジトリの設定

1. GitHubリポジトリのページにアクセス
2. **Settings** タブをクリック
3. 左側のメニューから **Pages** を選択
4. **Source** セクションで：
   - **Branch** を選択
   - ブランチを `main` (または `master`) に設定
   - フォルダを `/docs` に設定
5. **Save** をクリック

### 4. コミットとプッシュ

```bash
# 変更をステージング
git add docs/
git add frontend/public/all_data.json
git add backend/data/static/all_data.json  # 必要に応じて

# コミット
git commit -m "Deploy to GitHub Pages"

# プッシュ
git push origin main  # または master
```

### 5. デプロイの確認

- 数分待つと、GitHub Pagesが自動的にデプロイされます
- リポジトリの **Settings > Pages** で、デプロイ状況を確認できます
- デプロイが完了すると、以下のURLでアクセスできます：
  - `https://<username>.github.io/<repository-name>/`
  - または、カスタムドメインを設定している場合はそのURL

## 注意事項

- デプロイには数分かかる場合があります
- 初回デプロイ後、URLが有効になるまで数分かかる場合があります
- `HashRouter`を使用しているため、URLは `https://<username>.github.io/<repository-name>/#/` の形式になります

## デプロイの更新

データやコードを更新した場合は、上記の手順1-4を繰り返してください。

## トラブルシューティング

### 404エラーが表示される場合

- `docs`フォルダに`index.html`が存在することを確認
- GitHub Pagesの設定で`/docs`フォルダが選択されていることを確認
- デプロイが完了するまで数分待つ

### データが読み込まれない場合

- `docs/all_data.json`が存在することを確認
- ブラウザの開発者ツール（F12）でコンソールエラーを確認
- ネットワークタブで`all_data.json`の読み込み状況を確認

