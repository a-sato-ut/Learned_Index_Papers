"""
データ整形モジュール
収集した論文データをフロントエンド用に整形し、citation networkを構築します
"""

from pathlib import Path

# データフォルダのパス
DATA_FOLDER = Path(__file__).parent.parent / "data" / "papers"
PROCESSED_DATA_FOLDER = Path(__file__).parent.parent / "processed_data"

# TODO: 実装が必要

def main():
    """メイン関数"""
    # 出力フォルダを作成
    PROCESSED_DATA_FOLDER.mkdir(parents=True, exist_ok=True)
    pass


if __name__ == "__main__":
    main()
