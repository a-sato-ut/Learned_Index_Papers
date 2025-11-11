"""
PDF取得モジュール
論文のメタデータからopenAccessPdfのURLを取得し、PDFをダウンロードして保存します
"""

import json
import os
import time
from pathlib import Path
from typing import Optional
from tqdm import tqdm
import requests

# データフォルダのパス
PAPERS_FOLDER = Path("data") / "papers"
CITATIONS_FOLDER = Path("data") / "citations"
PDF_FOLDER = Path("data") / "pdfs"
BASE_PID = "0539535989147bc7033f4a34931c7b8e17f1c650"

# リトライ設定
_DEFAULT_TIMEOUT = 30
_DELAY_BASE = 2
_MAX_RETRIES = 3
_BACKOFF_BASE = 2


def get_target_paper_ids() -> list[str]:
    """BASE_PIDとそれを引用している論文のIDリストを取得"""
    paper_ids = {BASE_PID}  # BASE_PID自体を含める
    
    # BASE_PIDを引用している論文のリストを取得
    citation_file = CITATIONS_FOLDER / f"{BASE_PID}.json"
    if citation_file.exists():
        with open(citation_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            citing_paper_ids = data.get("citationPaperIds", [])
            paper_ids.update(citing_paper_ids)
            print(f"Found {len(citing_paper_ids)} papers citing BASE_PID")
    else:
        print(f"Warning: Citation file not found: {citation_file}")
    
    return list(paper_ids)


def load_paper_metadata(paper_id: str) -> Optional[dict]:
    """論文のメタデータを読み込む"""
    paper_file = PAPERS_FOLDER / f"{paper_id}.json"
    if not paper_file.exists():
        print(f"Warning: Paper file not found: {paper_file}")
        return None
    
    try:
        with open(paper_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading paper {paper_file}: {e}")
        return None


def download_pdf(url: str, output_path: Path) -> bool:
    """PDFをダウンロードして保存"""
    last_err = None
    for attempt in range(_MAX_RETRIES):
        try:
            response = requests.get(
                url,
                timeout=_DEFAULT_TIMEOUT,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            )
            if response.status_code == 200:
                # Content-Typeをチェック
                content_type = response.headers.get("Content-Type", "").lower()
                if "pdf" not in content_type and not url.lower().endswith(".pdf"):
                    # PDFでない可能性があるが、Content-Typeが正確でない場合もあるので続行
                    pass
                
                # PDFファイルとして保存
                with open(output_path, "wb") as f:
                    f.write(response.content)
                return True
            elif response.status_code in (429, 500, 502, 503, 504):
                # レート制限やサーバーエラーの場合はリトライ
                delay = (_BACKOFF_BASE ** attempt) + (_DELAY_BASE * attempt)
                time.sleep(delay)
                continue
            else:
                print(f"HTTP error {response.status_code} for {url}")
                return False
        except requests.RequestException as e:
            # ネットワーク系エラーもリトライ
            delay = (_BACKOFF_BASE ** attempt) + (_DELAY_BASE * attempt)
            time.sleep(delay)
            last_err = e
    
    print(f"Failed to download PDF after {_MAX_RETRIES} retries: {url}")
    if last_err:
        print(f"Last error: {last_err}")
    return False


def get_pdf_url_candidates_from_metadata(metadata: dict) -> list[tuple[str, str]]:
    """
    メタデータからPDFのURL候補を取得（複数の候補を返す）
    優先順位: openAccessPdf > arxivId > doi
    戻り値: [(pdf_url, source), ...] のリスト、見つからない場合は空リスト
    """
    candidates = []
    
    # 1. openAccessPdfを確認
    open_access_pdf = metadata.get("openAccessPdf")
    if open_access_pdf:
        candidates.append((open_access_pdf, "openAccessPdf"))
    
    # 2. ArXiv IDからPDF URLを構築
    arxiv_id = metadata.get("arxivId")
    if arxiv_id:
        # ArXiv IDの形式を正規化（バージョン番号を除去）
        arxiv_id_clean = arxiv_id.split("v")[0]
        arxiv_pdf_url = f"https://arxiv.org/pdf/{arxiv_id_clean}.pdf"
        candidates.append((arxiv_pdf_url, "arxiv"))
    
    # 3. DOIからPDF URLを構築（試行）
    # doi = metadata.get("doi")
    # if doi:
    #     # DOIから直接PDFを取得するのは難しいが、一部の出版社では可能
    #     # ここでは試行のみ（成功する可能性は低い）
    #     doi_pdf_url = f"https://doi.org/{doi}"
    #     candidates.append((doi_pdf_url, "doi"))
    
    return candidates


def save_pdf_info(paper_id: str, title: str, pdf_url: str, pdf_path: Path, source: str):
    """PDF情報をJSONファイルに保存"""
    PDF_FOLDER.mkdir(parents=True, exist_ok=True)
    
    info_file = PDF_FOLDER / f"{paper_id}.json"
    data = {
        "paperId": paper_id,
        "title": title,
        "pdfUrl": pdf_url,
        "pdfPath": str(pdf_path.relative_to(PDF_FOLDER)),
        "source": source,  # openAccessPdf, arxiv, doi
        "downloaded": True,
    }
    
    with open(info_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def main():
    """メイン関数"""
    print(f"BASE_PID: {BASE_PID}")
    print(f"PDF保存先: {PDF_FOLDER}")
    
    # PDFフォルダを作成
    PDF_FOLDER.mkdir(parents=True, exist_ok=True)
    
    # 対象論文のIDリストを取得
    paper_ids = get_target_paper_ids()
    print(f"対象論文数: {len(paper_ids)}")
    
    # 既にPDFがダウンロードされている論文をスキップ
    existing_papers = set()
    if PDF_FOLDER.exists():
        for file in PDF_FOLDER.glob("*.json"):
            try:
                with open(file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    paper_id = data.get("paperId")
                    if paper_id:
                        # PDFファイルも存在するか確認
                        pdf_path = PDF_FOLDER / data.get("pdfPath", f"{paper_id}.pdf")
                        if pdf_path.exists() and data.get("downloaded", False):
                            existing_papers.add(paper_id)
            except Exception:
                pass
    
    # 処理が必要な論文をフィルタリング
    papers_to_process = [pid for pid in paper_ids if pid not in existing_papers]
    print(f"処理が必要な論文数: {len(papers_to_process)}")
    print(f"既にダウンロード済みの論文数: {len(existing_papers)}")
    
    if not papers_to_process:
        print("処理が必要な論文がありません。")
        return
    
    # 各論文のPDFをダウンロード
    success_count = 0
    fail_count = 0
    skip_count = 0
    skip_reasons = {
        "no_metadata": 0,
        "no_pdf_source": 0,
    }
    
    for paper_id in tqdm(papers_to_process, desc="PDFダウンロード中"):
        # 論文情報を読み込む
        metadata = load_paper_metadata(paper_id)
        
        if not metadata:
            skip_reasons["no_metadata"] += 1
            skip_count += 1
            continue
        
        # PDF URL候補を取得（openAccessPdf > arxiv > doiの優先順位）
        pdf_candidates = get_pdf_url_candidates_from_metadata(metadata)
        title = metadata.get("title", "")
        
        if not pdf_candidates:
            skip_reasons["no_pdf_source"] += 1
            skip_count += 1
            continue
        
        # PDFファイルの保存パス
        pdf_path = PDF_FOLDER / f"{paper_id}.pdf"
        
        # 各候補を順に試す
        downloaded = False
        successful_url = None
        successful_source = None
        
        for pdf_url, source in pdf_candidates:
            if download_pdf(pdf_url, pdf_path):
                # ダウンロード成功
                downloaded = True
                successful_url = pdf_url
                successful_source = source
                break
            # 失敗した場合は次の候補を試す
        
        if downloaded:
            # PDF情報を保存（成功したURLとソースを記録）
            save_pdf_info(paper_id, title, successful_url, pdf_path, successful_source)
            success_count += 1
        else:
            # 全ての候補が失敗した場合
            fail_count += 1
    
    print(f"\n完了: {success_count}件成功, {fail_count}件失敗, {skip_count}件スキップ")
    if skip_count > 0:
        print(f"スキップ理由: メタデータなし={skip_reasons['no_metadata']}, PDFソースなし={skip_reasons['no_pdf_source']}")


if __name__ == "__main__":
    main()

