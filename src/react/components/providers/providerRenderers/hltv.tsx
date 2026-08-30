import { HltvCountdown, HltvMatchup } from '../../previews/HltvMatch';
import { FeedItemMediaPreview, type FeedItemCardProviderRendererProps } from './common';

export function HltvPreview(props: FeedItemCardProviderRendererProps) {
  const { model } = props;
  if (!model.hltvMatchTeams || !model.hltvSnapshot) return <FeedItemMediaPreview {...props} />;
  return <HltvMatchup teams={model.hltvMatchTeams} href={model.item.link} snapshot={model.hltvSnapshot} />;
}

export function HltvSupplementary({ model }: FeedItemCardProviderRendererProps) {
  if (model.hltvMatchTeams || !model.hltvSnapshot?.startsAt) return null;
  return <HltvCountdown startsAt={model.hltvSnapshot.startsAt} />;
}
