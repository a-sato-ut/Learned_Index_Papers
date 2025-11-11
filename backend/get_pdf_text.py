"""
PDFテキスト抽出モジュール
ダウンロード済みのPDFファイルからテキストを抽出して保存します
"""

import json
from pathlib import Path
from typing import Optional
from tqdm import tqdm
from PyPDF2 import PdfReader

# データフォルダのパス
PAPERS_FOLDER = Path("data") / "papers"
CITATIONS_FOLDER = Path("data") / "citations"
PDF_FOLDER = Path("data") / "pdfs"
PDF_TEXT_FOLDER = Path("data") / "pdf_text"
BASE_PID = "0539535989147bc7033f4a34931c7b8e17f1c650"


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


def load_pdf_path(paper_id: str) -> Optional[Path]:
    """PDFファイルのパスを取得"""
    # まず、PDF情報JSONファイルを確認
    pdf_info_file = PDF_FOLDER / f"{paper_id}.json"
    if pdf_info_file.exists():
        try:
            with open(pdf_info_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                pdf_path = PDF_FOLDER / data.get("pdfPath", f"{paper_id}.pdf")
                if pdf_path.exists() and data.get("downloaded", False):
                    return pdf_path
        except Exception as e:
            print(f"Error loading PDF info {pdf_info_file}: {e}")
    
    # PDF情報ファイルがない場合、直接PDFファイルを確認
    pdf_path = PDF_FOLDER / f"{paper_id}.pdf"
    if pdf_path.exists():
        return pdf_path
    
    return None


def clean_text(text: str) -> str:
    """テキストからサロゲートペアなどの不正な文字を除去"""
    # サロゲートペアを除去（U+D800～U+DFFF）
    return "".join(char for char in text if not (0xD800 <= ord(char) <= 0xDFFF))


def extract_text_from_pdf(pdf_path: Path) -> Optional[str]:
    """PDFファイルからテキストを抽出"""
    try:
        reader = PdfReader(pdf_path)
        text_parts = []
        
        for page in reader.pages:
            try:
                page_text = page.extract_text()
                if page_text:
                    # サロゲートペアを除去
                    page_text = clean_text(page_text)
                    text_parts.append(page_text)
            except Exception as e:
                print(f"Warning: Error extracting text from page: {e}")
                continue
        
        if not text_parts:
            print(f"Warning: No text extracted from PDF: {pdf_path}")
            return None
        
        full_text = "\n\n".join(text_parts)
        return full_text
    except Exception as e:
        print(f"Error reading PDF {pdf_path}: {e}")
        return None


def load_paper_title(paper_id: str) -> str:
    """論文のタイトルを読み込む"""
    paper_file = PAPERS_FOLDER / f"{paper_id}.json"
    if not paper_file.exists():
        return ""
    
    try:
        with open(paper_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("title", "")
    except Exception:
        return ""


def save_pdf_text(paper_id: str, title: str, text: str, pdf_path: Path) -> bool:
    """抽出したテキストをJSONファイルに保存
    
    Returns:
        bool: 保存に成功した場合はTrue、失敗した場合はFalse
    """
    PDF_TEXT_FOLDER.mkdir(parents=True, exist_ok=True)
    
    output_file = PDF_TEXT_FOLDER / f"{paper_id}.json"
    data = {
        "paperId": paper_id,
        "title": title,
        "pdfPath": str(pdf_path.relative_to(PDF_FOLDER)),
        "text": text,
        "textLength": len(text),
    }
    
    try:
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except (UnicodeEncodeError, UnicodeDecodeError) as e:
        print(f"Warning: Unicode error saving text for {paper_id}: {e}")
        return False
    except Exception as e:
        print(f"Error saving text for {paper_id}: {e}")
        return False


def main():
    """メイン関数"""
    print(f"BASE_PID: {BASE_PID}")
    print(f"PDFテキスト保存先: {PDF_TEXT_FOLDER}")
    
    # PDFテキストフォルダを作成
    PDF_TEXT_FOLDER.mkdir(parents=True, exist_ok=True)
    
    # 対象論文のIDリストを取得
    paper_ids = get_target_paper_ids()
    print(f"対象論文数: {len(paper_ids)}")
    
    # 既にテキストが抽出されている論文をスキップ
    existing_papers = set()
    if PDF_TEXT_FOLDER.exists():
        for file in PDF_TEXT_FOLDER.glob("*.json"):
            try:
                with open(file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    paper_id = data.get("paperId")
                    if paper_id:
                        existing_papers.add(paper_id)
            except Exception:
                pass
    
    # 処理が必要な論文をフィルタリング
    papers_to_process = [pid for pid in paper_ids if pid not in existing_papers]
    print(f"処理が必要な論文数: {len(papers_to_process)}")
    print(f"既に処理済みの論文数: {len(existing_papers)}")
    
    if not papers_to_process:
        print("処理が必要な論文がありません。")
        return
    
    # 各論文のPDFからテキストを抽出
    success_count = 0
    fail_count = 0
    skip_count = 0
    skip_reasons = {
        "no_pdf": 0,
        "extraction_failed": 0,
    }
    
    for paper_id in tqdm(papers_to_process, desc="PDFテキスト抽出中"):
        # PDFファイルのパスを取得
        pdf_path = load_pdf_path(paper_id)
        
        if not pdf_path:
            skip_reasons["no_pdf"] += 1
            skip_count += 1
            continue
        
        # 論文タイトルを取得
        title = load_paper_title(paper_id)
        # タイトルもクリーンアップ（念のため）
        title = clean_text(title)
        
        # PDFからテキストを抽出
        text = extract_text_from_pdf(pdf_path)
        
        if not text:
            skip_reasons["extraction_failed"] += 1
            skip_count += 1
            fail_count += 1
            continue
        
        # 保存（エラーが発生した場合はスキップ）
        if save_pdf_text(paper_id, title, text, pdf_path):
            success_count += 1
        else:
            skip_reasons["extraction_failed"] += 1
            skip_count += 1
            fail_count += 1
    
    print(f"\n完了: {success_count}件成功, {fail_count}件失敗, {skip_count}件スキップ")
    if skip_count > 0:
        print(f"スキップ理由: PDFなし={skip_reasons['no_pdf']}, 抽出失敗={skip_reasons['extraction_failed']}")


if __name__ == "__main__":
    main()

