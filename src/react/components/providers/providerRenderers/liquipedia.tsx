import { LiquipediaMatch } from '../../previews/LiquipediaMatch';
import { FeedItemMediaPreview, type FeedItemCardProviderRendererProps } from './common';

export function LiquipediaPreview(props: FeedItemCardProviderRendererProps) {
  return props.model.liquipediaMatch
    ? <LiquipediaMatch match={props.model.liquipediaMatch} />
    : <FeedItemMediaPreview {...props} />;
}
