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

export interface Credentials {
  username: string;
  password: string;
}
