import type { ArticleBlock, ArticlePreview } from '../../../shared/articleContracts';

export function ArticleContent({ article }: { article: ArticlePreview }) {
  return (
    <article className="article-reader__article">
      <h1>{article.title}</h1>
      {article.byline ? <p className="article-reader__byline">{article.byline}</p> : null}
      {article.blocks.map((block, index) => <ArticleBlockView key={`${block.type}-${index}`} block={block} />)}
    </article>
  );
}

function ArticleBlockView({ block }: { block: ArticleBlock }) {
  if (block.type === 'paragraph') return <p>{block.text}</p>;
  if (block.type === 'quote') return <blockquote>{block.text}</blockquote>;
  if (block.type === 'image') {
    return <img src={block.src} alt={block.alt} loading="lazy" referrerPolicy="no-referrer" />;
  }
  if (block.type === 'list') {
    const List = block.ordered ? 'ol' : 'ul';
    return <List>{block.items.map((item, index) => <li key={index}>{item}</li>)}</List>;
  }
  if (block.type !== 'heading') return null;
  const level = Math.min(6, Math.max(2, block.level + 1));
  const Heading = `h${level}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  return <Heading>{block.text}</Heading>;
}
