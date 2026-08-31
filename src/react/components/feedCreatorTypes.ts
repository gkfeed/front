import type {
  FeedCreatorFieldConfig,
  FeedCreatorMode,
} from '../domain/feedCreator';
import type { FeedInput } from '../types';

export type FeedCreatorSaveStatus = 'idle' | 'saving' | 'success' | 'error';

export type FeedCreatorModel = {
  feed: FeedInput;
  mode: FeedCreatorMode;
  fields: readonly FeedCreatorFieldConfig[];
  submitted: boolean;
  saveStatus: FeedCreatorSaveStatus;
  isSaving: boolean;
  isFeedFieldValid: (field: keyof FeedInput) => boolean;
  updateMode: (mode: FeedCreatorMode) => void;
  updateFeed: (field: keyof FeedInput, value: string) => void;
  submitFeed: () => Promise<void>;
};
