"""
論文データ収集モジュール
フォルダに論文データを収集します
"""

from pathlib import Path

# データフォルダのパス（プロジェクトルートからの相対パス）
DATA_FOLDER = Path(__file__).parent.parent / "data" / "papers"

# TODO: 実装が必要

def main():
    """メイン関数"""
    # データフォルダを作成
    DATA_FOLDER.mkdir(parents=True, exist_ok=True)
    pass


if __name__ == "__main__":
    main()
