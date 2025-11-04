export interface Paper {
  paperId: string;
  title: string;
  year?: number;
  venue?: string;
  authors: string[];
  doi?: string;
  arxivId?: string;
  url?: string;
  isOpenAccess: boolean;
  openAccessPdf?: string;
  abstract?: string;
  citationCount: number;
  referenceCount: number;
}

export interface SearchResult {
  paper: Paper | null;
  cites: Paper[];
  cited_by: Paper[];
  message?: string;
}

export interface PaperNode {
  id: string;
  paper: Paper;
  type: 'center' | 'cites' | 'cited_by';
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
}

export interface PaperEdge {
  source: string;
  target: string;
  type: 'cites' | 'cited_by';
}
