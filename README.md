# Learned Index Papers - Citation Network Visualizer

論文データを収集し、citation networkとして可視化するアプリケーションです。

## 構成

1. **データ収集**: 論文データをフォルダに収集
2. **バックエンド**: FastAPIで論文検索と引用関係を提供
3. **フロントエンド**: React + d3でCitation networkを可視化

## データ収集

1. 論文データを収集:
```bash
cd backend
export SEMANTIC_SCHOLAR_API_KEY=YOUR_API_KEY
python collect_papers.py
```

## TLDR生成

1. OpenAI APIキーを設定:
```bash
export OPENAI_API_KEY=YOUR_API_KEY
```

2. 英語TLDRを生成:
```bash
cd backend
python get_tldr.py
```

3. 日本語TLDRを生成:
```bash
cd backend
python get_tldr_ja.py
```

4. タグを生成:
```bash
cd backend
python get_tag.py
```

これらのスクリプトは、BASE_PID（"0539535989147bc7033f4a34931c7b8e17f1c650"）とそれを引用している論文のAbstractを読み込み、OpenAI APIを使って処理します。
- 英語TLDRは `data/tldr/` フォルダに保存されます
- 日本語TLDRは `data/tldr_ja/` フォルダに保存されます
- タグは `data/tags/` フォルダに保存されます（包含関係を考慮して親タグも自動的に追加されます）

## ビジュアライザー

### バックエンド

1. 仮想環境を作成してアクティベート:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
```

2. 依存関係をインストール:
```bash
pip install fastapi uvicorn
# または
pip install -e .
```

3. データ準備:
- `data/papers/*.json` と `data/citations/*.json` が存在することを確認

4. サーバーを起動:
```bash
uvicorn process_data:app --reload --port 8000
```

### フロントエンド

1. 依存関係をインストール:
```bash
cd frontend
npm install
```

2. 環境変数を設定（オプション）:
```bash
# .env.local を作成（オプション）
echo "REACT_APP_API_BASE=http://localhost:8000" > .env.local
```

3. 開発サーバーを起動:
```bash
npm start
```

## 使用方法

1. バックエンドサーバーを起動（`http://localhost:8000`）
2. フロントエンドを起動（`http://localhost:3000`）
3. デフォルトクエリ「Partitioned Learned Bloom Filter」で検索、または任意の論文タイトルを入力
4. 検索結果から「List」と「Graph」と「Graph（年別）」をタブで切り替え可能

## API エンドポイント

- `GET /api/search?query={query}&limit={limit}` - タイトルでLCS検索
- `GET /api/paper/{paper_id}?limit={limit}` - 論文IDで論文と引用関係を取得

## 機能

- **LCS検索**: タイトルに対する最長共通部分列（LCS）でベストマッチを検索
- **Listビュー**: Cites / Cited by をブロック形式で大量列挙
- **Graphビュー**: d3-forceによるforce-directed graphで引用関係を可視化
- **Graph（年別）ビュー**: d3-forceによるforce-directed graphで引用関係を年別で可視化

