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
  tldr?: string;
  tldr_ja?: string;
  tags?: string[];
}

export interface SearchResult {
  paper: Paper | null;
  cites: Paper[];
  cited_by: Paper[];
  message?: string;
}

export interface PapersByTagResult {
  papers: Paper[];
  tags: string[];
  count: number;
}

export interface PaperNode {
  id: string;
  paper: Paper;
  type: 'center' | 'cites' | 'cited_by';
  level?: number;
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
  level?: number;
}
