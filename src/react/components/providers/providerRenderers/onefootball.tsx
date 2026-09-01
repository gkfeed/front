import { OneFootballMatch } from '../../previews/OneFootballMatch';
import {
  FeedItemMediaPreview,
  StandardCopy,
  type FeedItemCardProviderRendererProps,
} from './common';

export function OneFootballPreview(props: FeedItemCardProviderRendererProps) {
  const { facts } = props;
  if (!facts.oneFootballSnapshot?.score) return <FeedItemMediaPreview {...props} />;
  return <OneFootballMatch href={facts.item.link} snapshot={facts.oneFootballSnapshot} />;
}

export function OneFootballCopy(props: FeedItemCardProviderRendererProps) {
  if (props.facts.oneFootballSnapshot?.score) return null;
  return <StandardCopy {...props} />;
}
