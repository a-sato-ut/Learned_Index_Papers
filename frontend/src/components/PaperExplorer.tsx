import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as d3 from 'd3';
import { Paper, SearchResult, PaperNode, PaperEdge, PapersByTagResult, PapersByAuthorResult, PapersByVenueResult } from '../types';
import { loadAllData, searchByTitle, filterPapers, getPapersByTag, getPapersByAuthor, getPapersByVenue, getPaperById, AllData } from '../dataLoader';
import './PaperExplorer.css';

// 円グラフの共通ハイパーパラメータ
const PIE_CHART_CONFIG = {
  topN: 40, // 上位何件を表示するか
  width: 600,
  pieRadius: 120,
  pieHeight: 300,
  legendItemHeight: 22,
  legendColumns: 1,
  legendColumnWidth: 280,
  maxTextLength: 50, // 凡例のテキストの最大文字数
};

interface PaperExplorerProps {}

const PaperExplorer: React.FC<PaperExplorerProps> = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AllData | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'graph' | 'graphYear'>('list');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<Array<{tag: string, count: number}>>([]);
  const [tagResult, setTagResult] = useState<PapersByTagResult | null>(null);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [availableAuthors, setAvailableAuthors] = useState<Array<{author: string, count: number}>>([]);
  const [authorResult, setAuthorResult] = useState<PapersByAuthorResult | null>(null);
  const [authorDropdownOpen, setAuthorDropdownOpen] = useState(false);
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]);
  const [availableVenues, setAvailableVenues] = useState<Array<{venue: string, count: number}>>([]);
  const [venueResult, setVenueResult] = useState<PapersByVenueResult | null>(null);
  const [venueDropdownOpen, setVenueDropdownOpen] = useState(false);
  const [minYear, setMinYear] = useState<number | null>(null);
  const [yearFilterOpen, setYearFilterOpen] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const drawGraphRef = useRef<((data: SearchResult) => void) | null>(null);
  const drawGraphYearRef = useRef<((data: SearchResult) => void) | null>(null);
  const searchPapersRef = useRef<((searchQuery?: string) => void) | null>(null);
  const [jsonExportOpen, setJsonExportOpen] = useState(false);
  const [jsonExportFields, setJsonExportFields] = useState<Record<string, boolean>>({
    title: true,
    abstract: true,
    tldr: true,
    tldr_ja: true,
    authors: true,
    year: true,
    conference: true,
    tags: true,
    cited_by: true,
    referenceCount: true,
    links_to_paper: true,
  });

  // データを読み込む
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const loadedData = await loadAllData();
        setData(loadedData);
        setAvailableTags(loadedData.tags);
        setAvailableAuthors(loadedData.authors);
        setAvailableVenues(loadedData.venues);
      } catch (error) {
        console.error('Error loading data:', error);
        alert('データの読み込みに失敗しました。all_data.jsonファイルが存在するか確認してください。');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const searchPapers = useCallback((searchQuery?: string) => {
    if (!data) return;
    
    const queryToUse = searchQuery || query;
    
    // URLパラメータを更新（ただし、現在のURLパラメータと同じ場合は更新しない）
    const newSearchParams = new URLSearchParams();
    if (queryToUse.trim()) {
      newSearchParams.set('query', queryToUse);
    }
    if (selectedTags.length > 0) {
      newSearchParams.set('tags', selectedTags.join(','));
    }
    if (selectedAuthors.length > 0) {
      newSearchParams.set('authors', selectedAuthors.join(','));
    }
    if (selectedVenues.length > 0) {
      newSearchParams.set('venues', selectedVenues.join(','));
    }
    if (minYear !== null) {
      newSearchParams.set('min_year', minYear.toString());
    }
    
    // URLパラメータが変更された場合のみ更新
    const currentParams = searchParams.toString();
    const newParams = newSearchParams.toString();
    if (currentParams !== newParams) {
      setSearchParams(newSearchParams);
    }
    
    setLoading(true);
    
    // タイトルが空で、タグ、著者、venue、または年が指定されたら → フィルタのみでフィルタリング
    if (!queryToUse.trim() && (selectedTags.length > 0 || selectedAuthors.length > 0 || selectedVenues.length > 0 || minYear !== null)) {
      setResult(null);
      
      // タグのみの場合はタグ検索
      if (selectedTags.length > 0 && selectedAuthors.length === 0 && selectedVenues.length === 0) {
        const tagResult = getPapersByTag(selectedTags, data, minYear);
        setTagResult(tagResult);
        setAuthorResult(null);
        setVenueResult(null);
      } 
      // 著者のみの場合は著者検索
      else if (selectedAuthors.length > 0 && selectedTags.length === 0 && selectedVenues.length === 0) {
        const authorResult = getPapersByAuthor(selectedAuthors, data, minYear);
        setAuthorResult(authorResult);
        setTagResult(null);
        setVenueResult(null);
      }
      // venueのみの場合はvenue検索
      else if (selectedVenues.length > 0 && selectedTags.length === 0 && selectedAuthors.length === 0) {
        const venueResult = getPapersByVenue(selectedVenues, data, minYear);
        setVenueResult(venueResult);
        setTagResult(null);
        setAuthorResult(null);
      }
      // 複数のフィルタが指定された場合は、最初のフィルタで検索してから他のフィルタを適用
      else {
        let papers: Paper[] = [];
        let resultType: 'tag' | 'author' | 'venue' = 'tag';
        
        // 最初のフィルタで検索
        if (selectedTags.length > 0) {
          const tagResult = getPapersByTag(selectedTags, data, minYear);
          papers = tagResult.papers;
          resultType = 'tag';
        } else if (selectedAuthors.length > 0) {
          const authorResult = getPapersByAuthor(selectedAuthors, data, minYear);
          papers = authorResult.papers;
          resultType = 'author';
        } else if (selectedVenues.length > 0) {
          const venueResult = getPapersByVenue(selectedVenues, data, minYear);
          papers = venueResult.papers;
          resultType = 'venue';
        }
        
        // 他のフィルタを適用
        papers = filterPapers(papers, 
          resultType !== 'tag' ? selectedTags : undefined,
          resultType !== 'author' ? selectedAuthors : undefined,
          resultType !== 'venue' ? selectedVenues : undefined,
          minYear
        );
        
        // 結果を設定
        if (resultType === 'tag') {
          setTagResult({
            papers,
            tags: selectedTags,
            count: papers.length
          });
          setAuthorResult(null);
          setVenueResult(null);
        } else if (resultType === 'author') {
          setAuthorResult({
            papers,
            authors: selectedAuthors,
            count: papers.length
          });
          setTagResult(null);
          setVenueResult(null);
        } else {
          setVenueResult({
            papers,
            venues: selectedVenues,
            count: papers.length
          });
          setTagResult(null);
          setAuthorResult(null);
        }
      }
      
      setLoading(false);
      return;
    }

    // タイトルが空じゃなくて、フィルタが指定されたら → タイトル検索 + フィルタリング
    // タイトルが空じゃなくて、フィルタが指定されていない → 通常のタイトル検索
    if (!queryToUse.trim()) {
      setLoading(false);
      return;
    }

    setResult(null);
    setTagResult(null);
    setAuthorResult(null);
    setVenueResult(null);
    
    // タイトル検索
    const searchResult = searchByTitle(queryToUse, data);
    
    // フィルタリングを適用
    if (selectedTags.length > 0 || selectedAuthors.length > 0 || selectedVenues.length > 0 || minYear !== null) {
      searchResult.cites = filterPapers(searchResult.cites, selectedTags, selectedAuthors, selectedVenues, minYear);
      searchResult.cited_by = filterPapers(searchResult.cited_by, selectedTags, selectedAuthors, selectedVenues, minYear);
    }
    
    setResult(searchResult);
    setLoading(false);
    
    if (searchResult.paper && activeTab === 'graph') {
      setTimeout(() => drawGraphRef.current?.(searchResult), 100);
    } else if (searchResult.paper && activeTab === 'graphYear') {
      setTimeout(() => drawGraphYearRef.current?.(searchResult), 100);
    }
  }, [query, selectedTags, selectedAuthors, selectedVenues, minYear, setSearchParams, activeTab, data, searchParams]);

  // searchPapersのrefを更新
  searchPapersRef.current = searchPapers;

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchPapers();
    }
  };

  const fetchGraphNodes = useCallback((searchResult: SearchResult) => {
    if (!data) return { nodes: [], edges: [], centerPaper: null };
    
    const nodes: PaperNode[] = [];
    const edges: PaperEdge[] = [];
    const nodeMap = new Map<string, PaperNode>();
    const centerPaper = searchResult.paper!;

    const centerNode: PaperNode = {
      id: centerPaper.paperId,
      paper: centerPaper,
      type: 'center',
      level: 0,
    };
    nodes.push(centerNode);
    nodeMap.set(centerPaper.paperId, centerNode);

    // Level 1: cites
    searchResult.cites.slice(0, 20).forEach((paper) => {
      const node: PaperNode = {
        id: paper.paperId,
        paper,
        type: 'cites',
        level: 1,
      };
      nodes.push(node);
      nodeMap.set(paper.paperId, node);
      edges.push({
        source: centerPaper.paperId,
        target: paper.paperId,
        type: 'cites',
        level: 1,
      });
    });

    // Level 1: cited_by
    searchResult.cited_by.slice(0, 20).forEach((paper) => {
      if (!nodeMap.has(paper.paperId)) {
        const node: PaperNode = {
          id: paper.paperId,
          paper,
          type: 'cited_by',
          level: 1,
        };
        nodes.push(node);
        nodeMap.set(paper.paperId, node);
      }
      edges.push({
        source: paper.paperId,
        target: centerPaper.paperId,
        type: 'cited_by',
        level: 1,
      });
    });

    // Level 2: citesのcitesとcited_by
    searchResult.cites.slice(0, 20).forEach((level1Paper) => {
      const level1PaperData = getPaperById(level1Paper.paperId, data);
      if (!level1PaperData) return;
      
      const citesIds = (level1PaperData.cites || []).slice(0, 20);
      const citedByIds = (level1PaperData.cited_by || []).slice(0, 20);
      
      citesIds.forEach((paperId) => {
        const level2Paper = getPaperById(paperId, data);
        if (!level2Paper) return;
        
        // フィルタリング
        if (selectedTags.length > 0 && (!level2Paper.tags || !selectedTags.every(tag => level2Paper.tags!.includes(tag)))) {
          return;
        }
        if (selectedAuthors.length > 0 && (!level2Paper.authors || !selectedAuthors.every(author => level2Paper.authors!.includes(author)))) {
          return;
        }
        if (selectedVenues.length > 0 && !level2Paper.venue) {
          return;
        }
        
        if (!nodeMap.has(level2Paper.paperId)) {
          const node: PaperNode = {
            id: level2Paper.paperId,
            paper: level2Paper,
            type: 'cites',
            level: 2,
          };
          nodes.push(node);
          nodeMap.set(level2Paper.paperId, node);
        }
        edges.push({
          source: level1Paper.paperId,
          target: level2Paper.paperId,
          type: 'cites',
          level: 2,
        });
      });

      citedByIds.forEach((paperId: string) => {
        const level2Paper = getPaperById(paperId, data);
        if (!level2Paper) return;
        
        // フィルタリング
        if (selectedTags.length > 0 && (!level2Paper.tags || !selectedTags.every(tag => level2Paper.tags!.includes(tag)))) {
          return;
        }
        if (selectedAuthors.length > 0 && (!level2Paper.authors || !selectedAuthors.every(author => level2Paper.authors!.includes(author)))) {
          return;
        }
        if (selectedVenues.length > 0 && !level2Paper.venue) {
          return;
        }
        
        if (!nodeMap.has(level2Paper.paperId)) {
          const node: PaperNode = {
            id: level2Paper.paperId,
            paper: level2Paper,
            type: 'cited_by',
            level: 2,
          };
          nodes.push(node);
          nodeMap.set(level2Paper.paperId, node);
        }
        edges.push({
          source: level2Paper.paperId,
          target: level1Paper.paperId,
          type: 'cited_by',
          level: 2,
        });
      });
    });

    // Level 2: cited_byのcitesとcited_by
    searchResult.cited_by.slice(0, 20).forEach((level1Paper) => {
      const level1PaperData = getPaperById(level1Paper.paperId, data);
      if (!level1PaperData) return;
      
      const citesIds = (level1PaperData.cites || []).slice(0, 20);
      const citedByIds = (level1PaperData.cited_by || []).slice(0, 20);
      
      citesIds.forEach((paperId) => {
        const level2Paper = getPaperById(paperId, data);
        if (!level2Paper) return;
        
        // フィルタリング
        if (selectedTags.length > 0 && (!level2Paper.tags || !selectedTags.every(tag => level2Paper.tags!.includes(tag)))) {
          return;
        }
        if (selectedAuthors.length > 0 && (!level2Paper.authors || !selectedAuthors.every(author => level2Paper.authors!.includes(author)))) {
          return;
        }
        if (selectedVenues.length > 0 && !level2Paper.venue) {
          return;
        }
        
        if (!nodeMap.has(level2Paper.paperId)) {
          const node: PaperNode = {
            id: level2Paper.paperId,
            paper: level2Paper,
            type: 'cited_by',
            level: 2,
          };
          nodes.push(node);
          nodeMap.set(level2Paper.paperId, node);
        }
        edges.push({
          source: level1Paper.paperId,
          target: level2Paper.paperId,
          type: 'cites',
          level: 2,
        });
      });

      citedByIds.forEach((paperId: string) => {
        const level2Paper = getPaperById(paperId, data);
        if (!level2Paper) return;
        
        // フィルタリング
        if (selectedTags.length > 0 && (!level2Paper.tags || !selectedTags.every(tag => level2Paper.tags!.includes(tag)))) {
          return;
        }
        if (selectedAuthors.length > 0 && (!level2Paper.authors || !selectedAuthors.every(author => level2Paper.authors!.includes(author)))) {
          return;
        }
        if (selectedVenues.length > 0 && !level2Paper.venue) {
          return;
        }
        
        if (!nodeMap.has(level2Paper.paperId)) {
          const node: PaperNode = {
            id: level2Paper.paperId,
            paper: level2Paper,
            type: 'cited_by',
            level: 2,
          };
          nodes.push(node);
          nodeMap.set(level2Paper.paperId, node);
        }
        edges.push({
          source: level2Paper.paperId,
          target: level1Paper.paperId,
          type: 'cited_by',
          level: 2,
        });
      });
    });

    return { nodes, edges, centerPaper };
  }, [selectedTags, selectedAuthors, selectedVenues, data]);

  const drawGraph = useCallback((searchResult: SearchResult) => {
    if (!svgRef.current || !searchResult.paper) return;

    const { nodes, edges, centerPaper } = fetchGraphNodes(searchResult);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 1200;
    const height = svgRef.current.clientHeight || 800;

    const g = svg.append('g');

    if (!centerPaper) return;
    
    const centerNode = nodes.find(n => n.id === centerPaper.paperId);
    if (centerNode) {
      centerNode.fx = width / 2;
      centerNode.fy = height / 2;
    }

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll<SVGLineElement, PaperEdge>('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke', (d) => {
        if (d.level === 2) return '#9ca3af';
        return d.type === 'cites' ? '#3b82f6' : '#ef4444';
      })
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6);

    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, PaperNode>('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .call(
        d3
          .drag<SVGGElement, PaperNode>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended)
      )
      .on('mouseover', function(_event, d) {
        if (tooltipTimeout) {
          clearTimeout(tooltipTimeout);
          tooltipTimeout = null;
        }
        
        hoveredNode = d;
        const paper = d.paper;
        
        const previousDiv = tooltipForeignObject.select('div').node() as HTMLDivElement | null;
        if (previousDiv) {
          previousDiv.onclick = null;
        }
        
        const tooltipDiv = tooltipForeignObject
          .html('')
          .append('xhtml:div')
          .attr('class', `paper-card paper-card-${d.type === 'center' ? 'cites' : d.type}`)
          .style('cursor', 'pointer')
          .style('pointer-events', 'auto')
          .html(`
            <div class="paper-card-header">
              <h3 class="paper-card-title">${paper.title}</h3>
              <span class="paper-card-type">${d.type === 'center' ? 'Center' : d.type === 'cites' ? 'Cites' : 'Cited by'}</span>
            </div>
            <div class="paper-card-meta">
              ${paper.year ? `<span class="paper-card-year">${paper.year}</span>` : ''}
              ${paper.venue ? `<span class="paper-card-venue">${paper.venue}</span>` : ''}
              ${paper.authors.length > 0 ? `<span class="paper-card-authors">${paper.authors.slice(0, 10).join(', ')}${paper.authors.length > 10 ? '...' : ''}</span>` : ''}
            </div>
            ${paper.abstract ? `<p class="paper-card-abstract">${paper.abstract.substring(0, 200)}...</p>` : ''}
            <div class="paper-card-footer">
              <div class="paper-card-stats">
                <span>Cited by: ${paper.citationCount}</span>
                <span>ReferenceCount: ${paper.referenceCount}</span>
              </div>
              <div class="paper-card-links">
                ${paper.arxivId ? `<a href="https://arxiv.org/abs/${paper.arxivId}" target="_blank" rel="noopener noreferrer" class="paper-card-link">arXiv</a>` : ''}
                ${paper.doi ? `<a href="https://doi.org/${paper.doi}" target="_blank" rel="noopener noreferrer" class="paper-card-link">DOI</a>` : ''}
                ${paper.url ? `<a href="${paper.url}" target="_blank" rel="noopener noreferrer" class="paper-card-link">S2</a>` : ''}
                ${paper.openAccessPdf ? `<a href="${paper.openAccessPdf}" target="_blank" rel="noopener noreferrer" class="paper-card-link">PDF</a>` : ''}
              </div>
            </div>
          `);
        
        const divElement = tooltipDiv.node() as HTMLDivElement;
        if (divElement) {
          divElement.onclick = (e: MouseEvent) => {
            e.stopPropagation();
            // Commandキー（Mac）またはCtrlキー（Windows/Linux）が押されている場合は新しいタブで開く
            if (e.metaKey || e.ctrlKey) {
              const url = `/?query=${encodeURIComponent(paper.title)}`;
              window.open(url, '_blank');
              return;
            }
            setQuery(paper.title);
            setActiveTab('list');
            searchPapersRef.current?.(paper.title);
          };
          divElement.onmouseenter = () => {
            if (tooltipTimeout) {
              clearTimeout(tooltipTimeout);
              tooltipTimeout = null;
            }
          };
          divElement.onmouseleave = () => {
            tooltipTimeout = setTimeout(() => {
              hoveredNode = null;
              tooltip.style('opacity', 0);
              tooltipForeignObject.style('pointer-events', 'none');
              if (divElement) {
                divElement.onclick = null;
              }
              tooltipTimeout = null;
            }, 300);
          };
        }
        
        tooltip
          .attr('transform', `translate(${(d.x || 0) + 20},${(d.y || 0) - 10})`)
          .style('opacity', 1);
        
        tooltipForeignObject.style('pointer-events', 'auto');
      })
      .on('mouseout', function() {
        tooltipTimeout = setTimeout(() => {
          hoveredNode = null;
          tooltip.style('opacity', 0);
          tooltipForeignObject.style('pointer-events', 'none');
          const currentDiv = tooltipForeignObject.select('div').node() as HTMLDivElement | null;
          if (currentDiv) {
            currentDiv.onclick = null;
          }
          tooltipTimeout = null;
        }, 300);
      });

    node
      .append('circle')
      .attr('r', (d) => (d.type === 'center' ? 12 : 6))
      .attr('fill', (d) => {
        if (d.level === 2) return '#9ca3af';
        if (d.type === 'center') return '#10b981';
        return d.type === 'cites' ? '#3b82f6' : '#ef4444';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    node
      .append('text')
      .text((d) => d.paper.title.substring(0, 30) + (d.paper.title.length > 30 ? '...' : ''))
      .attr('dx', (d) => (d.type === 'center' ? 15 : 10))
      .attr('dy', 4)
      .attr('font-size', (d) => (d.type === 'center' ? '12px' : '10px'))
      .attr('fill', '#333')
      .style('pointer-events', 'none');

    const tooltip = g
      .append('g')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('pointer-events', 'none');

    const tooltipForeignObject = tooltip
      .append('foreignObject')
      .attr('width', 350)
      .attr('height', 300);

    let tooltipTimeout: NodeJS.Timeout | null = null;

    // シミュレーション
    const simulation = d3
      .forceSimulation<PaperNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<PaperNode, PaperEdge>(edges)
          .id((d: PaperNode) => d.id)
          .distance(100)
      )
      .force('charge', d3.forceManyBody<PaperNode>().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<PaperNode>().radius(30));

    let hoveredNode: PaperNode | null = null;
    
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => {
          const source = typeof d.source === 'object' ? d.source : nodes.find((n) => n.id === d.source);
          return source?.x || 0;
        })
        .attr('y1', (d) => {
          const source = typeof d.source === 'object' ? d.source : nodes.find((n) => n.id === d.source);
          return source?.y || 0;
        })
        .attr('x2', (d) => {
          const target = typeof d.target === 'object' ? d.target : nodes.find((n) => n.id === d.target);
          return target?.x || 0;
        })
        .attr('y2', (d) => {
          const target = typeof d.target === 'object' ? d.target : nodes.find((n) => n.id === d.target);
          return target?.y || 0;
        });

      node.attr('transform', (d) => `translate(${d.x || 0},${d.y || 0})`);
      
      if (hoveredNode) {
        tooltip.attr('transform', `translate(${(hoveredNode.x || 0) + 20},${(hoveredNode.y || 0) - 10})`);
      }
    });

    function dragstarted(event: d3.D3DragEvent<SVGGElement, PaperNode, PaperNode>) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, PaperNode, PaperNode>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, PaperNode, PaperNode>) {
      if (!event.active) simulation.alphaTarget(0);
      if (event.subject.type === 'center') {
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      } else {
        event.subject.fx = null;
        event.subject.fy = null;
      }
    }
  }, [fetchGraphNodes, setQuery, setActiveTab]);

  // drawGraphのrefを更新
  drawGraphRef.current = drawGraph;

  const drawGraphYear = useCallback((searchResult: SearchResult) => {
    if (!svgRef.current || !searchResult.paper) return;

    const { nodes, edges } = fetchGraphNodes(searchResult);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const height = svgRef.current.clientHeight || 800;
    const padding = 50;
    const yearWidth = 150;

    const g = svg.append('g');

    const years = Array.from(new Set(nodes.map(n => n.paper.year).filter(y => y !== undefined && y !== null))) as number[];
    years.sort((a, b) => a - b);

    const yearPositions = new Map<number, number>();
    const yearBounds = new Map<number, { left: number; right: number }>();
    const yearRanges = new Map<number, { center: number; min: number; max: number }>();
    
    years.forEach((year, index) => {
      const centerX = padding + index * yearWidth;
      const leftBound = centerX - yearWidth / 2;
      const rightBound = centerX + yearWidth / 2;
      
      yearPositions.set(year, centerX);
      yearBounds.set(year, { left: leftBound, right: rightBound });
      
      const moveableRange = rightBound - leftBound;
      yearRanges.set(year, {
        center: centerX,
        min: leftBound + moveableRange * 0.1,
        max: rightBound - moveableRange * 0.1,
      });
    });

    nodes.forEach(node => {
      const year = node.paper.year || 0;
      const range = yearRanges.get(year);
      if (range) {
        const moveableRange = range.max - range.min;
        node.x = range.min + Math.random() * moveableRange;
      } else {
        node.x = padding;
      }
      node.y = height / 2 + (Math.random() - 0.5) * 200;
    });

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    const boundaryLines: number[] = [];
    if (years.length > 0) {
      const firstYearBounds = yearBounds.get(years[0]);
      if (firstYearBounds) {
        boundaryLines.push(firstYearBounds.left);
      }
      years.forEach(year => {
        const bounds = yearBounds.get(year);
        if (bounds) {
          boundaryLines.push(bounds.right);
        }
      });
    }
    
    const _yearLines = g
      .append('g')
      .attr('class', 'year-lines')
      .selectAll('line')
      .data(boundaryLines)
      .enter()
      .append('line')
      .attr('x1', (x) => x)
      .attr('x2', (x) => x)
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', '#9ca3af')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '5,5');

    const _yearLabels = g
      .append('g')
      .attr('class', 'year-labels')
      .selectAll('text')
      .data(years)
      .enter()
      .append('text')
      .attr('x', (year) => {
        const range = yearRanges.get(year);
        return range ? range.center : padding;
      })
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('fill', '#6b7280')
      .attr('font-weight', '600')
      .text((year) => year !== null && year !== undefined ? year.toString() : '');

    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll<SVGLineElement, PaperEdge>('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke', (d) => {
        if (d.level === 2) return '#9ca3af';
        return d.type === 'cites' ? '#3b82f6' : '#ef4444';
      })
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6);

    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, PaperNode>('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .call(
        d3
          .drag<SVGGElement, PaperNode>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended)
      )
      .on('mouseover', function(_event, d) {
        if (tooltipTimeout) {
          clearTimeout(tooltipTimeout);
          tooltipTimeout = null;
        }
        
        hoveredNode = d;
        const paper = d.paper;
        
        const previousDiv = tooltipForeignObject.select('div').node() as HTMLDivElement | null;
        if (previousDiv) {
          previousDiv.onclick = null;
        }
        
        const tooltipDiv = tooltipForeignObject
          .html('')
          .append('xhtml:div')
          .attr('class', `paper-card paper-card-${d.type === 'center' ? 'cites' : d.type}`)
          .style('cursor', 'pointer')
          .style('pointer-events', 'auto')
          .html(`
            <div class="paper-card-header">
              <h3 class="paper-card-title">${paper.title}</h3>
              <span class="paper-card-type">${d.type === 'center' ? 'Center' : d.type === 'cites' ? 'Cites' : 'Cited by'}</span>
            </div>
            <div class="paper-card-meta">
              ${paper.year ? `<span class="paper-card-year">${paper.year}</span>` : ''}
              ${paper.venue ? `<span class="paper-card-venue">${paper.venue}</span>` : ''}
              ${paper.authors.length > 0 ? `<span class="paper-card-authors">${paper.authors.slice(0, 10).join(', ')}${paper.authors.length > 10 ? '...' : ''}</span>` : ''}
            </div>
            ${paper.abstract ? `<p class="paper-card-abstract">${paper.abstract.substring(0, 200)}...</p>` : ''}
            <div class="paper-card-footer">
              <div class="paper-card-stats">
                <span>Cited by: ${paper.citationCount}</span>
                <span>ReferenceCount: ${paper.referenceCount}</span>
              </div>
              <div class="paper-card-links">
                ${paper.arxivId ? `<a href="https://arxiv.org/abs/${paper.arxivId}" target="_blank" rel="noopener noreferrer" class="paper-card-link">arXiv</a>` : ''}
                ${paper.doi ? `<a href="https://doi.org/${paper.doi}" target="_blank" rel="noopener noreferrer" class="paper-card-link">DOI</a>` : ''}
                ${paper.url ? `<a href="${paper.url}" target="_blank" rel="noopener noreferrer" class="paper-card-link">S2</a>` : ''}
                ${paper.openAccessPdf ? `<a href="${paper.openAccessPdf}" target="_blank" rel="noopener noreferrer" class="paper-card-link">PDF</a>` : ''}
              </div>
            </div>
          `);
        
        const divElement = tooltipDiv.node() as HTMLDivElement;
        if (divElement) {
          divElement.onclick = (e: MouseEvent) => {
            e.stopPropagation();
            // Commandキー（Mac）またはCtrlキー（Windows/Linux）が押されている場合は新しいタブで開く
            if (e.metaKey || e.ctrlKey) {
              const url = `/?query=${encodeURIComponent(paper.title)}`;
              window.open(url, '_blank');
              return;
            }
            setQuery(paper.title);
            setActiveTab('list');
            searchPapersRef.current?.(paper.title);
          };
          divElement.onmouseenter = () => {
            if (tooltipTimeout) {
              clearTimeout(tooltipTimeout);
              tooltipTimeout = null;
            }
          };
          divElement.onmouseleave = () => {
            tooltipTimeout = setTimeout(() => {
              hoveredNode = null;
              tooltip.style('opacity', 0);
              tooltipForeignObject.style('pointer-events', 'none');
              if (divElement) {
                divElement.onclick = null;
              }
              tooltipTimeout = null;
            }, 300);
          };
        }
        
        tooltip
          .attr('transform', `translate(${(d.x || 0) + 20},${(d.y || 0) - 10})`)
          .style('opacity', 1);
        
        tooltipForeignObject.style('pointer-events', 'auto');
      })
      .on('mouseout', function() {
        tooltipTimeout = setTimeout(() => {
          hoveredNode = null;
          tooltip.style('opacity', 0);
          tooltipForeignObject.style('pointer-events', 'none');
          const currentDiv = tooltipForeignObject.select('div').node() as HTMLDivElement | null;
          if (currentDiv) {
            currentDiv.onclick = null;
          }
          tooltipTimeout = null;
        }, 300);
      });

    node
      .append('circle')
      .attr('r', (d) => (d.type === 'center' ? 12 : 6))
      .attr('fill', (d) => {
        if (d.level === 2) return '#9ca3af';
        if (d.type === 'center') return '#10b981';
        return d.type === 'cites' ? '#3b82f6' : '#ef4444';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    node
      .append('text')
      .text((d) => d.paper.title.substring(0, 30) + (d.paper.title.length > 30 ? '...' : ''))
      .attr('dx', (d) => (d.type === 'center' ? 15 : 10))
      .attr('dy', 4)
      .attr('font-size', (d) => (d.type === 'center' ? '12px' : '10px'))
      .attr('fill', '#333')
      .style('pointer-events', 'none');

    const tooltip = g
      .append('g')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('pointer-events', 'none');

    const tooltipForeignObject = tooltip
      .append('foreignObject')
      .attr('width', 350)
      .attr('height', 300);

    let tooltipTimeout: NodeJS.Timeout | null = null;

    const simulation = d3
      .forceSimulation<PaperNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<PaperNode, PaperEdge>(edges)
          .id((d: PaperNode) => d.id)
          .distance(100)
      )
      .force('charge', d3.forceManyBody<PaperNode>().strength(-300))
      .force('y', d3.forceY(height / 2).strength(0.1))
      .force('collision', d3.forceCollide<PaperNode>().radius(30))
      .force('x', d3.forceX<PaperNode>((d) => {
        const year = d.paper.year || 0;
        const range = yearRanges.get(year);
        return range ? range.center : padding;
      }).strength(0.5));

    let hoveredNode: PaperNode | null = null;
    
    simulation.on('tick', () => {
      nodes.forEach(node => {
        const year = node.paper.year || 0;
        const range = yearRanges.get(year);
        if (range && node.x !== undefined) {
          if (node.x < range.min) {
            node.x = range.min;
            if (node.vx !== undefined) node.vx = 0;
          } else if (node.x > range.max) {
            node.x = range.max;
            if (node.vx !== undefined) node.vx = 0;
          }
        }
      });

      link
        .attr('x1', (d) => {
          const source = typeof d.source === 'object' ? d.source : nodes.find((n) => n.id === d.source);
          return source?.x || 0;
        })
        .attr('y1', (d) => {
          const source = typeof d.source === 'object' ? d.source : nodes.find((n) => n.id === d.source);
          return source?.y || 0;
        })
        .attr('x2', (d) => {
          const target = typeof d.target === 'object' ? d.target : nodes.find((n) => n.id === d.target);
          return target?.x || 0;
        })
        .attr('y2', (d) => {
          const target = typeof d.target === 'object' ? d.target : nodes.find((n) => n.id === d.target);
          return target?.y || 0;
        });

      node.attr('transform', (d) => `translate(${d.x || 0},${d.y || 0})`);
      
      if (hoveredNode) {
        tooltip.attr('transform', `translate(${(hoveredNode.x || 0) + 20},${(hoveredNode.y || 0) - 10})`);
      }
    });

    function dragstarted(event: d3.D3DragEvent<SVGGElement, PaperNode, PaperNode>) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, PaperNode, PaperNode>) {
      const year = event.subject.paper.year || 0;
      const range = yearRanges.get(year);
      
      if (range) {
        const constrainedX = Math.max(range.min, Math.min(range.max, event.x));
        event.subject.fx = constrainedX;
      } else {
        event.subject.fx = event.x;
      }
      event.subject.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, PaperNode, PaperNode>) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
  }, [fetchGraphNodes, setQuery, setActiveTab]);

  // drawGraphYearのrefを更新
  drawGraphYearRef.current = drawGraphYear;

  // URLパラメータからフィルタを読み込む
  useEffect(() => {
    const authorsParam = searchParams.get('authors');
    const tagsParam = searchParams.get('tags');
    const venuesParam = searchParams.get('venues');
    const queryParam = searchParams.get('query');
    const minYearParam = searchParams.get('min_year');
    
    if (queryParam) {
      setQuery(decodeURIComponent(queryParam));
    } else {
      // queryParamがない場合は、フィルタのみで検索するため、クエリをクリア
      if (authorsParam || tagsParam || venuesParam || minYearParam) {
        setQuery('');
      }
    }
    
    if (authorsParam) {
      const authors = authorsParam.split(',').map(a => decodeURIComponent(a.trim())).filter(a => a);
      setSelectedAuthors(authors);
    } else {
      setSelectedAuthors([]);
    }
    
    if (tagsParam) {
      const tags = tagsParam.split(',').map(t => decodeURIComponent(t.trim())).filter(t => t);
      setSelectedTags(tags);
    } else {
      setSelectedTags([]);
    }
    
    if (venuesParam) {
      const venues = venuesParam.split(',').map(v => decodeURIComponent(v.trim())).filter(v => v);
      setSelectedVenues(venues);
    } else {
      setSelectedVenues([]);
    }
    
    if (minYearParam) {
      const year = parseInt(minYearParam, 10);
      if (!isNaN(year)) {
        setMinYear(year);
      }
    } else {
      setMinYear(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!data) return;
    // タグが変更されたら検索を実行
    // タイトルが空でタグが指定された場合 → タグのみでフィルタリング
    // タイトルがあってタグが指定された場合 → タイトル検索 + タグフィルタリング
    // タイトルがあってタグがクリアされた場合 → タイトル検索のみ
    // フィルタが設定されている場合、またはクエリがある場合は検索を実行
    if (selectedTags.length > 0 || selectedAuthors.length > 0 || selectedVenues.length > 0 || minYear !== null || query.trim()) {
      searchPapers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTags, data]);

  useEffect(() => {
    if (!data) return;
    // 著者が変更されたら検索を実行
    // フィルタが設定されている場合、またはクエリがある場合は検索を実行
    if (selectedTags.length > 0 || selectedAuthors.length > 0 || selectedVenues.length > 0 || minYear !== null || query.trim()) {
      searchPapers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAuthors, data]);

  useEffect(() => {
    if (!data) return;
    // venueが変更されたら検索を実行
    // フィルタが設定されている場合、またはクエリがある場合は検索を実行
    if (selectedTags.length > 0 || selectedAuthors.length > 0 || selectedVenues.length > 0 || minYear !== null || query.trim()) {
      searchPapers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVenues, data]);

  useEffect(() => {
    if (!data) return;
    // 年フィルタが変更されたら検索を実行
    // フィルタが設定されている場合、またはクエリがある場合は検索を実行
    if (selectedTags.length > 0 || selectedAuthors.length > 0 || selectedVenues.length > 0 || minYear !== null || query.trim()) {
      searchPapers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minYear, data]);

  // URLパラメータから読み込んだ後、queryが変更された時に検索を実行
  useEffect(() => {
    if (!data) return;
    // フィルタが設定されている場合、またはクエリがある場合は検索を実行
    if (selectedTags.length > 0 || selectedAuthors.length > 0 || selectedVenues.length > 0 || minYear !== null || query.trim()) {
      searchPapers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, data]);

  useEffect(() => {
    if (result && result.paper && (activeTab === 'graph' || activeTab === 'graphYear')) {
      if (activeTab === 'graph') {
        drawGraph(result);
      } else {
        drawGraphYear(result);
      }
    }
  }, [result, activeTab, drawGraph, drawGraphYear]);

  const StatisticsSection: React.FC<{ papers: Paper[] }> = ({ papers }) => {
    const tagStatsRef = useRef<SVGSVGElement>(null);
    const venueStatsRef = useRef<SVGSVGElement>(null);
    const yearStatsRef = useRef<SVGSVGElement>(null);
    const authorStatsRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
      if (!papers || papers.length === 0) return;

      // タグ統計を計算
      const tagCounts = new Map<string, number>();
      papers.forEach(paper => {
        if (paper.tags) {
          paper.tags.forEach(tag => {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          });
        }
      });

      // カンファレンス統計を計算
      const venueCounts = new Map<string, number>();
      papers.forEach(paper => {
        if (paper.venue) {
          venueCounts.set(paper.venue, (venueCounts.get(paper.venue) || 0) + 1);
        }
      });

      // 年統計を計算
      const yearCounts = new Map<string, number>();
      papers.forEach(paper => {
        if (paper.year !== undefined && paper.year !== null) {
          const yearStr = paper.year.toString();
          yearCounts.set(yearStr, (yearCounts.get(yearStr) || 0) + 1);
        }
      });

      // 著者統計を計算
      const authorCounts = new Map<string, number>();
      papers.forEach(paper => {
        if (paper.authors && paper.authors.length > 0) {
          paper.authors.forEach(author => {
            authorCounts.set(author, (authorCounts.get(author) || 0) + 1);
          });
        }
      });

      // タグ円グラフを描画
      if (tagStatsRef.current && tagCounts.size > 0) {
        const svg = d3.select(tagStatsRef.current);
        svg.selectAll('*').remove();

        const sortedTags = Array.from(tagCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, PIE_CHART_CONFIG.topN);

        const { width, pieRadius, pieHeight, legendItemHeight, legendColumns, legendColumnWidth } = PIE_CHART_CONFIG;
        const legendRows = Math.ceil(sortedTags.length / legendColumns);
        const legendHeight = legendRows * legendItemHeight;
        const totalHeight = pieHeight + legendHeight + 40;

        svg
          .attr('width', width)
          .attr('height', totalHeight);

        const g = svg
          .append('g')
          .attr('transform', `translate(${width / 2}, ${pieHeight / 2})`);

        const pie = d3.pie<[string, number]>()
          .value(d => d[1])
          .sort(null);

        const arc = d3.arc<d3.PieArcDatum<[string, number]>>()
          .innerRadius(0)
          .outerRadius(pieRadius);

        const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

        const arcs = g
          .selectAll('.arc')
          .data(pie(sortedTags))
          .enter()
          .append('g')
          .attr('class', 'arc');

        arcs
          .append('path')
          .attr('d', arc)
          .attr('fill', (d, i) => colorScale(i.toString()))
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
          .style('cursor', 'pointer')
          .on('mouseover', function(_event, _d) {
            d3.select(this).attr('opacity', 0.7);
          })
          .on('mouseout', function(_event, _d) {
            d3.select(this).attr('opacity', 1);
          });

        // 凡例を円グラフの下に2列で配置
        const legend = svg
          .append('g')
          .attr('transform', `translate(${width / 2 - (legendColumnWidth * legendColumns) / 2}, ${pieHeight + 20})`);

        sortedTags.forEach((tag, i) => {
          const col = i % legendColumns;
          const row = Math.floor(i / legendColumns);
          const x = col * legendColumnWidth;
          const y = row * legendItemHeight;

          const legendRow = legend
            .append('g')
            .attr('transform', `translate(${x}, ${y})`);

          legendRow
            .append('rect')
            .attr('width', 15)
            .attr('height', 15)
            .attr('fill', colorScale(i.toString()))
            .attr('rx', 2);

          const text = legendRow
            .append('text')
            .attr('x', 20)
            .attr('y', 12)
            .attr('font-size', '12px')
            .attr('fill', '#333')
            .text(`${tag[0]} (${tag[1]})`);

          // テキストが長すぎる場合は省略
          if (tag[0].length > PIE_CHART_CONFIG.maxTextLength) {
            text.text(`${tag[0].substring(0, PIE_CHART_CONFIG.maxTextLength)}... (${tag[1]})`);
          }
        });
      }

      // カンファレンス円グラフを描画
      if (venueStatsRef.current && venueCounts.size > 0) {
        const svg = d3.select(venueStatsRef.current);
        svg.selectAll('*').remove();

        const sortedVenues = Array.from(venueCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, PIE_CHART_CONFIG.topN);

        const { width, pieRadius, pieHeight, legendItemHeight, legendColumns, legendColumnWidth } = PIE_CHART_CONFIG;
        const legendRows = Math.ceil(sortedVenues.length / legendColumns);
        const legendHeight = legendRows * legendItemHeight;
        const totalHeight = pieHeight + legendHeight + 40;

        svg
          .attr('width', width)
          .attr('height', totalHeight);

        const g = svg
          .append('g')
          .attr('transform', `translate(${width / 2}, ${pieHeight / 2})`);

        const pie = d3.pie<[string, number]>()
          .value(d => d[1])
          .sort(null);

        const arc = d3.arc<d3.PieArcDatum<[string, number]>>()
          .innerRadius(0)
          .outerRadius(pieRadius);

        const colorScale = d3.scaleOrdinal(d3.schemeSet2);

        const arcs = g
          .selectAll('.arc')
          .data(pie(sortedVenues))
          .enter()
          .append('g')
          .attr('class', 'arc');

        arcs
          .append('path')
          .attr('d', arc)
          .attr('fill', (d, i) => colorScale(i.toString()))
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
          .style('cursor', 'pointer')
          .on('mouseover', function(_event, _d) {
            d3.select(this).attr('opacity', 0.7);
          })
          .on('mouseout', function(_event, _d) {
            d3.select(this).attr('opacity', 1);
          });

        // 凡例を円グラフの下に2列で配置
        const legend = svg
          .append('g')
          .attr('transform', `translate(${width / 2 - (legendColumnWidth * legendColumns) / 2}, ${pieHeight + 20})`);

        sortedVenues.forEach((venue, i) => {
          const col = i % legendColumns;
          const row = Math.floor(i / legendColumns);
          const x = col * legendColumnWidth;
          const y = row * legendItemHeight;

          const legendRow = legend
            .append('g')
            .attr('transform', `translate(${x}, ${y})`);

          legendRow
            .append('rect')
            .attr('width', 15)
            .attr('height', 15)
            .attr('fill', colorScale(i.toString()))
            .attr('rx', 2);

          const text = legendRow
            .append('text')
            .attr('x', 20)
            .attr('y', 12)
            .attr('font-size', '12px')
            .attr('fill', '#333')
            .text(`${venue[0]} (${venue[1]})`);

          // テキストが長すぎる場合は省略
          if (venue[0].length > PIE_CHART_CONFIG.maxTextLength) {
            text.text(`${venue[0].substring(0, PIE_CHART_CONFIG.maxTextLength)}... (${venue[1]})`);
          }
        });
      }

      // 年円グラフを描画
      if (yearStatsRef.current && yearCounts.size > 0) {
        const svg = d3.select(yearStatsRef.current);
        svg.selectAll('*').remove();

        const sortedYears = Array.from(yearCounts.entries())
          .sort((a, b) => parseInt(a[0]) - parseInt(b[0])) // 年でソート
          .slice(0, PIE_CHART_CONFIG.topN);

        const { width, pieRadius, pieHeight, legendItemHeight, legendColumns, legendColumnWidth } = PIE_CHART_CONFIG;
        const legendRows = Math.ceil(sortedYears.length / legendColumns);
        const legendHeight = legendRows * legendItemHeight;
        const totalHeight = pieHeight + legendHeight + 40;

        svg
          .attr('width', width)
          .attr('height', totalHeight);

        const g = svg
          .append('g')
          .attr('transform', `translate(${width / 2}, ${pieHeight / 2})`);

        const pie = d3.pie<[string, number]>()
          .value(d => d[1])
          .sort(null);

        const arc = d3.arc<d3.PieArcDatum<[string, number]>>()
          .innerRadius(0)
          .outerRadius(pieRadius);

        const colorScale = d3.scaleOrdinal(d3.schemePastel1);

        const arcs = g
          .selectAll('.arc')
          .data(pie(sortedYears))
          .enter()
          .append('g')
          .attr('class', 'arc');

        arcs
          .append('path')
          .attr('d', arc)
          .attr('fill', (d, i) => colorScale(i.toString()))
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
          .style('cursor', 'pointer')
          .on('mouseover', function(_event, _d) {
            d3.select(this).attr('opacity', 0.7);
          })
          .on('mouseout', function(_event, _d) {
            d3.select(this).attr('opacity', 1);
          });

        // 凡例を円グラフの下に2列で配置
        const legend = svg
          .append('g')
          .attr('transform', `translate(${width / 2 - (legendColumnWidth * legendColumns) / 2}, ${pieHeight + 20})`);

        sortedYears.forEach((year, i) => {
          const col = i % legendColumns;
          const row = Math.floor(i / legendColumns);
          const x = col * legendColumnWidth;
          const y = row * legendItemHeight;

          const legendRow = legend
            .append('g')
            .attr('transform', `translate(${x}, ${y})`);

          legendRow
            .append('rect')
            .attr('width', 15)
            .attr('height', 15)
            .attr('fill', colorScale(i.toString()))
            .attr('rx', 2);

          const text = legendRow
            .append('text')
            .attr('x', 20)
            .attr('y', 12)
            .attr('font-size', '12px')
            .attr('fill', '#333')
            .text(`${year[0]}年 (${year[1]})`);

          // テキストが長すぎる場合は省略
          const yearText = `${year[0]}年 (${year[1]})`;
          if (yearText.length > PIE_CHART_CONFIG.maxTextLength) {
            text.text(`${yearText.substring(0, PIE_CHART_CONFIG.maxTextLength)}...`);
          }
        });
      }

      // 著者円グラフを描画
      if (authorStatsRef.current && authorCounts.size > 0) {
        const svg = d3.select(authorStatsRef.current);
        svg.selectAll('*').remove();

        const sortedAuthors = Array.from(authorCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, PIE_CHART_CONFIG.topN);

        const { width, pieRadius, pieHeight, legendItemHeight, legendColumns, legendColumnWidth } = PIE_CHART_CONFIG;
        const legendRows = Math.ceil(sortedAuthors.length / legendColumns);
        const legendHeight = legendRows * legendItemHeight;
        const totalHeight = pieHeight + legendHeight + 40;

        svg
          .attr('width', width)
          .attr('height', totalHeight);

        const g = svg
          .append('g')
          .attr('transform', `translate(${width / 2}, ${pieHeight / 2})`);

        const pie = d3.pie<[string, number]>()
          .value(d => d[1])
          .sort(null);

        const arc = d3.arc<d3.PieArcDatum<[string, number]>>()
          .innerRadius(0)
          .outerRadius(pieRadius);

        const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

        const arcs = g
          .selectAll('.arc')
          .data(pie(sortedAuthors))
          .enter()
          .append('g')
          .attr('class', 'arc');

        arcs
          .append('path')
          .attr('d', arc)
          .attr('fill', (d, i) => colorScale(i.toString()))
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
          .style('cursor', 'pointer')
          .on('mouseover', function(_event, _d) {
            d3.select(this).attr('opacity', 0.7);
          })
          .on('mouseout', function(_event, _d) {
            d3.select(this).attr('opacity', 1);
          });

        // 凡例を円グラフの下に2列で配置
        const legend = svg
          .append('g')
          .attr('transform', `translate(${width / 2 - (legendColumnWidth * legendColumns) / 2}, ${pieHeight + 20})`);

        sortedAuthors.forEach((author, i) => {
          const col = i % legendColumns;
          const row = Math.floor(i / legendColumns);
          const x = col * legendColumnWidth;
          const y = row * legendItemHeight;

          const legendRow = legend
            .append('g')
            .attr('transform', `translate(${x}, ${y})`);

          legendRow
            .append('rect')
            .attr('width', 15)
            .attr('height', 15)
            .attr('fill', colorScale(i.toString()))
            .attr('rx', 2);

          const text = legendRow
            .append('text')
            .attr('x', 20)
            .attr('y', 12)
            .attr('font-size', '12px')
            .attr('fill', '#333')
            .text(`${author[0]} (${author[1]})`);

          // テキストが長すぎる場合は省略
          if (author[0].length > PIE_CHART_CONFIG.maxTextLength) {
            text.text(`${author[0].substring(0, PIE_CHART_CONFIG.maxTextLength)}... (${author[1]})`);
          }
        });
      }
    }, [papers]);

    if (!papers || papers.length === 0) return null;

    const allPapers = papers;
    const hasTags = allPapers.some(p => p.tags && p.tags.length > 0);
    const hasVenues = allPapers.some(p => p.venue);
    const hasYears = allPapers.some(p => p.year !== undefined && p.year !== null);
    const hasAuthors = allPapers.some(p => p.authors && p.authors.length > 0);

    if (!hasTags && !hasVenues && !hasYears && !hasAuthors) return null;

    return (
      <div className="paper-explorer-statistics">
        <h2 className="paper-explorer-statistics-title">統計情報</h2>
        <div className="paper-explorer-statistics-content">
          {hasTags && (
            <div className="paper-explorer-statistics-chart">
              <h3 className="paper-explorer-statistics-chart-title">タグ分布</h3>
              <svg ref={tagStatsRef} />
            </div>
          )}
          {hasVenues && (
            <div className="paper-explorer-statistics-chart">
              <h3 className="paper-explorer-statistics-chart-title">カンファレンス分布</h3>
              <svg ref={venueStatsRef} />
            </div>
          )}
          {hasYears && (
            <div className="paper-explorer-statistics-chart">
              <h3 className="paper-explorer-statistics-chart-title">年分布</h3>
              <svg ref={yearStatsRef} />
            </div>
          )}
          {hasAuthors && (
            <div className="paper-explorer-statistics-chart">
              <h3 className="paper-explorer-statistics-chart-title">著者分布</h3>
              <svg ref={authorStatsRef} />
            </div>
          )}
        </div>
      </div>
    );
  };

  const JsonExportSection: React.FC<{
    papers: Paper[];
    isOpen: boolean;
    onToggle: () => void;
    fields: Record<string, boolean>;
    onFieldsChange: (fields: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
  }> = ({ papers, isOpen, onToggle, fields, onFieldsChange }) => {
    const [jsonOutput, setJsonOutput] = useState<string>('');

    const generateJson = useCallback(() => {
      // 年順にソート（新しい順、年がない場合は最後に）
      const sortedPapers = [...papers].sort((a, b) => {
        if (a.year === undefined || a.year === null) {
          if (b.year === undefined || b.year === null) {
            return 0;
          }
          return -1; // aが年なし、bが年あり → aを後ろに
        }
        if (b.year === undefined || b.year === null) {
          return 1; // aが年あり、bが年なし → aを前に
        }
        return a.year - b.year; // 新しい順（降順）
      });

      const papersList = sortedPapers.map(paper => {
        const paperObj: Record<string, any> = {};
        
        if (fields.title && paper.title) {
          paperObj.title = paper.title;
        }
        if (fields.abstract && paper.abstract) {
          paperObj.abstract = paper.abstract;
        }
        if (fields.tldr && paper.tldr) {
          paperObj.tldr = paper.tldr;
        }
        if (fields.tldr_ja && paper.tldr_ja) {
          paperObj.tldr_ja = paper.tldr_ja;
        }
        if (fields.authors && paper.authors && paper.authors.length > 0) {
          paperObj.authors = paper.authors;
        }
        if (fields.year && paper.year !== undefined && paper.year !== null) {
          paperObj.year = paper.year;
        }
        if (fields.conference && paper.venue) {
          paperObj.conference = paper.venue;
        }
        if (fields.tags && paper.tags && paper.tags.length > 0) {
          paperObj.tags = paper.tags;
        }
        if (fields.cited_by) {
          paperObj.cited_by = paper.citationCount;
        }
        if (fields.referenceCount) {
          paperObj.referenceCount = paper.referenceCount;
        }
        if (fields.links_to_paper) {
          const links: string[] = [];
          if (paper.openAccessPdf) {
            links.push(paper.openAccessPdf);
          }
          if (paper.url) {
            links.push(paper.url);
          }
          if (paper.arxivId) {
            links.push(`https://arxiv.org/abs/${paper.arxivId}`);
          }
          if (paper.doi) {
            links.push(`https://doi.org/${paper.doi}`);
          }
          if (links.length > 0) {
            paperObj.links_to_paper = links;
          }
        }
        
        return paperObj;
      });

      const jsonString = JSON.stringify(papersList, null, 4);
      setJsonOutput(jsonString);
    }, [papers, fields]);

    // papersまたはfieldsが変更されたら自動的にJSONを生成
    useEffect(() => {
      if (papers.length > 0) {
        generateJson();
      }
    }, [papers, fields, generateJson]);

    const handleFieldChange = (field: string, checked: boolean) => {
      onFieldsChange({ ...fields, [field]: checked });
    };

    const handleDownload = () => {
      if (!jsonOutput) {
        generateJson();
        return;
      }
      
      const blob = new Blob([jsonOutput], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'papers.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    const handleCopy = () => {
      if (!jsonOutput) {
        generateJson();
        return;
      }
      
      navigator.clipboard.writeText(jsonOutput).then(() => {
        alert('JSONをクリップボードにコピーしました');
      }).catch(() => {
        alert('コピーに失敗しました');
      });
    };

    return (
      <div className="paper-explorer-json-export">
        <div 
          className="paper-explorer-json-export-header"
          onClick={onToggle}
        >
          <span className="paper-explorer-json-export-icon">
            {isOpen ? '▼' : '▶'}
          </span>
          <h3 className="paper-explorer-json-export-title">JSON出力</h3>
        </div>
        {isOpen && (
          <div className="paper-explorer-json-export-content">
            <div className="paper-explorer-json-export-fields">
              <h4>出力するフィールドを選択:</h4>
              <div className="paper-explorer-json-export-checkboxes">
                {Object.keys(fields).map(field => (
                  <label key={field} className="paper-explorer-json-export-checkbox-label">
                    <input
                      type="checkbox"
                      checked={fields[field]}
                      onChange={(e) => handleFieldChange(field, e.target.checked)}
                    />
                    <span>{field}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="paper-explorer-json-export-buttons">
              <button
                className="paper-explorer-json-export-button"
                onClick={handleCopy}
                disabled={!jsonOutput}
              >
                クリップボードにコピー
              </button>
              <button
                className="paper-explorer-json-export-button"
                onClick={handleDownload}
                disabled={!jsonOutput}
              >
                ダウンロード
              </button>
            </div>
            {jsonOutput && (
              <div className="paper-explorer-json-export-output">
                <textarea
                  readOnly
                  value={jsonOutput}
                  className="paper-explorer-json-export-textarea"
                  rows={20}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const PaperCard: React.FC<{ paper: Paper; type: 'cites' | 'cited_by' }> = ({ paper, type }) => {
    const handleCardClick = (e: React.MouseEvent) => {
      // フッターのリンクがクリックされた場合は検索を実行しない
      const target = e.target as HTMLElement;
      if (target.closest('.paper-card-links')) {
        return;
      }
      
      // Commandキー（Mac）またはCtrlキー（Windows/Linux）が押されている場合は新しいタブで開く
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        const url = `/?query=${encodeURIComponent(paper.title)}`;
        window.open(url, '_blank');
        return;
      }
      
      e.stopPropagation();
      setQuery(paper.title);
      setActiveTab('list');
      searchPapers(paper.title);
    };

    return (
      <div 
        className={`paper-card paper-card-${type}`}
        onClick={handleCardClick}
        style={{ cursor: 'pointer' }}
      >
        <div className="paper-card-header">
          <h3 className="paper-card-title">
            {paper.title}
          </h3>
          <span className="paper-card-type">{type === 'cites' ? 'Cites' : 'Cited by'}</span>
        </div>
        <div className="paper-card-meta">
          {paper.year && <span className="paper-card-year">{paper.year}</span>}
          {paper.venue && <span className="paper-card-venue">{paper.venue}</span>}
          {paper.authors.length > 0 && (
            <span className="paper-card-authors">{paper.authors.slice(0, 10).join(', ')}{paper.authors.length > 10 ? '...' : ''}</span>
          )}
        </div>
        {paper.tags && paper.tags.length > 0 && (
          <div className="paper-card-tags">
            <div className="paper-card-tags-list">
              {paper.tags.map((tag, index) => (
                <span key={index} className="paper-card-tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
        {paper.abstract && (
          <p className="paper-card-abstract">{paper.abstract.substring(0, 200)}...</p>
        )}
        {paper.tldr && (
          <div className="paper-card-tldr">
            <strong>TLDR:</strong> {paper.tldr}
          </div>
        )}
        {paper.tldr_ja && (
          <div className="paper-card-tldr">
            <strong>TLDR (日本語):</strong> {paper.tldr_ja}
          </div>
        )}
        <div className="paper-card-footer">
          <div className="paper-card-stats">
            <span>Cited by: {paper.citationCount}</span>
            <span>ReferenceCount: {paper.referenceCount}</span>
          </div>
          <div className="paper-card-links" onClick={(e) => e.stopPropagation()}>
            {paper.arxivId && (
              <a
                href={`https://arxiv.org/abs/${paper.arxivId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="paper-card-link"
              >
                arXiv
              </a>
            )}
            {paper.doi && (
              <a
                href={`https://doi.org/${paper.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="paper-card-link"
              >
                DOI
              </a>
            )}
            {paper.url && (
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="paper-card-link"
              >
                S2
              </a>
            )}
            {paper.openAccessPdf && (
              <a
                href={paper.openAccessPdf}
                target="_blank"
                rel="noopener noreferrer"
                className="paper-card-link"
              >
                PDF
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="paper-explorer">
      <div className="paper-explorer-header">
        <h1>📚 Learned Index Papers</h1>
      </div>

      <div className="paper-explorer-search">
        <div className="paper-explorer-search-row">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="論文タイトルで検索..."
            className="paper-explorer-input"
          />
          <button onClick={() => searchPapers()} disabled={loading} className="paper-explorer-button">
            {loading ? '検索中...' : '検索'}
          </button>
        </div>
        {(selectedTags.length > 0 || selectedAuthors.length > 0 || selectedVenues.length > 0 || minYear !== null) && (
          <div className="paper-explorer-active-filters">
            <span className="paper-explorer-active-filters-label">フィルタ:</span>
            {selectedTags.map((tag) => (
              <span key={`tag-${tag}`} className="paper-explorer-active-filter-item paper-explorer-active-filter-tag">
                <span className="paper-explorer-active-filter-label">タグ</span>
                {tag}
                <button
                  className="paper-explorer-active-filter-remove"
                  onClick={() => {
                    const newTags = selectedTags.filter(t => t !== tag);
                    setSelectedTags(newTags);
                    // URLパラメータを更新
                    const newParams = new URLSearchParams(searchParams);
                    if (newTags.length > 0) {
                      newParams.set('tags', newTags.join(','));
                    } else {
                      newParams.delete('tags');
                    }
                    setSearchParams(newParams);
                    // 状態更新後に検索を実行
                    if (data) {
                      setTimeout(() => {
                        searchPapers();
                      }, 0);
                    }
                  }}
                  disabled={loading}
                >
                  ×
                </button>
              </span>
            ))}
            {selectedAuthors.map((author) => (
              <span key={`author-${author}`} className="paper-explorer-active-filter-item paper-explorer-active-filter-author">
                <span className="paper-explorer-active-filter-label">著者</span>
                {author}
                <button
                  className="paper-explorer-active-filter-remove"
                  onClick={() => {
                    const newAuthors = selectedAuthors.filter(a => a !== author);
                    setSelectedAuthors(newAuthors);
                    // URLパラメータを更新
                    const newParams = new URLSearchParams(searchParams);
                    if (newAuthors.length > 0) {
                      newParams.set('authors', newAuthors.join(','));
                    } else {
                      newParams.delete('authors');
                    }
                    setSearchParams(newParams);
                    // 状態更新後に検索を実行
                    if (data) {
                      setTimeout(() => {
                        searchPapers();
                      }, 0);
                    }
                  }}
                  disabled={loading}
                >
                  ×
                </button>
              </span>
            ))}
            {selectedVenues.map((venue) => (
              <span key={`venue-${venue}`} className="paper-explorer-active-filter-item paper-explorer-active-filter-venue">
                <span className="paper-explorer-active-filter-label">学会/ジャーナル</span>
                {venue}
                <button
                  className="paper-explorer-active-filter-remove"
                  onClick={() => {
                    const newVenues = selectedVenues.filter(v => v !== venue);
                    setSelectedVenues(newVenues);
                    // URLパラメータを更新
                    const newParams = new URLSearchParams(searchParams);
                    if (newVenues.length > 0) {
                      newParams.set('venues', newVenues.join(','));
                    } else {
                      newParams.delete('venues');
                    }
                    setSearchParams(newParams);
                    // 状態更新後に検索を実行
                    if (data) {
                      setTimeout(() => {
                        searchPapers();
                      }, 0);
                    }
                  }}
                  disabled={loading}
                >
                  ×
                </button>
              </span>
            ))}
            {minYear !== null && (
              <span className="paper-explorer-active-filter-item paper-explorer-active-filter-year">
                <span className="paper-explorer-active-filter-label">年</span>
                {minYear}年以降
                <button
                  className="paper-explorer-active-filter-remove"
                  onClick={() => {
                    setMinYear(null);
                    // URLパラメータを更新
                    const newParams = new URLSearchParams(searchParams);
                    newParams.delete('min_year');
                    setSearchParams(newParams);
                    // 状態更新後に検索を実行
                    if (data) {
                      setTimeout(() => {
                        searchPapers();
                      }, 0);
                    }
                  }}
                  disabled={loading}
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}
        <div className="paper-explorer-filters">
          <div className="paper-explorer-tag-filter">
            <div className="paper-explorer-tag-checkboxes">
              <div 
                className="paper-explorer-tag-filter-header"
                onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
              >
                <span className="paper-explorer-tag-dropdown-icon">
                  {tagDropdownOpen ? '▼' : '▶'}
                </span>
                <label className="paper-explorer-tag-filter-label">タグでフィルタリング:</label>
              </div>
              {tagDropdownOpen && (
                <div className="paper-explorer-tag-checkboxes-list">
                  {availableTags.map((tagItem) => (
                    <label key={tagItem.tag} className="paper-explorer-tag-checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tagItem.tag)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTags([...selectedTags, tagItem.tag]);
                          } else {
                            setSelectedTags(selectedTags.filter(t => t !== tagItem.tag));
                          }
                        }}
                        disabled={loading}
                      />
                      <span>{tagItem.tag} ({tagItem.count}件)</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="paper-explorer-tag-filter">
            <div className="paper-explorer-tag-checkboxes">
              <div 
                className="paper-explorer-tag-filter-header"
                onClick={() => setAuthorDropdownOpen(!authorDropdownOpen)}
              >
                <span className="paper-explorer-tag-dropdown-icon">
                  {authorDropdownOpen ? '▼' : '▶'}
                </span>
                <label className="paper-explorer-tag-filter-label">著者でフィルタリング:</label>
              </div>
              {authorDropdownOpen && (
                <div className="paper-explorer-tag-checkboxes-list">
                  {availableAuthors.map((authorItem) => (
                    <label key={authorItem.author} className="paper-explorer-tag-checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedAuthors.includes(authorItem.author)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAuthors([...selectedAuthors, authorItem.author]);
                          } else {
                            setSelectedAuthors(selectedAuthors.filter(a => a !== authorItem.author));
                          }
                        }}
                        disabled={loading}
                      />
                      <span>{authorItem.author} ({authorItem.count}件)</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="paper-explorer-tag-filter">
            <div className="paper-explorer-tag-checkboxes">
              <div 
                className="paper-explorer-tag-filter-header"
                onClick={() => setVenueDropdownOpen(!venueDropdownOpen)}
              >
                <span className="paper-explorer-tag-dropdown-icon">
                  {venueDropdownOpen ? '▼' : '▶'}
                </span>
                <label className="paper-explorer-tag-filter-label">学会/ジャーナルでフィルタリング:</label>
              </div>
              {venueDropdownOpen && (
                <div className="paper-explorer-tag-checkboxes-list">
                  {availableVenues.map((venueItem) => (
                    <label key={venueItem.venue} className="paper-explorer-tag-checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedVenues.includes(venueItem.venue)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedVenues([...selectedVenues, venueItem.venue]);
                          } else {
                            setSelectedVenues(selectedVenues.filter(v => v !== venueItem.venue));
                          }
                        }}
                        disabled={loading}
                      />
                      <span>{venueItem.venue} ({venueItem.count}件)</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="paper-explorer-tag-filter">
            <div className="paper-explorer-tag-checkboxes">
              <div 
                className="paper-explorer-tag-filter-header"
                onClick={() => setYearFilterOpen(!yearFilterOpen)}
              >
                <span className="paper-explorer-tag-dropdown-icon">
                  {yearFilterOpen ? '▼' : '▶'}
                </span>
                <label className="paper-explorer-tag-filter-label">年でフィルタリング:</label>
              </div>
              {yearFilterOpen && (
                <div className="paper-explorer-year-filter-content">
                  <div className="paper-explorer-year-filter-input-group">
                    <input
                      type="number"
                      placeholder="年"
                      min="1900"
                      max={new Date().getFullYear()}
                      value={minYear || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setMinYear(value === '' ? null : parseInt(value, 10));
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          searchPapers();
                        }
                      }}
                      className="paper-explorer-year-input"
                    />
                    <span className="paper-explorer-year-label">以降の論文のみ表示</span>
                    <button
                      className="paper-explorer-year-apply"
                      onClick={() => searchPapers()}
                      disabled={loading}
                    >
                      適用
                    </button>
                    {minYear !== null && (
                      <button
                        className="paper-explorer-year-clear"
                        onClick={() => {
                          setMinYear(null);
                          searchPapers();
                        }}
                        disabled={loading}
                      >
                        クリア
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="paper-explorer-loading">
          <p>検索中...</p>
        </div>
      )}

      {!loading && result && result.paper && (
        <>
          <div className="paper-explorer-result-header">
            <div className="paper-explorer-result-main">
              <h2>{result.paper.title}</h2>
              <div className="paper-explorer-result-meta">
                {result.paper.year && <span>{result.paper.year}</span>}
                {result.paper.venue && <span>{result.paper.venue}</span>}
                {result.paper.authors.length > 0 && (
                  <span>{result.paper.authors.join(', ')}</span>
                )}
              </div>
              {result.paper.tags && result.paper.tags.length > 0 && (
                <div className="paper-explorer-result-tags">
                  <div className="paper-explorer-result-tags-list">
                    {result.paper.tags.map((tag, index) => (
                      <span key={index} className="paper-explorer-result-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {result.paper.abstract && (
                <p className="paper-explorer-result-abstract">{result.paper.abstract}</p>
              )}
              {result.paper.tldr && (
                <div className="paper-explorer-result-tldr">
                  <h4 className="paper-explorer-result-tldr-title">TLDR</h4>
                  <p className="paper-explorer-result-tldr-content">{result.paper.tldr}</p>
                </div>
              )}
              {result.paper.tldr_ja && (
                <div className="paper-explorer-result-tldr">
                  <h4 className="paper-explorer-result-tldr-title">TLDR (日本語)</h4>
                  <p className="paper-explorer-result-tldr-content">{result.paper.tldr_ja}</p>
                </div>
              )}
              <div className="paper-explorer-result-links">
                {result.paper.arxivId && (
                  <a
                    href={`https://arxiv.org/abs/${result.paper.arxivId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="paper-explorer-result-link"
                  >
                    arXiv
                  </a>
                )}
                {result.paper.doi && (
                  <a
                    href={`https://doi.org/${result.paper.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="paper-explorer-result-link"
                  >
                    DOI
                  </a>
                )}
                {result.paper.url && (
                  <a
                    href={result.paper.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="paper-explorer-result-link"
                  >
                    Semantic Scholar
                  </a>
                )}
                {result.paper.openAccessPdf && (
                  <a
                    href={result.paper.openAccessPdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="paper-explorer-result-link"
                  >
                    PDF
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="paper-explorer-tabs">
            <button
              className={`paper-explorer-tab ${activeTab === 'list' ? 'active' : ''}`}
              onClick={() => setActiveTab('list')}
            >
              List ({result.cites.length} Cites, {result.cited_by.length} Cited by)
            </button>
            <button
              className={`paper-explorer-tab ${activeTab === 'graph' ? 'active' : ''}`}
              onClick={() => setActiveTab('graph')}
            >
              Graph
            </button>
            <button
              className={`paper-explorer-tab ${activeTab === 'graphYear' ? 'active' : ''}`}
              onClick={() => setActiveTab('graphYear')}
            >
              Graph (year)
            </button>
          </div>

          {activeTab === 'list' && (
            <div className="paper-explorer-list">
              <div className="paper-explorer-list-section">
                <h3 className="paper-explorer-list-title">Cites ({result.cites.length})</h3>
                <div className="paper-explorer-list-grid">
                  {result.cites.map((paper) => (
                    <PaperCard key={paper.paperId} paper={paper} type="cites" />
                  ))}
                </div>
              </div>
              <div className="paper-explorer-list-section">
                <h3 className="paper-explorer-list-title">Cited by ({result.cited_by.length})</h3>
                <div className="paper-explorer-list-grid">
                  {result.cited_by.map((paper) => (
                    <PaperCard key={paper.paperId} paper={paper} type="cited_by" />
                  ))}
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'graph' || activeTab === 'graphYear') && (
            <div className="paper-explorer-graph">
              <svg ref={svgRef} width="100%" height="800px" />
            </div>
          )}

          {result && result.paper && (
            <>
              <StatisticsSection papers={[...result.cites, ...result.cited_by, result.paper]} />
              <JsonExportSection 
                papers={[...result.cites, ...result.cited_by, result.paper]}
                isOpen={jsonExportOpen}
                onToggle={() => setJsonExportOpen(!jsonExportOpen)}
                fields={jsonExportFields}
                onFieldsChange={(newFields) => {
                  if (typeof newFields === 'function') {
                    setJsonExportFields((prev) => newFields(prev));
                  } else {
                    setJsonExportFields(newFields);
                  }
                }}
              />
            </>
          )}
        </>
      )}

      {!loading && result && !result.paper && !tagResult && !authorResult && !venueResult && (
        <div className="paper-explorer-no-result">
          <p>該当する論文が見つかりませんでした。</p>
        </div>
      )}

      {!loading && tagResult && !query.trim() && !authorResult && !venueResult && (
        <>
          <div className="paper-explorer-tag-result-header">
            <h2>タグ: {tagResult.tags.join(', ')} ({tagResult.count}件)</h2>
          </div>
          <div className="paper-explorer-list">
            <div className="paper-explorer-list-section">
              <div className="paper-explorer-list-grid">
                {tagResult.papers.map((paper) => (
                  <PaperCard key={paper.paperId} paper={paper} type="cites" />
                ))}
              </div>
            </div>
          </div>
          <StatisticsSection papers={tagResult.papers} />
          <JsonExportSection 
            papers={tagResult.papers}
            isOpen={jsonExportOpen}
            onToggle={() => setJsonExportOpen(!jsonExportOpen)}
            fields={jsonExportFields}
            onFieldsChange={(newFields) => {
              if (typeof newFields === 'function') {
                setJsonExportFields((prev) => newFields(prev));
              } else {
                setJsonExportFields(newFields);
              }
            }}
          />
        </>
      )}

      {!loading && authorResult && !query.trim() && !tagResult && !venueResult && (
        <>
          <div className="paper-explorer-tag-result-header">
            <h2>著者: {authorResult.authors.join(', ')} ({authorResult.count}件)</h2>
          </div>
          <div className="paper-explorer-list">
            <div className="paper-explorer-list-section">
              <div className="paper-explorer-list-grid">
                {authorResult.papers.map((paper) => (
                  <PaperCard key={paper.paperId} paper={paper} type="cites" />
                ))}
              </div>
            </div>
          </div>
          <StatisticsSection papers={authorResult.papers} />
          <JsonExportSection 
            papers={authorResult.papers}
            isOpen={jsonExportOpen}
            onToggle={() => setJsonExportOpen(!jsonExportOpen)}
            fields={jsonExportFields}
            onFieldsChange={(newFields) => {
              if (typeof newFields === 'function') {
                setJsonExportFields((prev) => newFields(prev));
              } else {
                setJsonExportFields(newFields);
              }
            }}
          />
        </>
      )}

      {!loading && venueResult && !query.trim() && (
        <>
          <div className="paper-explorer-tag-result-header">
            <h2>学会/ジャーナル: {venueResult.venues.join(', ')} ({venueResult.count}件)</h2>
          </div>
          <div className="paper-explorer-list">
            <div className="paper-explorer-list-section">
              <div className="paper-explorer-list-grid">
                {venueResult.papers.map((paper) => (
                  <PaperCard key={paper.paperId} paper={paper} type="cites" />
                ))}
              </div>
            </div>
          </div>
          <StatisticsSection papers={venueResult.papers} />
          <JsonExportSection 
            papers={venueResult.papers}
            isOpen={jsonExportOpen}
            onToggle={() => setJsonExportOpen(!jsonExportOpen)}
            fields={jsonExportFields}
            onFieldsChange={(newFields) => {
              if (typeof newFields === 'function') {
                setJsonExportFields((prev) => newFields(prev));
              } else {
                setJsonExportFields(newFields);
              }
            }}
          />
        </>
      )}
    </div>
  );
};

export default PaperExplorer;

