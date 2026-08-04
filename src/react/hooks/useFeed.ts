// Compatibility façade for callers that still import the feed hook from the
// hooks layer. Feed-page behavior is owned by the feature model so loading,
// deletion, and route-id handling cannot drift between entry points.
export {
  useFeedPageModel as useFeed,
  type FeedDeleteStatus,
  type FeedLoadStatus,
} from '../features/feeds/useFeedPageModel';
