"""
データ整形モジュール
収集した論文データをフロントエンド用に整形し、全データをJSONファイルとして保存します
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

# データフォルダのパス
PAPERS_FOLDER = Path("data") / "papers"
CITATIONS_FOLDER = Path("data") / "citations"
TLDR_FOLDER = Path("data") / "tldr"
TLDR_JA_FOLDER = Path("data") / "tldr_ja"
TAG_FOLDER = Path("data") / "tags"
AUTHOR_INFO_FOLDER = Path("data") / "author_info"
OUTPUT_FOLDER = Path("data") / "static"
BASE_PID = "0539535989147bc7033f4a34931c7b8e17f1c650"


def normalize_venue(venue: str) -> str:
    """
    venue名から年と序数詞を除去して正規化する
    例: 
    - "SIGMOD 2023" -> "SIGMOD"
    - "ICML 2024" -> "ICML"
    - "Proceedings of the 2024 6th International Conference..." -> "Proceedings of the International Conference..."
    - "10th International Conference on Big Data 2024" -> "International Conference on Big Data"
    """
    if not venue:
        return venue
    
    # 文中の年を除去（前後にスペースがある場合）
    venue = re.sub(r'\s+(19|20)\d{2}(-\d{2})?\s+', ' ', venue)
    # 末尾の年を除去
    venue = re.sub(r'\s+(19|20)\d{2}(-\d{2})?$', '', venue)
    # 先頭の年を除去
    venue = re.sub(r'^(19|20)\d{2}(-\d{2})?\s+', '', venue)
    # 括弧内の年を除去
    venue = re.sub(r'\s*\([^)]*(19|20)\d{2}[^)]*\)', '', venue)
    venue = re.sub(r'\s*\[[^\]]*(19|20)\d{2}[^\]]*\]', '', venue)
    # 末尾の'23や'24などの短縮形の年を除去
    venue = re.sub(r"\s+'?\d{2}$", '', venue)
    # 文中の短縮形の年を除去（前後にスペースがある場合）
    venue = re.sub(r"\s+'?\d{2}\s+", ' ', venue)
    
    # 序数詞を除去（1st, 2nd, 3rd, 4th, 5th, ..., 10th, 11th, ...）
    # 文中の序数詞を除去（前後にスペースがある場合）
    venue = re.sub(r'\s+\d+(st|nd|rd|th)\s+', ' ', venue, flags=re.IGNORECASE)
    # 先頭の序数詞を除去
    venue = re.sub(r'^\d+(st|nd|rd|th)\s+', '', venue, flags=re.IGNORECASE)
    # 末尾の序数詞を除去
    venue = re.sub(r'\s+\d+(st|nd|rd|th)$', '', venue, flags=re.IGNORECASE)
    
    # 連続するスペースを1つにまとめる
    venue = re.sub(r'\s+', ' ', venue)
    
    return venue.strip()


class Paper:
    """論文データクラス"""
    def __init__(self, data: Dict[str, Any]):
        self.paperId = data.get("paperId", "")
        self.title = data.get("title", "")
        self.year = data.get("year")
        self.venue = data.get("venue")
        self.authors = data.get("authors", [])
        self.doi = data.get("doi")
        self.arxivId = data.get("arxivId")
        self.url = data.get("url")
        self.isOpenAccess = data.get("isOpenAccess", False)
        self.openAccessPdf = data.get("openAccessPdf")
        self.abstract = data.get("abstract")
        self.citationCount = data.get("citationCount", 0)
        self.referenceCount = data.get("referenceCount", 0)
        self.tldr = data.get("tldr")
        self.tldr_ja = data.get("tldr_ja")
        self.tags = data.get("tags", [])
    
    def to_dict(self) -> Dict[str, Any]:
        """辞書形式に変換"""
        result = {
            "paperId": self.paperId,
            "title": self.title,
            "authors": self.authors,
            "isOpenAccess": self.isOpenAccess,
            "citationCount": self.citationCount,
            "referenceCount": self.referenceCount,
        }
        if self.year is not None:
            result["year"] = self.year
        if self.venue:
            result["venue"] = self.venue
        if self.doi:
            result["doi"] = self.doi
        if self.arxivId:
            result["arxivId"] = self.arxivId
        if self.url:
            result["url"] = self.url
        if self.openAccessPdf:
            result["openAccessPdf"] = self.openAccessPdf
        if self.abstract:
            result["abstract"] = self.abstract
        if self.tldr:
            result["tldr"] = self.tldr
        if self.tldr_ja:
            result["tldr_ja"] = self.tldr_ja
        if self.tags:
            result["tags"] = self.tags
        return result


class Corpus:
    """論文コーパスと引用関係を管理するクラス"""

    def __init__(self):
        self.papers: Dict[str, Paper] = {}
        self.cited_by: Dict[str, List[str]] = {}  # paperId -> [引用している論文IDのリスト]
        self.cites: Dict[str, List[str]] = {}  # paperId -> [引用されている論文IDのリスト]
        self._load_data()

    def _load_data(self):
        """データを読み込む - BASE_PIDを引用している論文だけを読み込む"""
        # まず、BASE_PIDを引用している論文IDのリストを取得
        base_citation_file = CITATIONS_FOLDER / f"{BASE_PID}.json"
        papers_to_load = set()
        
        if base_citation_file.exists():
            try:
                with open(base_citation_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    citing_paper_ids = data.get("citationPaperIds", [])
                    papers_to_load.update(citing_paper_ids)
                    print(f"Found {len(citing_paper_ids)} papers citing BASE_PID")
            except Exception as e:
                print(f"Error loading BASE_PID citation file: {e}")
        else:
            print(f"Warning: BASE_PID citation file not found: {base_citation_file}")
        
        # BASE_PID自体も含める（検索結果に表示するため）
        papers_to_load.add(BASE_PID)
        
        # BASE_PIDを引用している論文のデータだけを読み込む
        for paper_id in papers_to_load:
            paper_file = PAPERS_FOLDER / f"{paper_id}.json"
            if paper_file.exists():
                try:
                    with open(paper_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        paper = Paper(data)
                        self.papers[paper.paperId] = paper
                except Exception as e:
                    print(f"Error loading paper {paper_file}: {e}")
            else:
                print(f"Warning: Paper file not found: {paper_file}")

        # 引用データを読み込む（読み込んだ論文に関連するものだけ）
        # citations/{paperId}.json の citationPaperIds は、その paperId を引用している（cited by）論文のリスト
        for paper_id in papers_to_load:
            citation_file = CITATIONS_FOLDER / f"{paper_id}.json"
            if citation_file.exists():
                try:
                    with open(citation_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        citation_ids = data.get("citationPaperIds", [])

                        # cited_by を構築（この論文を引用している論文）
                        # citation_ids は paper_id を引用している論文のリスト
                        # ただし、読み込んだ論文に含まれるものだけを記録
                        filtered_citation_ids = [cid for cid in citation_ids if cid in papers_to_load]
                        self.cited_by[paper_id] = filtered_citation_ids

                        # cites を構築（この論文が引用している論文）
                        # citation_ids の各論文が paper_id を引用しているということは、
                        # 逆方向では、citation_ids の各論文が paper_id を引用している
                        # つまり、cites[citation_id] に paper_id を追加
                        for citation_id in filtered_citation_ids:
                            if citation_id not in self.cites:
                                self.cites[citation_id] = []
                            if paper_id not in self.cites[citation_id]:
                                self.cites[citation_id].append(paper_id)
                except Exception as e:
                    print(f"Error loading citation {citation_file}: {e}")

        print(f"Loaded {len(self.papers)} papers (filtered to BASE_PID citations)")

    def _load_tldr_data(self, paper: Paper) -> Paper:
        """論文のTLDRデータとタグデータを読み込む"""
        paper_dict = paper.to_dict()
        
        # 英語TLDRを読み込む
        tldr_file = TLDR_FOLDER / f"{paper.paperId}.json"
        if tldr_file.exists():
            try:
                with open(tldr_file, "r", encoding="utf-8") as f:
                    tldr_data = json.load(f)
                    paper_dict["tldr"] = tldr_data.get("tldr")
            except Exception as e:
                print(f"Error loading TLDR for {paper.paperId}: {e}")
        
        # 日本語TLDRを読み込む
        tldr_ja_file = TLDR_JA_FOLDER / f"{paper.paperId}.json"
        if tldr_ja_file.exists():
            try:
                with open(tldr_ja_file, "r", encoding="utf-8") as f:
                    tldr_ja_data = json.load(f)
                    paper_dict["tldr_ja"] = tldr_ja_data.get("tldr_ja")
            except Exception as e:
                print(f"Error loading TLDR_JA for {paper.paperId}: {e}")
        
        # タグデータを読み込む
        tag_file = TAG_FOLDER / f"{paper.paperId}.json"
        if tag_file.exists():
            try:
                with open(tag_file, "r", encoding="utf-8") as f:
                    tag_data = json.load(f)
                    paper_dict["tags"] = tag_data.get("tags", [])
            except Exception as e:
                print(f"Error loading tags for {paper.paperId}: {e}")
        
        return Paper(paper_dict)

    def get_cites(self, paper_id: str) -> List[str]:
        """この論文が引用している論文IDのリストを取得"""
        return self.cites.get(paper_id, [])

    def get_cited_by(self, paper_id: str) -> List[str]:
        """この論文を引用している論文IDのリストを取得"""
        return self.cited_by.get(paper_id, [])

    def get_all_tags(self) -> List[Dict[str, Any]]:
        """利用可能な全てのタグとその件数を取得"""
        tag_counts: Dict[str, int] = {}
        for paper in self.papers.values():
            paper_with_tldr = self._load_tldr_data(paper)
            if paper_with_tldr.tags:
                for tag in paper_with_tldr.tags:
                    tag_counts[tag] = tag_counts.get(tag, 0) + 1
        
        # タグ名でソートして、辞書形式で返す
        return [{"tag": tag, "count": count} for tag, count in sorted(tag_counts.items())]

    def get_all_authors(self) -> List[Dict[str, Any]]:
        """利用可能な全ての著者とその件数を取得"""
        author_counts: Dict[str, int] = {}
        for paper in self.papers.values():
            paper_with_tldr = self._load_tldr_data(paper)
            if paper_with_tldr.authors:
                for author in paper_with_tldr.authors:
                    author_counts[author] = author_counts.get(author, 0) + 1
        
        # countが多い順にソートして、辞書形式で返す
        return [{"author": author, "count": count} for author, count in sorted(author_counts.items(), key=lambda x: x[1], reverse=True)]

    def get_all_venues(self) -> List[Dict[str, Any]]:
        """利用可能な全てのvenueとその件数を取得（年を除去して正規化）"""
        venue_counts: Dict[str, int] = {}
        for paper in self.papers.values():
            paper_with_tldr = self._load_tldr_data(paper)
            if paper_with_tldr.venue:
                normalized_venue = normalize_venue(paper_with_tldr.venue)
                if normalized_venue:  # 空文字列でない場合のみ追加
                    venue_counts[normalized_venue] = venue_counts.get(normalized_venue, 0) + 1

        # countが多い順にソートして、辞書形式で返す
        return [{"venue": venue, "count": count} for venue, count in sorted(venue_counts.items(), key=lambda x: x[1], reverse=True)]

    def _load_author_info(self, author_name: str) -> Optional[Dict[str, Any]]:
        """著者情報を読み込む"""
        # ファイル名に使えない文字を置換
        safe_name = author_name.replace("/", "_").replace("\\", "_").replace(":", "_")
        author_info_file = AUTHOR_INFO_FOLDER / f"{safe_name}.json"
        
        if author_info_file.exists():
            try:
                with open(author_info_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading author info for {author_name}: {e}")
        
        return None

    def get_author_ranking(self, min_year: Optional[int] = None) -> List[Dict[str, Any]]:
        """著者ランキングを取得（論文数、被引用数、タグ集計、カンファレンス集計、所属情報を含む）
        
        Args:
            min_year: この年以降の論文のみを集計対象とする（Noneの場合は全ての論文）
        """
        author_stats: Dict[str, Dict[str, Any]] = {}
        
        for paper in self.papers.values():
            paper_with_tldr = self._load_tldr_data(paper)
            
            # 年フィルタリング: min_yearが指定されている場合、その年以降の論文のみを対象とする
            if min_year is not None:
                paper_year = paper_with_tldr.year
                if paper_year is None or paper_year < min_year:
                    continue
            
            if paper_with_tldr.authors:
                for author in paper_with_tldr.authors:
                    if author not in author_stats:
                        author_stats[author] = {
                            "author": author,
                            "paperCount": 0,
                            "totalCitations": 0,
                            "tags": {},
                            "conferences": {}
                        }
                    
                    # 論文数をカウント
                    author_stats[author]["paperCount"] += 1
                    
                    # 被引用数を合計
                    author_stats[author]["totalCitations"] += paper_with_tldr.citationCount
                    
                    # タグを集計
                    if paper_with_tldr.tags:
                        for tag in paper_with_tldr.tags:
                            author_stats[author]["tags"][tag] = author_stats[author]["tags"].get(tag, 0) + 1
                    
                    # カンファレンスを集計（正規化したvenue名を使用）
                    if paper_with_tldr.venue:
                        normalized_venue = normalize_venue(paper_with_tldr.venue)
                        if normalized_venue:
                            author_stats[author]["conferences"][normalized_venue] = author_stats[author]["conferences"].get(normalized_venue, 0) + 1
        
        # リスト形式に変換（タグとカンファレンスをソート済みリストに変換、所属情報を追加）
        result = []
        for author, stats in author_stats.items():
            # 著者情報を読み込む
            author_info = self._load_author_info(author)
            affiliations = author_info.get("affiliations", []) if author_info else []
            
            result.append({
                "author": stats["author"],
                "paperCount": stats["paperCount"],
                "totalCitations": stats["totalCitations"],
                "tags": [{"tag": tag, "count": count} for tag, count in sorted(stats["tags"].items(), key=lambda x: x[1], reverse=True)],
                "conferences": [{"conference": conf, "count": count} for conf, count in sorted(stats["conferences"].items(), key=lambda x: x[1], reverse=True)],
                "affiliations": affiliations
            })
        
        return result


def generate_static_data():
    """全データを生成してJSONファイルとして保存"""
    print("データを読み込んでいます...")
    corpus = Corpus()
    
    print("全論文データを準備しています...")
    # 全論文データを準備（TLDRとタグを含む）
    all_papers = []
    for paper in corpus.papers.values():
        paper_with_tldr = corpus._load_tldr_data(paper)
        all_papers.append(paper_with_tldr.to_dict())
    
    # 引用関係を各論文に追加
    for paper_dict in all_papers:
        paper_id = paper_dict["paperId"]
        paper_dict["cites"] = corpus.get_cites(paper_id)
        paper_dict["cited_by"] = corpus.get_cited_by(paper_id)
    
    print("メタデータを生成しています...")
    # タグ、著者、venue一覧を取得
    tags = corpus.get_all_tags()
    authors = corpus.get_all_authors()
    venues = corpus.get_all_venues()
    
    # 著者ランキングを生成
    author_ranking = corpus.get_author_ranking()
    # ソート（論文数順）
    author_ranking.sort(key=lambda x: (x["paperCount"], x["totalCitations"]), reverse=True)
    
    # 全データをまとめる
    output_data = {
        "papers": all_papers,
        "tags": tags,
        "authors": authors,
        "venues": venues,
        "authorRanking": author_ranking,
    }
    
    # 出力フォルダを作成
    OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)
    
    # JSONファイルとして保存
    output_file = OUTPUT_FOLDER / "all_data.json"
    print(f"データを {output_file} に保存しています...")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"完了！ {len(all_papers)}件の論文データを保存しました。")
    print(f"  - タグ: {len(tags)}件")
    print(f"  - 著者: {len(authors)}件")
    print(f"  - Venue: {len(venues)}件")
    print(f"  - 著者ランキング: {len(author_ranking)}件")


def main():
    """メイン関数"""
    generate_static_data()


if __name__ == "__main__":
    main()
