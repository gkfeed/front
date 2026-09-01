import { OneFootballMatch } from '../../previews/OneFootballMatch';
import {
  FeedItemMediaPreview,
  StandardCopy,
  type FeedItemCardProviderRendererProps,
} from './common';

export function OneFootballPreview(props: FeedItemCardProviderRendererProps) {
  const { model } = props;
  if (!model.oneFootballSnapshot?.score) return <FeedItemMediaPreview {...props} />;
  return <OneFootballMatch href={model.item.link} snapshot={model.oneFootballSnapshot} />;
}

export function OneFootballCopy(props: FeedItemCardProviderRendererProps) {
  if (props.model.oneFootballSnapshot?.score) return null;
  return <StandardCopy {...props} />;
}
