import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Paper, SearchResult, PaperNode, PaperEdge, PapersByTagResult, PapersByAuthorResult, PapersByVenueResult } from '../types';
import './PaperExplorer.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

interface PaperExplorerProps {}

const PaperExplorer: React.FC<PaperExplorerProps> = () => {
  const [query, setQuery] = useState('Partitioned Learned Bloom Filter');
  const [loading, setLoading] = useState(false);
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
  const svgRef = useRef<SVGSVGElement>(null);

  const fetchTags = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        setAvailableTags(data.tags || []);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const fetchAuthors = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/authors`);
      if (response.ok) {
        const data = await response.json();
        setAvailableAuthors(data.authors || []);
      }
    } catch (error) {
      console.error('Error fetching authors:', error);
    }
  };

  const fetchVenues = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/venues`);
      if (response.ok) {
        const data = await response.json();
        setAvailableVenues(data.venues || []);
      }
    } catch (error) {
      console.error('Error fetching venues:', error);
    }
  };

  const searchPapers = async (searchQuery?: string) => {
    const queryToUse = searchQuery || query;
    
    // タイトルが空で、タグ、著者、またはvenueが指定されたら → フィルタのみでフィルタリング
    if (!queryToUse.trim() && (selectedTags.length > 0 || selectedAuthors.length > 0 || selectedVenues.length > 0)) {
      setLoading(true);
      setResult(null);
      setAuthorResult(null);
      setVenueResult(null);
      try {
        // タグのみの場合はタグ検索
        if (selectedTags.length > 0 && selectedAuthors.length === 0 && selectedVenues.length === 0) {
          const tagsParam = selectedTags.join(',');
          const url = `${API_BASE}/api/papers/by-tag?tags=${encodeURIComponent(tagsParam)}`;
          console.log('Searching by tags with URL:', url);
          
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data: PapersByTagResult = await response.json();
          console.log('Tag search result:', data);
          
          setTagResult(data);
          setResult(null);
        } 
        // 著者のみの場合は著者検索
        else if (selectedAuthors.length > 0 && selectedTags.length === 0 && selectedVenues.length === 0) {
          const authorsParam = selectedAuthors.join(',');
          const url = `${API_BASE}/api/papers/by-author?authors=${encodeURIComponent(authorsParam)}`;
          console.log('Searching by authors with URL:', url);
          
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data: PapersByAuthorResult = await response.json();
          console.log('Author search result:', data);
          
          setAuthorResult(data);
          setTagResult(null);
          setResult(null);
        }
        // venueのみの場合はvenue検索
        else if (selectedVenues.length > 0 && selectedTags.length === 0 && selectedAuthors.length === 0) {
          const venuesParam = selectedVenues.join(',');
          const url = `${API_BASE}/api/papers/by-venue?venues=${encodeURIComponent(venuesParam)}`;
          console.log('Searching by venues with URL:', url);
          
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data: PapersByVenueResult = await response.json();
          console.log('Venue search result:', data);
          
          setVenueResult(data);
          setTagResult(null);
          setAuthorResult(null);
          setResult(null);
        }
        // 複数のフィルタが指定された場合は、最初のフィルタで検索してから他のフィルタを適用
        else {
          let papers: Paper[] = [];
          let resultType: 'tag' | 'author' | 'venue' = 'tag';
          
          // 最初のフィルタで検索
          if (selectedTags.length > 0) {
            const tagsParam = selectedTags.join(',');
            const url = `${API_BASE}/api/papers/by-tag?tags=${encodeURIComponent(tagsParam)}`;
            const response = await fetch(url);
            if (response.ok) {
              const data: PapersByTagResult = await response.json();
              papers = data.papers;
              resultType = 'tag';
            }
          } else if (selectedAuthors.length > 0) {
            const authorsParam = selectedAuthors.join(',');
            const url = `${API_BASE}/api/papers/by-author?authors=${encodeURIComponent(authorsParam)}`;
            const response = await fetch(url);
            if (response.ok) {
              const data: PapersByAuthorResult = await response.json();
              papers = data.papers;
              resultType = 'author';
            }
          } else if (selectedVenues.length > 0) {
            const venuesParam = selectedVenues.join(',');
            const url = `${API_BASE}/api/papers/by-venue?venues=${encodeURIComponent(venuesParam)}`;
            const response = await fetch(url);
            if (response.ok) {
              const data: PapersByVenueResult = await response.json();
              papers = data.papers;
              resultType = 'venue';
            }
          }
          
          // 他のフィルタを適用
          if (selectedTags.length > 0 && resultType !== 'tag') {
            papers = papers.filter(p => 
              p.tags && selectedTags.every(tag => p.tags!.includes(tag))
            );
          }
          if (selectedAuthors.length > 0 && resultType !== 'author') {
            papers = papers.filter(p => 
              p.authors && selectedAuthors.every(author => p.authors!.includes(author))
            );
          }
          if (selectedVenues.length > 0 && resultType !== 'venue') {
            papers = papers.filter(p => 
              p.venue && selectedVenues.includes(p.venue)
            );
          }
          
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
          setResult(null);
        }
      } catch (error) {
        console.error('Filter search error:', error);
        const errorMessage = error instanceof Error ? error.message : '不明なエラー';
        alert(`検索に失敗しました: ${errorMessage}\n\nバックエンドサーバー（${API_BASE}）が起動しているか確認してください。`);
      } finally {
        setLoading(false);
      }
      return;
    }

    // タイトルが空じゃなくて、フィルタが指定されたら → タイトル検索 + フィルタリング
    // タイトルが空じゃなくて、フィルタが指定されていない → 通常のタイトル検索
    if (!queryToUse.trim()) return;

    setLoading(true);
    setResult(null);
    setTagResult(null);
    setAuthorResult(null);
    setVenueResult(null);
    try {
      let url = `${API_BASE}/api/search?query=${encodeURIComponent(queryToUse)}`;
      if (selectedTags.length > 0) {
        const tagsParam = selectedTags.join(',');
        url += `&tags=${encodeURIComponent(tagsParam)}`;
      }
      if (selectedAuthors.length > 0) {
        const authorsParam = selectedAuthors.join(',');
        url += `&authors=${encodeURIComponent(authorsParam)}`;
      }
      if (selectedVenues.length > 0) {
        const venuesParam = selectedVenues.join(',');
        url += `&venues=${encodeURIComponent(venuesParam)}`;
      }
      console.log('Searching with URL:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: SearchResult = await response.json();
      console.log('Search result:', data);
      
      setResult(data);
      if (data.paper && activeTab === 'graph') {
        setTimeout(() => drawGraph(data), 100);
      } else if (data.paper && activeTab === 'graphYear') {
        setTimeout(() => drawGraphYear(data), 100);
      }
    } catch (error) {
      console.error('Search error:', error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      alert(`検索に失敗しました: ${errorMessage}\n\nバックエンドサーバー（${API_BASE}）が起動しているか確認してください。`);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchPapers();
    }
  };

  useEffect(() => {
    // タグ一覧、著者一覧、venue一覧を取得
    fetchTags();
    fetchAuthors();
    fetchVenues();
    // デフォルトクエリで検索
    searchPapers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // タグが変更されたら検索を実行
    // タイトルが空でタグが指定された場合 → タグのみでフィルタリング
    // タイトルがあってタグが指定された場合 → タイトル検索 + タグフィルタリング
    // タイトルがあってタグがクリアされた場合 → タイトル検索のみ
    if (selectedTags.length > 0 || (!selectedTags.length && query.trim())) {
      searchPapers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTags]);

  useEffect(() => {
    // 著者が変更されたら検索を実行
    if (selectedAuthors.length > 0 || (!selectedAuthors.length && query.trim())) {
      searchPapers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAuthors]);

  useEffect(() => {
    // venueが変更されたら検索を実行
    if (selectedVenues.length > 0 || (!selectedVenues.length && query.trim())) {
      searchPapers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVenues]);

  useEffect(() => {
    if (result && result.paper && (activeTab === 'graph' || activeTab === 'graphYear')) {
      if (activeTab === 'graph') {
        drawGraph(result);
      } else {
        drawGraphYear(result);
      }
    }
  }, [result, activeTab]);

  const fetchGraphNodes = async (data: SearchResult) => {
    const nodes: PaperNode[] = [];
    const edges: PaperEdge[] = [];
    const nodeMap = new Map<string, PaperNode>();
    const centerPaper = data.paper!;

    const centerNode: PaperNode = {
      id: centerPaper.paperId,
      paper: centerPaper,
      type: 'center',
      level: 0,
    };
    nodes.push(centerNode);
    nodeMap.set(centerPaper.paperId, centerNode);

    data.cites.forEach((paper) => {
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

    const citesLevel2Promises = data.cites.map(async (citedPaper) => {
      try {
        let url = `${API_BASE}/api/paper/${citedPaper.paperId}?limit=20`;
        if (selectedTags.length > 0) {
          const tagsParam = selectedTags.join(',');
          url += `&tags=${encodeURIComponent(tagsParam)}`;
        }
        if (selectedAuthors.length > 0) {
          const authorsParam = selectedAuthors.join(',');
          url += `&authors=${encodeURIComponent(authorsParam)}`;
        }
        if (selectedVenues.length > 0) {
          const venuesParam = selectedVenues.join(',');
          url += `&venues=${encodeURIComponent(venuesParam)}`;
        }
        const response = await fetch(url);
        if (response.ok) {
          const paperData = await response.json();
          return { cites: paperData.cites || [], cited_by: paperData.cited_by || [] };
        }
      } catch (error) {
        console.error(`Error fetching data for ${citedPaper.paperId}:`, error);
      }
      return { cites: [], cited_by: [] };
    });

    const citedByLevel2Promises = data.cited_by.map(async (citingPaper) => {
      try {
        let url = `${API_BASE}/api/paper/${citingPaper.paperId}?limit=20`;
        if (selectedTags.length > 0) {
          const tagsParam = selectedTags.join(',');
          url += `&tags=${encodeURIComponent(tagsParam)}`;
        }
        if (selectedAuthors.length > 0) {
          const authorsParam = selectedAuthors.join(',');
          url += `&authors=${encodeURIComponent(authorsParam)}`;
        }
        if (selectedVenues.length > 0) {
          const venuesParam = selectedVenues.join(',');
          url += `&venues=${encodeURIComponent(venuesParam)}`;
        }
        const response = await fetch(url);
        if (response.ok) {
          const paperData = await response.json();
          return { cites: paperData.cites || [], cited_by: paperData.cited_by || [] };
        }
      } catch (error) {
        console.error(`Error fetching data for ${citingPaper.paperId}:`, error);
      }
      return { cites: [], cited_by: [] };
    });

    const [citesLevel2Results, citedByLevel2Results] = await Promise.all([
      Promise.all(citesLevel2Promises),
      Promise.all(citedByLevel2Promises),
    ]);

    data.cites.forEach((level1Paper, index) => {
      const level2Data = citesLevel2Results[index];
      
      level2Data.cites.forEach((level2Paper: Paper) => {
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

      level2Data.cited_by.forEach((level2Paper: Paper) => {
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

    data.cited_by.forEach((level1Paper, index) => {
      if (!nodeMap.has(level1Paper.paperId)) {
        const node: PaperNode = {
          id: level1Paper.paperId,
          paper: level1Paper,
          type: 'cited_by',
          level: 1,
        };
        nodes.push(node);
        nodeMap.set(level1Paper.paperId, node);
      }
      edges.push({
        source: level1Paper.paperId,
        target: centerPaper.paperId,
        type: 'cited_by',
        level: 1,
      });

      const level2Data = citedByLevel2Results[index];
      
      level2Data.cites.forEach((level2Paper: Paper) => {
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

      level2Data.cited_by.forEach((level2Paper: Paper) => {
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
  };

  const drawGraph = async (data: SearchResult) => {
    if (!svgRef.current || !data.paper) return;

    const { nodes, edges, centerPaper } = await fetchGraphNodes(data);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 1200;
    const height = svgRef.current.clientHeight || 800;

    const g = svg.append('g');

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
      .on('mouseover', function(event, d) {
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
              ${paper.authors.length > 0 ? `<span class="paper-card-authors">${paper.authors.slice(0, 3).join(', ')}${paper.authors.length > 3 ? '...' : ''}</span>` : ''}
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
          divElement.onclick = (e) => {
            e.stopPropagation();
            setQuery(paper.title);
            setActiveTab('list');
            searchPapers(paper.title);
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
  };

  const drawGraphYear = async (data: SearchResult) => {
    if (!svgRef.current || !data.paper) return;

    const { nodes, edges, centerPaper } = await fetchGraphNodes(data);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 1200;
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
    
    const yearLines = g
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

    const yearLabels = g
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
      .on('mouseover', function(event, d) {
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
              ${paper.authors.length > 0 ? `<span class="paper-card-authors">${paper.authors.slice(0, 3).join(', ')}${paper.authors.length > 3 ? '...' : ''}</span>` : ''}
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
          divElement.onclick = (e) => {
            e.stopPropagation();
            setQuery(paper.title);
            setActiveTab('list');
            searchPapers(paper.title);
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
  };

  const PaperCard: React.FC<{ paper: Paper; type: 'cites' | 'cited_by' }> = ({ paper, type }) => {
    const handleCardClick = (e: React.MouseEvent) => {
      // フッターのリンクがクリックされた場合は検索を実行しない
      const target = e.target as HTMLElement;
      if (target.closest('.paper-card-links')) {
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
            <span className="paper-card-authors">{paper.authors.slice(0, 3).join(', ')}</span>
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
        {(selectedTags.length > 0 || selectedAuthors.length > 0 || selectedVenues.length > 0) && (
          <div className="paper-explorer-active-filters">
            <span className="paper-explorer-active-filters-label">フィルタ:</span>
            {selectedTags.map((tag) => (
              <span key={`tag-${tag}`} className="paper-explorer-active-filter-item paper-explorer-active-filter-tag">
                <span className="paper-explorer-active-filter-label">タグ</span>
                {tag}
                <button
                  className="paper-explorer-active-filter-remove"
                  onClick={() => {
                    setSelectedTags(selectedTags.filter(t => t !== tag));
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
                    setSelectedAuthors(selectedAuthors.filter(a => a !== author));
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
                    setSelectedVenues(selectedVenues.filter(v => v !== venue));
                  }}
                  disabled={loading}
                >
                  ×
                </button>
              </span>
            ))}
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
        </>
      )}
    </div>
  );
};

export default PaperExplorer;

