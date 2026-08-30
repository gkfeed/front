import { useCreateFeedPageModel } from '../adapters/feeds/useCreateFeedPageModel';
import { FeedCreator } from '../components/FeedCreator';

export function CreateFeedPage() {
  return <FeedCreator model={useCreateFeedPageModel()} />;
}
