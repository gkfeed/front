export interface FeedInput {
  title: string;
  type: string;
  url: string;
}

export interface FeedLazyInput {
  url: string;
}

export interface Feed extends FeedInput {
  id: number;
}

export interface FeedItem {
  id: number;
  feedId: number;
  link: string;
  title: string;
  text: string;
}

export interface Credentials {
  username: string;
  password: string;
}
