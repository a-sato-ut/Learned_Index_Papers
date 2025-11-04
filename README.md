# Learned Index Papers - Citation Network Visualizer

論文データを収集し、citation networkとして可視化するアプリケーションです。

## 構成

1. **データ収集**: 論文データをフォルダに収集
2. **バックエンド**: FastAPIで論文検索と引用関係を提供
3. **フロントエンド**: React + d3でCitation networkを可視化

## セットアップ

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
4. 検索結果から「List」と「Graph」をタブで切り替え可能

## API エンドポイント

- `GET /api/search?query={query}&limit={limit}` - タイトルでLCS検索
- `GET /api/paper/{paper_id}?limit={limit}` - 論文IDで論文と引用関係を取得

## 機能

- **LCS検索**: タイトルに対する最長共通部分列（LCS）でベストマッチを検索
- **Listビュー**: Cites / Cited by をブロック形式で大量列挙
- **Graphビュー**: d3-forceによるforce-directed graphで引用関係を可視化

