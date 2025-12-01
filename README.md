# Learned Index Papers

論文データを収集し、可視化する静的Webアプリケーションです。

## クイックスタート - ビジュアライザーの実行

### データ生成

まず、全データを生成してJSONファイルとして保存します：

```bash
cd backend
uv sync
uv run python process_data.py
cp data/static/all_data.json ../frontend/public/all_data.json
```

これにより、`backend/data/static/all_data.json` が生成されます。

### フロントエンドの起動

フロントエンドを起動します：

```bash
cd frontend
npm install
npm start
```

ブラウザで `http://localhost:3000` にアクセスして使用できます。

## 使用方法

1. データ生成スクリプトを実行して `all_data.json` を生成
2. JSONファイルをフロントエンドのpublicフォルダにコピー
3. フロントエンドを起動（`http://localhost:3000`）
4. デフォルトクエリ「Partitioned Learned Bloom Filter」で検索、または任意の論文タイトルを入力
5. 検索結果から「List」と「Graph」と「Graph（年別）」をタブで切り替え可能

## 機能

- **LCS検索**: タイトルに対する最長共通部分列（LCS）でベストマッチを検索
- **Listビュー**: Cites / Cited by をブロック形式で大量列挙
- **Graphビュー**: d3-forceによるforce-directed graphで引用関係を可視化
- **Graph（年別）ビュー**: d3-forceによるforce-directed graphで引用関係を年別で可視化
- **静的サイト**: すべてのデータはクライアント側で処理され、サーバーは不要

## データ準備

ビジュアライザーを使用するには、以下のデータファイルが必要です：
- `backend/data/papers/*.json` - 論文データ
- `backend/data/citations/*.json` - 引用関係データ
- `backend/data/tldr/*.json` - 英語TLDRデータ（オプション）
- `backend/data/tldr_ja/*.json` - 日本語TLDRデータ（オプション）
- `backend/data/tags/*.json` - タグデータ（オプション）
- `backend/data/author_info/*.json` - 著者情報データ（オプション）

## データ収集

1. 論文データを収集:
```bash
cd backend
export SEMANTIC_SCHOLAR_API_KEY=YOUR_API_KEY
uv run python collect_papers.py
```

## TLDR生成

1. OpenAI APIキーを設定:
```bash
export OPENAI_API_KEY=YOUR_API_KEY
```

2. 英語TLDRを生成:
```bash
cd backend
uv run python get_tldr.py
```

3. 日本語TLDRを生成:
```bash
cd backend
uv run python get_tldr_ja.py
```

4. タグを生成:
```bash
cd backend
uv run python get_tag.py
```

これらのスクリプトは、BASE_PID（"0539535989147bc7033f4a34931c7b8e17f1c650"）とそれを引用している論文のAbstractを読み込み、OpenAI APIを使って処理します。
- 英語TLDRは `backend/data/tldr/` フォルダに保存されます
- 日本語TLDRは `backend/data/tldr_ja/` フォルダに保存されます
- タグは `backend/data/tags/` フォルダに保存されます（包含関係を考慮して親タグも自動的に追加されます）

## 構成

1. **データ収集**: 論文データをフォルダに収集
2. **データ生成**: `process_data.py`で全データをJSONファイルとして生成
3. **フロントエンド**: React + d3で可視化（静的サイト、サーバー不要）

## 静的サイトとしてのデプロイ

このアプリケーションは静的サイトとしてデプロイできます：

1. データ生成: `backend/process_data.py`を実行して`all_data.json`を生成
2. JSONファイルをコピー: `all_data.json`を`frontend/public/`にコピー
3. ビルド: `cd frontend && npm run build`
4. デプロイ: `frontend/build/`フォルダの内容を任意の静的ホスティングサービス（GitHub Pages、Netlify、Vercelなど）にデプロイ

### GitHub Pagesへのデプロイ

詳細な手順は [DEPLOY.md](DEPLOY.md) を参照してください。

**簡単な手順:**

1. データ生成とビルド:
```bash
cd backend
uv run python process_data.py
cp data/static/all_data.json ../frontend/public/all_data.json
cd ../frontend
npm run build
```

2. `docs`フォルダにコピー:
```bash
cd ..
cp -r frontend/build/* docs/
```

3. GitHubリポジトリの設定:
   - Settings > Pages にアクセス
   - Source: Branch を選択し、ブランチを `main`、フォルダを `/docs` に設定
   - Save をクリック

4. コミットしてプッシュ:
```bash
git add docs/
git commit -m "Deploy to GitHub Pages"
git push origin main
```

5. 数分待つと、`https://<username>.github.io/<repository-name>/`でアクセスできます。

### ローカルでビルド結果を確認する

`file://`プロトコルではCORS制限によりJSONファイルの読み込みが失敗する場合があります。以下のいずれかの方法でローカルサーバーを起動してください：

**Python 3の場合:**
```bash
cd docs
python3 -m http.server 8000
```
ブラウザで `http://localhost:8000` にアクセス

**Node.jsの場合:**
```bash
cd docs
npx serve -p 8000
```
ブラウザで `http://localhost:8000` にアクセス

