# Learned Index Papers - Citation Network Visualizer

論文データを収集し、citation networkとして可視化するアプリケーションです。

## 構成

1. **データ収集**: 論文データをフォルダに収集
2. **データ整形**: 収集したデータをフロントエンド用に整形
3. **フロントエンド**: Citation networkを可視化

## セットアップ

### バックエンド
```bash
cd backend
pip install -r requirements.txt
```

### フロントエンド
```bash
cd frontend
npm install
npm start
```

## 使用方法

1. データ収集: `python backend/collect_papers.py`
2. データ整形: `python backend/process_data.py`
3. フロントエンドで可視化を確認

