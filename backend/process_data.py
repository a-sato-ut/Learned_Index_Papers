"""
データ整形モジュール
収集した論文データをフロントエンド用に整形し、citation networkを構築します
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# データフォルダのパス
PAPERS_FOLDER = Path(__file__).parent.parent / "data" / "papers"
CITATIONS_FOLDER = Path(__file__).parent.parent / "data" / "citations"
PROCESSED_DATA_FOLDER = Path(__file__).parent.parent / "processed_data"
TLDR_FOLDER = Path(__file__).parent.parent / "data" / "tldr"
TLDR_JA_FOLDER = Path(__file__).parent.parent / "data" / "tldr_ja"
TAG_FOLDER = Path(__file__).parent.parent / "data" / "tags"
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

    def get_cites(self, paper_id: str, limit: int = 2000, tags: Optional[List[str]] = None) -> List[Paper]:
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
        
        return papers_with_tldr

    def get_cited_by(self, paper_id: str, limit: int = 2000, tags: Optional[List[str]] = None) -> List[Paper]:
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
        
        return papers_with_tldr

    def get_papers_by_tags(self, tags: List[str], limit: int = 2000) -> List[Paper]:
        """指定されたタグを全て持つ論文を取得（citationCountが多い順、AND条件）"""
        papers_with_tags = []
        for paper in self.papers.values():
            paper_with_tldr = self._load_tldr_data(paper)
            if paper_with_tldr.tags and all(tag in paper_with_tldr.tags for tag in tags):
                papers_with_tags.append(paper_with_tldr)
        
        papers_with_tags.sort(key=lambda p: p.citationCount, reverse=True)
        return papers_with_tags[:limit]

    def get_all_tags(self) -> List[str]:
        """利用可能な全てのタグを取得"""
        tags = set()
        for paper in self.papers.values():
            paper_with_tldr = self._load_tldr_data(paper)
            if paper_with_tldr.tags:
                tags.update(paper_with_tldr.tags)
        return sorted(list(tags))


# グローバルCorpusインスタンス
corpus = Corpus()


@app.get("/api/search")
async def search(
    query: str = Query(..., description="検索クエリ"), 
    limit: int = Query(2000, ge=1, le=2000),
    tags: Optional[str] = Query(None, description="タグでフィルタリング（カンマ区切りで複数指定可能）")
):
    """タイトルでLCS検索してベストマッチを返す"""
    best_match = corpus.best_match_by_title(query)
    if not best_match:
        return {"paper": None, "message": "No match found"}

    # タグをパース（カンマ区切り）
    tag_list = None
    if tags:
        tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]

    return {
        "paper": best_match.dict(),
        "cites": [p.dict() for p in corpus.get_cites(best_match.paperId, limit, tag_list)],
        "cited_by": [p.dict() for p in corpus.get_cited_by(best_match.paperId, limit, tag_list)],
    }


@app.get("/api/paper/{paper_id}")
async def get_paper(
    paper_id: str, 
    limit: int = Query(2000, ge=1, le=2000),
    tags: Optional[str] = Query(None, description="タグでフィルタリング（カンマ区切りで複数指定可能）")
):
    """論文IDで論文と引用関係を取得"""
    paper = corpus.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    # タグをパース（カンマ区切り）
    tag_list = None
    if tags:
        tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]

    return {
        "paper": paper.dict(),
        "cites": [p.dict() for p in corpus.get_cites(paper_id, limit, tag_list)],
        "cited_by": [p.dict() for p in corpus.get_cited_by(paper_id, limit, tag_list)],
    }


@app.get("/api/papers/by-tag")
async def get_papers_by_tag(
    tags: str = Query(..., description="タグ名（カンマ区切りで複数指定可能、AND条件）"),
    limit: int = Query(2000, ge=1, le=2000)
):
    """指定されたタグを全て持つ論文を取得（AND条件）"""
    # タグをパース（カンマ区切り）
    tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]
    if not tag_list:
        raise HTTPException(status_code=400, detail="At least one tag is required")
    
    papers = corpus.get_papers_by_tags(tag_list, limit)
    return {
        "papers": [p.dict() for p in papers],
        "tags": tag_list,
        "count": len(papers)
    }


@app.get("/api/tags")
async def get_tags():
    """利用可能な全てのタグを取得"""
    tags = corpus.get_all_tags()
    return {"tags": tags}


def main():
    """メイン関数"""
    # 出力フォルダを作成
    PROCESSED_DATA_FOLDER.mkdir(parents=True, exist_ok=True)
    print("API server is ready. Run with: uvicorn process_data:app --reload --port 8000")


if __name__ == "__main__":
    main()
