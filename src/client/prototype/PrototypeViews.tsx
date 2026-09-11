/** Throwaway layouts: compare a spatial graph, a reading desk, and a research path. */
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import styles from './Prototype.module.css'

export interface PrototypeNode {
  readonly id: string
  readonly kind: 'session' | 'card'
  readonly title: string
  readonly summary: string
  readonly stage: number
  readonly date: number
}

export interface PrototypeEdge {
  readonly from: string
  readonly to: string
  readonly label: string
  readonly kind: 'source' | 'reuse'
}

export interface PrototypeViewProps {
  readonly nodes: readonly PrototypeNode[]
  readonly edges: readonly PrototypeEdge[]
  readonly selected: string
  readonly comparisons: readonly string[]
  readonly select: (id: string) => void
  readonly compare: (id: string) => void
  readonly detail: ReactNode
  readonly create: () => void
}

export function Glyph({ name, size = 18 }: { readonly name: string; readonly size?: number }): ReactElement {
  const paths: Record<string, ReactNode> = {
    graph: <><rect x="3" y="3" width="6" height="6" rx="2" /><rect x="15" y="15" width="6" height="6" rx="2" /><path d="M6 9v9h9M9 6h9v9" /></>,
    card: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
    session: <><path d="M20 14a3 3 0 0 1-3 3H9l-5 4V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3Z" /><path d="M8 8h8M8 12h5" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    sparkle: <><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z" /><path d="M20 2v4M18 4h4" /></>,
    source: <><path d="m10 13 4-4M8 15l-1 1a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0M13 16a3 3 0 0 0 4 0l4-4a3 3 0 0 0-4-4l-1 1" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    path: <><circle cx="5" cy="5" r="2" /><circle cx="19" cy="19" r="2" /><path d="M5 7v8a4 4 0 0 0 4 4h8M7 5h8a4 4 0 0 1 4 4v3" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.card}</svg>
}

function NodeLabel({ node }: { readonly node: PrototypeNode }): ReactElement {
  return <span className={styles.nodeLabel}><Glyph name={node.kind} size={14} />{node.kind === 'card' ? '知识' : node.stage === 2 ? '继续探索' : '讨论'}</span>
}

export function VariantA(props: PrototypeViewProps): ReactElement {
  const viewport = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(0.85)
  const [pan, setPan] = useState({ x: 16, y: 32 })
  const drag = useRef<{ x: number; y: number; left: number; top: number }>()
  const groups = [0, 1, 2, 3].map(stage => props.nodes.filter(node => node.stage === stage))
  for (const stage of [1, 3]) groups[stage]!.sort((left, right) => {
    const rank = (id: string): number => groups[stage - 1]!.findIndex(node => props.edges.some(edge => edge.kind === 'source' && edge.from === node.id && edge.to === id))
    return rank(left.id) - rank(right.id)
  })
  const positions = new Map(groups.flatMap((nodes, stage) => nodes.map((node, index) => [node.id, { x: stage * 290 + 24, y: index * 166 + 64 }] as const)))
  const columns = Math.max(3, ...props.nodes.map(node => node.stage + 1))
  const world = { width: columns * 290 + 24, height: Math.max(2, ...groups.map(group => group.length)) * 166 + 96 }
  const fit = (): void => {
    const element = viewport.current
    if (!element) return
    const scale = Math.min(1, (element.clientWidth - 24) / world.width, (element.clientHeight - 56) / world.height)
    setZoom(Math.max(0.35, scale))
    setPan({ x: Math.max(8, (element.clientWidth - world.width * scale) / 2), y: 18 })
  }
  useEffect(() => {
    fit()
    const observer = new ResizeObserver(fit)
    if (viewport.current) observer.observe(viewport.current)
    return () => { observer.disconnect() }
  }, [world.width, world.height])
  const neighbors = new Set(props.edges.filter(edge => edge.from === props.selected || edge.to === props.selected).flatMap(edge => [edge.from, edge.to]))
  return <div className={styles.mapLayout}>
    <section className={styles.map} aria-label="研究关系图" ref={viewport}
      onPointerDown={event => {
        if ((event.target as HTMLElement).closest('button, input')) return
        drag.current = { x: event.clientX, y: event.clientY, left: pan.x, top: pan.y }
        event.currentTarget.setPointerCapture(event.pointerId)
      }} onPointerMove={event => {
        if (drag.current) setPan({ x: drag.current.left + event.clientX - drag.current.x, y: drag.current.top + event.clientY - drag.current.y })
      }} onPointerUp={() => { drag.current = undefined }} onPointerCancel={() => { drag.current = undefined }}>
      <div className={styles.mapCaption}><span className={styles.liveDot} />研究正在生长<span>拖动空白处移动画布</span></div>
      <div className={styles.world} style={{ width: world.width, height: world.height, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        {['从讨论出发', '留下有价值的知识', '带着知识继续', '形成新的发现'].slice(0, columns).map((title, index) =>
          <div className={styles.columnTitle} key={title} style={{ left: index * 290 + 24 }}><span>0{index + 1}</span>{title}</div>)}
        <svg className={styles.edges} width={world.width} height={world.height} aria-label="来源与实际沿用关系">
          <defs><marker id="prototype-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 7 3.5 0 7" fill="none" stroke="currentColor" /></marker></defs>
          {props.edges.map((edge, index) => {
            const from = positions.get(edge.from), to = positions.get(edge.to)
            if (!from || !to) return null
            const x1 = from.x + 228, y1 = from.y + 61, x2 = to.x, y2 = to.y + 61
            const active = edge.from === props.selected || edge.to === props.selected
            return <g key={`${edge.from}:${edge.to}:${index}`} className={`${styles.edge} ${edge.kind === 'reuse' ? styles.reuseEdge : ''} ${active ? styles.activeEdge : ''}`}>
              <path d={`M${x1} ${y1} C${x1 + 38} ${y1}, ${x2 - 38} ${y2}, ${x2} ${y2}`} markerEnd="url(#prototype-arrow)" />
              <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 9} textAnchor="middle">{edge.label}</text>
            </g>
          })}
        </svg>
        {props.nodes.map(node => <button key={node.id} type="button" onClick={() => { props.select(node.id) }}
          className={`${styles.graphNode} ${node.kind === 'card' ? styles.knowledgeNode : ''} ${props.selected === node.id ? styles.selectedNode : ''} ${neighbors.has(node.id) ? styles.neighborNode : ''}`}
          style={{ left: positions.get(node.id)!.x, top: positions.get(node.id)!.y }} aria-pressed={props.selected === node.id}>
          <NodeLabel node={node} /><strong>{node.title}</strong><span className={styles.nodeSummary}>{node.summary}</span>
        </button>)}
      </div>
      {props.nodes.length === 0 ? <div className={styles.empty}><Glyph name="graph" size={36} /><h3>从一个值得研究的问题开始</h3><p>保存第一条知识，或先选择一个研究主题。</p><button type="button" onClick={props.create}>新建卡片</button></div> : null}
      <div className={styles.zoomBar}><button type="button" aria-label="缩小图谱" onClick={() => { setZoom(value => Math.max(0.3, value - 0.1)) }}>−</button><span>{Math.round(zoom * 100)}%</span><button type="button" aria-label="放大图谱" onClick={() => { setZoom(value => Math.min(1.5, value + 0.1)) }}>+</button><i /><button type="button" onClick={fit}>适应画布</button></div>
      <div className={styles.legend}><span />来源 <span className={styles.legendReuse} />已用于新讨论</div>
    </section>
    <aside className={styles.inspector} aria-label="内容与研究操作">{props.detail}</aside>
  </div>
}

export function VariantB(props: PrototypeViewProps): ReactElement {
  const cards = props.nodes.filter(node => node.kind === 'card')
  return <div className={styles.deskLayout}>
    <section className={styles.catalog} aria-label="知识目录">
      <div className={styles.catalogHeading}><span>你的知识</span><small>{cards.length} 条</small></div>
      {cards.map((node, index) => <button type="button" key={node.id} className={`${styles.catalogItem} ${props.selected === node.id ? styles.catalogSelected : ''}`} onClick={() => { props.select(node.id) }}>
        <span className={styles.catalogNumber}>{String(index + 1).padStart(2, '0')}</span><div><strong>{node.title}</strong><p>{node.summary}</p><small>{props.edges.filter(edge => edge.from === node.id).length > 0 ? '已进入后续研究' : '保留依据，随时继续'}</small></div><Glyph name="arrow" size={15} />
      </button>)}
      <button type="button" className={styles.newCatalog} onClick={props.create}><Glyph name="plus" />写下一个新发现</button>
      <div className={styles.catalogHeading}><span>本主题的讨论</span></div>
      {props.nodes.filter(node => node.kind === 'session').map(node => <button className={styles.sessionRow} type="button" key={node.id} onClick={() => { props.select(node.id) }}><Glyph name="session" size={16} /><span>{node.title}</span></button>)}
    </section>
    <article className={styles.readingDesk} aria-label="知识阅读区"><div className={styles.paperTop}>RESEARCH NOTES<span>让值得留下的思考，随时可用。</span></div>{props.detail}</article>
  </div>
}

export function VariantC(props: PrototypeViewProps): ReactElement {
  const stages = [
    ['展开讨论', '从不同角度理解问题'], ['留下知识', '保留你认为有价值的内容'], ['继续探索', '让旧知识进入新问题'], ['新的发现', '把这一轮成果接回来'],
  ]
  return <div className={styles.pathLayout}>
    <section className={styles.journey} aria-label="研究路径">
      <div className={styles.journeyIntro}><span className={styles.eyebrow}>从探索到积累</span><h2>把每一步思考，接成一条路。</h2><p>选择两条知识进行对照，或从任何一处继续。</p></div>
      <div className={styles.stageBoard}>{stages.map(([title, description], stage) => <section className={styles.stage} key={title}>
        <header><span className={styles.stageNumber}>0{stage + 1}</span><div><h3>{title}</h3><p>{description}</p></div><small>{props.nodes.filter(node => node.stage === stage).length}</small></header>
        {props.nodes.filter(node => node.stage === stage).map(node => <article key={node.id} className={`${styles.pathCard} ${props.selected === node.id ? styles.pathSelected : ''}`}>
          <button type="button" onClick={() => { props.select(node.id) }}><NodeLabel node={node} /><h4>{node.title}</h4><p>{node.summary}</p></button>
          <footer>{node.kind === 'card' ? <button type="button" aria-pressed={props.comparisons.includes(node.id)} onClick={() => { props.compare(node.id) }}><Glyph name={props.comparisons.includes(node.id) ? 'check' : 'plus'} size={13} />{props.comparisons.includes(node.id) ? '已选作对照' : '加入对照'}</button> : <span>可阅读原文</span>}<button type="button" aria-label={`查看${node.title}`} onClick={() => { props.select(node.id) }}><Glyph name="arrow" size={15} /></button></footer>
        </article>)}
        {props.nodes.every(node => node.stage !== stage) ? <div className={styles.stageEmpty}>{stage === 3 ? '从新讨论中留下知识，这里就会出现新的发现。' : '下一步，从这里展开。'}</div> : null}
      </section>)}</div>
    </section>
    <aside className={styles.pathInspector} aria-label="选中内容与下一步">{props.detail}</aside>
  </div>
}
