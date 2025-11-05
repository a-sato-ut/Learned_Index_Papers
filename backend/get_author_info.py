"""
著者情報を収集して保存するスクリプト
OpenAlex APIから著者の所属情報（過去の所属履歴を含む）を取得します
"""

from openalex_utils import get_author_id_by_name, get_author_info_by_id
import json
from pathlib import Path
from tqdm import tqdm
import os


AUTHOR_INFO_FOLDER = Path(__file__).parent.parent / "data" / "author_info"

os.makedirs(AUTHOR_INFO_FOLDER, exist_ok=True)


def save_author_info(author_name: str, author_data: dict):
    """著者情報を保存（ファイル名は著者名のハッシュまたはエンコード）"""
    # ファイル名に使えない文字を置換
    safe_name = author_name.replace("/", "_").replace("\\", "_").replace(":", "_")
    filepath = AUTHOR_INFO_FOLDER / f"{safe_name}.json"
    
    data = {
        "authorName": author_name,
        **author_data
    }
    
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


def get_author_info_if_not_exists(author_name: str):
    """著者情報を取得（既に保存されている場合は読み込む）"""
    # ファイル名に使えない文字を置換
    safe_name = author_name.replace("/", "_").replace("\\", "_").replace(":", "_")
    filepath = AUTHOR_INFO_FOLDER / f"{safe_name}.json"
    
    if filepath.exists():
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    
    # OpenAlex APIから取得
    author_id = get_author_id_by_name(author_name)
    if not author_id:
        print(f"Warning: Author not found: {author_name}")
        return {
            "authorName": author_name,
            "openalexAuthorId": None,
            "name": author_name,
            "url": None,
            "affiliations": []
        }
    
    # get_author_info_by_idはaffiliationsのリストを返す
    affiliations = get_author_info_by_id(author_id)
    if not affiliations:
        print(f"Warning: Could not fetch author info for: {author_name}")
        return {
            "authorName": author_name,
            "openalexAuthorId": author_id,
            "name": author_name,
            "url": None,
            "affiliations": []
        }
    
    # 著者情報を構築
    author_data = {
        "openalexAuthorId": author_id,
        "name": author_name,
        "url": f"https://openalex.org/{author_id}",
        "affiliations": affiliations
    }
    
    save_author_info(author_name, author_data)
    return {
        "authorName": author_name,
        **author_data
    }


def collect_all_author_info(papers_folder: Path):
    """すべての論文から著者名を収集し、著者情報を取得"""
    # すべての論文ファイルを読み込んで、著者名を収集
    author_names = set()
    
    print("Collecting author names from papers...")
    paper_files = list(papers_folder.glob("*.json"))
    for paper_file in tqdm(paper_files, desc="Reading papers"):
        try:
            with open(paper_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                authors = data.get("authors", [])
                if isinstance(authors, list):
                    author_names.update(authors)
        except Exception as e:
            print(f"Error reading {paper_file}: {e}")
    
    print(f"Found {len(author_names)} unique authors")
    
    # 各著者の情報を取得
    print("Fetching author information...")
    for author_name in tqdm(author_names, desc="Fetching author info"):
        try:
            get_author_info_if_not_exists(author_name)
        except Exception as e:
            print(f"Error fetching info for {author_name}: {e}")


if __name__ == "__main__":
    from pathlib import Path
    PAPERS_FOLDER = Path(__file__).parent.parent / "data" / "papers"
    
    collect_all_author_info(PAPERS_FOLDER)

