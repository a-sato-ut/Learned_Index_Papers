"""
データ整形モジュール
収集した論文データをフロントエンド用に整形し、citation networkを構築します
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# データフォルダのパス
PAPERS_FOLDER = Path("data") / "papers"
CITATIONS_FOLDER = Path("data") / "citations"
TLDR_FOLDER = Path("data") / "tldr"
TLDR_JA_FOLDER = Path("data") / "tldr_ja"
TAG_FOLDER = Path("data") / "tags"
AUTHOR_INFO_FOLDER = Path("data") / "author_info"
BASE_PID = "0539535989147bc7033f4a34931c7b8e17f1c650"

app = FastAPI(title="Learned Index Papers API")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Paper(BaseModel):
    paperId: str
    title: str
    year: Optional[int] = None
    venue: Optional[str] = None
    authors: List[str] = []
    doi: Optional[str] = None
    arxivId: Optional[str] = None
    url: Optional[str] = None
    isOpenAccess: bool = False
    openAccessPdf: Optional[str] = None
    abstract: Optional[str] = None
    citationCount: int = 0
    referenceCount: int = 0
    tldr: Optional[str] = None
    tldr_ja: Optional[str] = None
    tags: List[str] = []


class CitationInfo(BaseModel):
    paperId: str
    citationPaperIds: List[str] = []


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
                        paper = Paper(**data)
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

    def _lcs_length(self, s1: str, s2: str) -> int:
        """最長共通部分列（LCS）の長さを計算（連続しない文字列を許す）"""
        m, n = len(s1), len(s2)
        dp = [[0] * (n + 1) for _ in range(m + 1)]

        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if s1[i - 1].lower() == s2[j - 1].lower():
                    dp[i][j] = dp[i - 1][j - 1] + 1
                else:
                    dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])

        return dp[m][n]

    def _lcss_length(self, s1: str, s2: str) -> int:
        """最長共通部分文字列（LCSS）の長さを計算（連続する部分のみ）"""
        m, n = len(s1), len(s2)
        dp = [[0] * (n + 1) for _ in range(m + 1)]
        max_length = 0

        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if s1[i - 1].lower() == s2[j - 1].lower():
                    dp[i][j] = dp[i - 1][j - 1] + 1
                    max_length = max(max_length, dp[i][j])
                else:
                    dp[i][j] = 0  # 連続する必要があるため、不一致なら0

        return max_length

    def best_match_by_title(self, query: str) -> Optional[Paper]:
        """タイトルに対するLCSが最大のものを返す。LCSが同じ場合はタイトルが短いものを返す"""
        if not query:
            return None

        def get_sort_key_value(paper: Paper) -> Tuple[int, int, int]:
            # smaller the better
            lcs_len = self._lcs_length(query.lower(), paper.title.lower())
            lcss_len = self._lcss_length(query.lower(), paper.title.lower())
            return  -lcss_len, -lcs_len, len(paper.title), paper.paperId

        best_match = sorted(self.papers.values(), key=get_sort_key_value)[0]
        # TLDRデータを読み込む
        return self._load_tldr_data(best_match)

    def get_paper(self, paper_id: str) -> Optional[Paper]:
        """論文IDで論文を取得"""
        paper = self.papers.get(paper_id)
        if paper:
            # TLDRデータを読み込んで追加
            paper = self._load_tldr_data(paper)
        return paper
    
    def _load_tldr_data(self, paper: Paper) -> Paper:
        """論文のTLDRデータとタグデータを読み込む"""
        paper_dict = paper.dict()
        
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
        
        return Paper(**paper_dict)

    def get_cites(self, paper_id: str, limit: int = 2000, tags: Optional[List[str]] = None, authors: Optional[List[str]] = None, venues: Optional[List[str]] = None, min_year: Optional[int] = None) -> List[Paper]:
        """この論文が引用している論文のリストを取得（cited_byの数が多い順）"""
        citation_ids = self.cites.get(paper_id, [])
        papers = [self.papers[pid] for pid in citation_ids if pid in self.papers]
        papers.sort(key=lambda p: p.citationCount, reverse=True)
        # TLDRデータを読み込む
        papers_with_tldr = [self._load_tldr_data(p) for p in papers[:limit]]
        
        # タグでフィルタリング（複数タグの場合はAND条件）
        if tags:
            papers_with_tldr = [
                p for p in papers_with_tldr 
                if p.tags and all(tag in p.tags for tag in tags)
            ]
        
        # 著者でフィルタリング（複数著者の場合はAND条件）
        if authors:
            papers_with_tldr = [
                p for p in papers_with_tldr 
                if p.authors and all(author in p.authors for author in authors)
            ]
        
        # venueでフィルタリング（複数venueの場合はOR条件、1つの論文は1つのvenueしか持たないため）
        # 年を除去して正規化したvenue名で比較
        if venues:
            normalized_venues = [normalize_venue(v) for v in venues]
            papers_with_tldr = [
                p for p in papers_with_tldr 
                if p.venue and normalize_venue(p.venue) in normalized_venues
            ]
        
        return papers_with_tldr

    def get_cited_by(self, paper_id: str, limit: int = 2000, tags: Optional[List[str]] = None, authors: Optional[List[str]] = None, venues: Optional[List[str]] = None, min_year: Optional[int] = None) -> List[Paper]:
        """この論文を引用している論文のリストを取得（cited_byの数が多い順）"""
        cited_by_ids = self.cited_by.get(paper_id, [])
        papers = [self.papers[pid] for pid in cited_by_ids if pid in self.papers]
        papers.sort(key=lambda p: p.citationCount, reverse=True)
        # TLDRデータを読み込む
        papers_with_tldr = [self._load_tldr_data(p) for p in papers[:limit]]
        
        # タグでフィルタリング（複数タグの場合はAND条件）
        if tags:
            papers_with_tldr = [
                p for p in papers_with_tldr 
                if p.tags and all(tag in p.tags for tag in tags)
            ]
        
        # 著者でフィルタリング（複数著者の場合はAND条件）
        if authors:
            papers_with_tldr = [
                p for p in papers_with_tldr 
                if p.authors and all(author in p.authors for author in authors)
            ]
        
        # venueでフィルタリング（複数venueの場合はOR条件、1つの論文は1つのvenueしか持たないため）
        # 年を除去して正規化したvenue名で比較
        if venues:
            normalized_venues = [normalize_venue(v) for v in venues]
            papers_with_tldr = [
                p for p in papers_with_tldr 
                if p.venue and normalize_venue(p.venue) in normalized_venues
            ]
        
        # 年でフィルタリング（min_year以降の論文のみ）
        if min_year is not None:
            papers_with_tldr = [
                p for p in papers_with_tldr 
                if p.year is not None and p.year >= min_year
            ]
        
        return papers_with_tldr

    def get_papers_by_tags(self, tags: List[str], limit: int = 2000, min_year: Optional[int] = None) -> List[Paper]:
        """指定されたタグを全て持つ論文を取得（citationCountが多い順、AND条件）"""
        papers_with_tags = []
        for paper in self.papers.values():
            paper_with_tldr = self._load_tldr_data(paper)
            if paper_with_tldr.tags and all(tag in paper_with_tldr.tags for tag in tags):
                # 年フィルタリング
                if min_year is None or (paper_with_tldr.year is not None and paper_with_tldr.year >= min_year):
                    papers_with_tags.append(paper_with_tldr)
        
        papers_with_tags.sort(key=lambda p: p.citationCount, reverse=True)
        return papers_with_tags[:limit]

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

    def get_papers_by_authors(self, authors: List[str], limit: int = 2000, min_year: Optional[int] = None) -> List[Paper]:
        """指定された著者を全て含む論文を取得（citationCountが多い順、AND条件）"""
        papers_with_authors = []
        for paper in self.papers.values():
            paper_with_tldr = self._load_tldr_data(paper)
            if paper_with_tldr.authors and all(author in paper_with_tldr.authors for author in authors):
                # 年フィルタリング
                if min_year is None or (paper_with_tldr.year is not None and paper_with_tldr.year >= min_year):
                    papers_with_authors.append(paper_with_tldr)
        
        papers_with_authors.sort(key=lambda p: p.citationCount, reverse=True)
        return papers_with_authors[:limit]

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

    def get_papers_by_venues(self, venues: List[str], limit: int = 2000, min_year: Optional[int] = None) -> List[Paper]:
        """指定されたvenueのいずれかに一致する論文を取得（citationCountが多い順、OR条件）"""
        # 年を除去して正規化したvenue名で比較
        normalized_venues = [normalize_venue(v) for v in venues]
        papers_with_venues = []
        for paper in self.papers.values():
            paper_with_tldr = self._load_tldr_data(paper)
            if paper_with_tldr.venue and normalize_venue(paper_with_tldr.venue) in normalized_venues:
                # 年フィルタリング
                if min_year is None or (paper_with_tldr.year is not None and paper_with_tldr.year >= min_year):
                    papers_with_venues.append(paper_with_tldr)
        
        papers_with_venues.sort(key=lambda p: p.citationCount, reverse=True)
        return papers_with_venues[:limit]

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


# グローバルCorpusインスタンス
corpus = Corpus()


@app.get("/api/search")
async def search(
    query: str = Query(..., description="検索クエリ"), 
    limit: int = Query(2000, ge=1, le=2000),
    tags: Optional[str] = Query(None, description="タグでフィルタリング（カンマ区切りで複数指定可能）"),
    authors: Optional[str] = Query(None, description="著者でフィルタリング（カンマ区切りで複数指定可能）"),
    venues: Optional[str] = Query(None, description="学会/ジャーナルでフィルタリング（カンマ区切りで複数指定可能、OR条件）"),
    min_year: Optional[int] = Query(None, description="この年以降の論文のみを対象とする")
):
    """タイトルでLCS検索してベストマッチを返す"""
    best_match = corpus.best_match_by_title(query)
    if not best_match:
        return {"paper": None, "message": "No match found"}

    # タグをパース（カンマ区切り）
    tag_list = None
    if tags:
        tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]

    # 著者をパース（カンマ区切り）
    author_list = None
    if authors:
        author_list = [author.strip() for author in authors.split(',') if author.strip()]

    # venueをパース（カンマ区切り）
    venue_list = None
    if venues:
        venue_list = [venue.strip() for venue in venues.split(',') if venue.strip()]

    return {
        "paper": best_match.dict(),
        "cites": [p.dict() for p in corpus.get_cites(best_match.paperId, limit, tag_list, author_list, venue_list, min_year)],
        "cited_by": [p.dict() for p in corpus.get_cited_by(best_match.paperId, limit, tag_list, author_list, venue_list, min_year)],
    }


@app.get("/api/paper/{paper_id}")
async def get_paper(
    paper_id: str, 
    limit: int = Query(2000, ge=1, le=2000),
    tags: Optional[str] = Query(None, description="タグでフィルタリング（カンマ区切りで複数指定可能）"),
    authors: Optional[str] = Query(None, description="著者でフィルタリング（カンマ区切りで複数指定可能）"),
    venues: Optional[str] = Query(None, description="学会/ジャーナルでフィルタリング（カンマ区切りで複数指定可能、OR条件）"),
    min_year: Optional[int] = Query(None, description="この年以降の論文のみを対象とする")
):
    """論文IDで論文と引用関係を取得"""
    paper = corpus.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    # タグをパース（カンマ区切り）
    tag_list = None
    if tags:
        tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]

    # 著者をパース（カンマ区切り）
    author_list = None
    if authors:
        author_list = [author.strip() for author in authors.split(',') if author.strip()]

    # venueをパース（カンマ区切り）
    venue_list = None
    if venues:
        venue_list = [venue.strip() for venue in venues.split(',') if venue.strip()]

    return {
        "paper": paper.dict(),
        "cites": [p.dict() for p in corpus.get_cites(paper_id, limit, tag_list, author_list, venue_list, min_year)],
        "cited_by": [p.dict() for p in corpus.get_cited_by(paper_id, limit, tag_list, author_list, venue_list, min_year)],
    }


@app.get("/api/papers/by-tag")
async def get_papers_by_tag(
    tags: str = Query(..., description="タグ名（カンマ区切りで複数指定可能、AND条件）"),
    limit: int = Query(2000, ge=1, le=2000),
    min_year: Optional[int] = Query(None, description="この年以降の論文のみを対象とする")
):
    """指定されたタグを全て持つ論文を取得（AND条件）"""
    # タグをパース（カンマ区切り）
    tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]
    if not tag_list:
        raise HTTPException(status_code=400, detail="At least one tag is required")
    
    papers = corpus.get_papers_by_tags(tag_list, limit, min_year)
    return {
        "papers": [p.dict() for p in papers],
        "tags": tag_list,
        "count": len(papers)
    }


@app.get("/api/tags")
async def get_tags():
    """利用可能な全てのタグとその件数を取得"""
    tags = corpus.get_all_tags()
    return {"tags": tags}


@app.get("/api/papers/by-author")
async def get_papers_by_author(
    authors: str = Query(..., description="著者名（カンマ区切りで複数指定可能、AND条件）"),
    limit: int = Query(2000, ge=1, le=2000),
    min_year: Optional[int] = Query(None, description="この年以降の論文のみを対象とする")
):
    """指定された著者を全て含む論文を取得（AND条件）"""
    # 著者をパース（カンマ区切り）
    author_list = [author.strip() for author in authors.split(',') if author.strip()]
    if not author_list:
        raise HTTPException(status_code=400, detail="At least one author is required")
    
    papers = corpus.get_papers_by_authors(author_list, limit, min_year)
    return {
        "papers": [p.dict() for p in papers],
        "authors": author_list,
        "count": len(papers)
    }


@app.get("/api/authors")
async def get_authors():
    """利用可能な全ての著者とその件数を取得"""
    authors = corpus.get_all_authors()
    return {"authors": authors}


@app.get("/api/authors/ranking")
async def get_author_ranking(
    sort_by: str = Query("paperCount", description="ソート基準: 'paperCount' または 'totalCitations'"),
    min_year: Optional[int] = Query(None, description="この年以降の論文のみを集計対象とする")
):
    """著者ランキングを取得（論文数、被引用数、タグ集計、カンファレンス集計を含む）"""
    ranking = corpus.get_author_ranking(min_year=min_year)
    
    # ソート（第1キーでソート、同じ値の場合は第2キーでソート）
    if sort_by == "totalCitations":
        # 被引用数順（同じ被引用数の場合は論文数が多い順）
        ranking.sort(key=lambda x: (x["totalCitations"], x["paperCount"]), reverse=True)
    else:  # デフォルトは論文数
        # 論文数順（同じ論文数の場合は被引用数が多い順）
        ranking.sort(key=lambda x: (x["paperCount"], x["totalCitations"]), reverse=True)
    
    return {"ranking": ranking}


@app.get("/api/papers/by-venue")
async def get_papers_by_venue(
    venues: str = Query(..., description="学会/ジャーナル名（カンマ区切りで複数指定可能、OR条件）"),
    limit: int = Query(2000, ge=1, le=2000),
    min_year: Optional[int] = Query(None, description="この年以降の論文のみを対象とする")
):
    """指定されたvenueのいずれかに一致する論文を取得（OR条件）"""
    # venueをパース（カンマ区切り）
    venue_list = [venue.strip() for venue in venues.split(',') if venue.strip()]
    if not venue_list:
        raise HTTPException(status_code=400, detail="At least one venue is required")
    
    papers = corpus.get_papers_by_venues(venue_list, limit, min_year)
    return {
        "papers": [p.dict() for p in papers],
        "venues": venue_list,
        "count": len(papers)
    }


@app.get("/api/venues")
async def get_venues():
    """利用可能な全ての学会/ジャーナルとその件数を取得"""
    venues = corpus.get_all_venues()
    return {"venues": venues}


@app.get("/api/papers/all")
async def get_all_papers():
    """全論文を取得"""
    papers = [corpus._load_tldr_data(p).dict() for p in corpus.papers.values()]
    return {"papers": papers, "count": len(papers)}


def main():
    """メイン関数"""
    # 出力フォルダを作成
    print("API server is ready. Run with: uvicorn process_data:app --reload --port 8000")


if __name__ == "__main__":
    main()
