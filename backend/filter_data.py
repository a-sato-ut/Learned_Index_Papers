"""
BASE_PIDを引用している論文のデータのみを残し、それ以外を削除するスクリプト
"""

import json
from pathlib import Path
from tqdm import tqdm

# データフォルダのパス
PAPERS_FOLDER = Path(__file__).parent.parent / "data" / "papers"
CITATIONS_FOLDER = Path(__file__).parent.parent / "data" / "citations"
TLDR_FOLDER = Path(__file__).parent.parent / "data" / "tldr"
TLDR_JA_FOLDER = Path(__file__).parent.parent / "data" / "tldr_ja"
TAG_FOLDER = Path(__file__).parent.parent / "data" / "tags"
BASE_PID = "0539535989147bc7033f4a34931c7b8e17f1c650"


def get_papers_to_keep():
    """保持する必要がある論文IDのセットを取得"""
    papers_to_keep = set()
    
    # BASE_PID自体を追加
    papers_to_keep.add(BASE_PID)
    
    # BASE_PIDを引用している論文のIDを取得
    base_citation_file = CITATIONS_FOLDER / f"{BASE_PID}.json"
    if base_citation_file.exists():
        with open(base_citation_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            citing_paper_ids = data.get("citationPaperIds", [])
            papers_to_keep.update(citing_paper_ids)
            print(f"BASE_PIDを引用している論文数: {len(citing_paper_ids)}")
    else:
        print(f"警告: BASE_PIDの引用ファイルが見つかりません: {base_citation_file}")
    
    print(f"保持する論文数（BASE_PID含む）: {len(papers_to_keep)}")
    return papers_to_keep


def delete_files_not_in_set(folder: Path, files_to_keep: set, file_type: str):
    """指定されたフォルダ内で、files_to_keepに含まれないファイルを削除"""
    if not folder.exists():
        print(f"フォルダが存在しません: {folder}")
        return
    
    deleted_count = 0
    kept_count = 0
    
    # すべてのJSONファイルを取得
    all_files = list(folder.glob("*.json"))
    
    for file_path in tqdm(all_files, desc=f"削除中 ({file_type})"):
        # ファイル名からpaperIdを取得（拡張子を除く）
        paper_id = file_path.stem
        
        if paper_id in files_to_keep:
            kept_count += 1
        else:
            try:
                file_path.unlink()
                deleted_count += 1
            except Exception as e:
                print(f"エラー: {file_path} の削除に失敗しました: {e}")
    
    print(f"{file_type}: 保持={kept_count}, 削除={deleted_count}")


def main():
    print("=" * 60)
    print("データフィルタリング開始")
    print("=" * 60)
    
    # 保持する論文IDのセットを取得
    papers_to_keep = get_papers_to_keep()
    
    if not papers_to_keep:
        print("警告: 保持する論文がありません。処理を中止します。")
        return
    
    print("\n各フォルダから不要なファイルを削除します...")
    
    # 各フォルダから不要なファイルを削除
    delete_files_not_in_set(PAPERS_FOLDER, papers_to_keep, "papers")
    delete_files_not_in_set(CITATIONS_FOLDER, papers_to_keep, "citations")
    delete_files_not_in_set(TLDR_FOLDER, papers_to_keep, "tldr")
    delete_files_not_in_set(TLDR_JA_FOLDER, papers_to_keep, "tldr_ja")
    delete_files_not_in_set(TAG_FOLDER, papers_to_keep, "tags")
    
    print("\n" + "=" * 60)
    print("データフィルタリング完了")
    print("=" * 60)


if __name__ == "__main__":
    main()

