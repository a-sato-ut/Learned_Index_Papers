"""
著者情報を収集して保存するスクリプト
OpenAlex APIから著者の所属情報（過去の所属履歴を含む）を取得します
"""

from openalex_utils import get_author_id_by_name, get_author_info_by_id, get_author_papers
import json
from pathlib import Path
from tqdm import tqdm
import os
from typing import List, Dict, Set, Any, Optional


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


def get_author_papers_from_dataset(author_name: str, papers_folder: Path) -> List[Dict[str, Any]]:
    """データセットから著者の論文情報を取得"""
    author_papers = []
    
    for paper_file in papers_folder.glob("*.json"):
        try:
            with open(paper_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                authors = data.get("authors", [])
                if isinstance(authors, list) and author_name in authors:
                    author_papers.append({
                        "paperId": data.get("paperId", ""),
                        "title": data.get("title", ""),
                        "year": data.get("year"),
                    })
        except Exception as e:
            pass  # エラーは無視
    
    return author_papers


def find_best_matching_author(author_name: str, author_papers: List[Dict[str, Any]], top_k: int = 10) -> Optional[str]:
    """
    著者名と論文情報を使って、最も一致するOpenAlexの著者IDを返す
    
    Args:
        author_name: 著者名
        author_papers: データセット内の著者の論文リスト
        top_k: 検索候補の上位何件を確認するか
    
    Returns:
        最も一致するOpenAlexの著者ID、見つからなければNone
    """
    # まず著者名で検索
    author_id_candidates = []
    lower_name = author_name.strip().lower()
    
    try:
        from openalex_utils import _request_json, OPENALEX_BASE
        
        url = f"{OPENALEX_BASE}/authors"
        params = {
            "search": author_name,
            "per_page": max(1, min(200, top_k)),
        }
        
        data = _request_json("GET", url, params=params)
        results = data.get("results", []) or []
        
        # 完全一致を優先
        for author in results:
            display_name = author.get("display_name", "")
            if display_name.strip().lower() == lower_name:
                author_id = author.get("id", "").replace("https://openalex.org/", "")
                if author_id:
                    author_id_candidates.append((author_id, 100))  # 完全一致は高スコア
        
        # 完全一致がなければ上位候補を追加
        if not author_id_candidates:
            for author in results[:top_k]:
                author_id = author.get("id", "").replace("https://openalex.org/", "")
                if author_id:
                    author_id_candidates.append((author_id, 50))  # 部分一致は低スコア
    except Exception as e:
        print(f"Error searching author: {e}")
        return None
    
    if not author_id_candidates:
        return None
    
    # 論文情報がない場合は最初の候補を返す
    if not author_papers:
        return author_id_candidates[0][0]
    
    # 各候補の論文と照合してスコアを計算
    best_match = None
    best_score = -1
    
    for author_id, base_score in author_id_candidates:
        try:
            # OpenAlexから著者の論文を取得
            openalex_papers = get_author_papers(author_id, limit=100)
            
            # 論文のタイトルで照合（簡易的なマッチング）
            match_count = 0
            dataset_titles = {p["title"].lower().strip() for p in author_papers if p.get("title")}
            
            for openalex_paper in openalex_papers:
                openalex_title = openalex_paper.get("title", "").lower().strip()
                if openalex_title in dataset_titles:
                    match_count += 1
            
            # スコア計算: ベーススコア + マッチ数
            score = base_score + match_count * 10
            
            if score > best_score:
                best_score = score
                best_match = author_id
        except Exception as e:
            print(f"Error checking author {author_id}: {e}")
            continue
    
    return best_match


def get_author_info_if_not_exists(author_name: str, papers_folder: Path = None):
    """著者情報を取得（既に保存されている場合は読み込む）"""
    # ファイル名に使えない文字を置換
    safe_name = author_name.replace("/", "_").replace("\\", "_").replace(":", "_")
    filepath = AUTHOR_INFO_FOLDER / f"{safe_name}.json"
    
    if filepath.exists():
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    
    # データセットから著者の論文情報を取得
    if papers_folder is None:
        papers_folder = Path(__file__).parent.parent / "data" / "papers"
    
    author_papers = get_author_papers_from_dataset(author_name, papers_folder)
    
    # 論文情報を使ってより正確に著者を特定
    author_id = find_best_matching_author(author_name, author_papers)
    
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
    """すべての論文から著者名を収集し、被引用数が多い順に著者情報を取得"""
    # すべての論文ファイルを読み込んで、著者名と被引用数を収集
    author_citations = {}  # {author_name: total_citation_count}
    
    print("Collecting author names and citation counts from papers...")
    paper_files = list(papers_folder.glob("*.json"))
    for paper_file in tqdm(paper_files, desc="Reading papers"):
        try:
            with open(paper_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                authors = data.get("authors", [])
                citation_count = data.get("citationCount", 0)
                
                if isinstance(authors, list):
                    for author in authors:
                        if author not in author_citations:
                            author_citations[author] = 0
                        author_citations[author] += citation_count
        except Exception as e:
            print(f"Error reading {paper_file}: {e}")
    
    print(f"Found {len(author_citations)} unique authors")
    
    # 被引用数でソート（多い順）
    sorted_authors = sorted(
        author_citations.items(),
        key=lambda x: x[1],
        reverse=True
    )
    
    print(f"Top 10 authors by citations:")
    for author, citations in sorted_authors[:10]:
        print(f"  {author}: {citations} citations")
    
    # 各著者の情報を取得（被引用数が多い順）
    print("\nFetching author information...")
    for author_name, citation_count in tqdm(sorted_authors, desc="Fetching author info"):
        try:
            get_author_info_if_not_exists(author_name, papers_folder)
        except Exception as e:
            print(f"Error fetching info for {author_name}: {e}")


if __name__ == "__main__":
    from pathlib import Path
    PAPERS_FOLDER = Path(__file__).parent.parent / "data" / "papers"
    
    collect_all_author_info(PAPERS_FOLDER)

