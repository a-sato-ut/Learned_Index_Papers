# Learned Index Papers

論文データを収集し、可視化するアプリケーションです。

## クイックスタート - ビジュアライザーの実行

### バックエンドの起動

```bash
cd backend
uv sync
uv run uvicorn process_data:app --reload --port 8000
```

### フロントエンドの起動

```bash
cd frontend
npm install
npm start
```

ブラウザで `http://localhost:3000` にアクセスして使用できます。

## 使用方法

1. バックエンドサーバーを起動（`http://localhost:8000`）
2. フロントエンドを起動（`http://localhost:3000`）
3. デフォルトクエリ「Partitioned Learned Bloom Filter」で検索、または任意の論文タイトルを入力
4. 検索結果から「List」と「Graph」と「Graph（年別）」をタブで切り替え可能

## 機能

- **LCS検索**: タイトルに対する最長共通部分列（LCS）でベストマッチを検索
- **Listビュー**: Cites / Cited by をブロック形式で大量列挙
- **Graphビュー**: d3-forceによるforce-directed graphで引用関係を可視化
- **Graph（年別）ビュー**: d3-forceによるforce-directed graphで引用関係を年別で可視化

## API エンドポイント

- `GET /api/search?query={query}&limit={limit}` - タイトルでLCS検索
- `GET /api/paper/{paper_id}?limit={limit}` - 論文IDで論文と引用関係を取得

## データ準備

ビジュアライザーを使用するには、以下のデータファイルが必要です：
- `backend/data/papers/*.json` - 論文データ
- `backend/data/citations/*.json` - 引用関係データ

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
2. **バックエンド**: FastAPIで論文検索と引用関係を提供
3. **フロントエンド**: React + d3で可視化

