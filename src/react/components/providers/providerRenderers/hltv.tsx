import { HltvCountdown, HltvMatchup } from '../../previews/HltvMatch';
import { FeedItemMediaPreview, type FeedItemCardProviderRendererProps } from './common';

export function HltvPreview(props: FeedItemCardProviderRendererProps) {
  const { facts } = props;
  if (!facts.hltvMatchTeams || !facts.hltvSnapshot) return <FeedItemMediaPreview {...props} />;
  return <HltvMatchup teams={facts.hltvMatchTeams} href={facts.item.link} snapshot={facts.hltvSnapshot} />;
}

export function HltvSupplementary({ facts }: FeedItemCardProviderRendererProps) {
  if (facts.hltvMatchTeams || !facts.hltvSnapshot?.startsAt) return null;
  return <HltvCountdown startsAt={facts.hltvSnapshot.startsAt} />;
}
