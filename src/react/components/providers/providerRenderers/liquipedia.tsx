import { LiquipediaMatch } from '../../previews/LiquipediaMatch';
import { FeedItemMediaPreview, type FeedItemCardProviderRendererProps } from './common';

export function LiquipediaPreview(props: FeedItemCardProviderRendererProps) {
  return props.facts.liquipediaMatch
    ? <LiquipediaMatch match={props.facts.liquipediaMatch} />
    : <FeedItemMediaPreview {...props} />;
}
