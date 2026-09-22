import type {
  FeedCreatorFieldConfig,
  FeedCreatorMode,
  FeedTypeDetectionStatus,
} from '../domain/feedCreator';
import type { FeedInput } from '../types';

export type FeedCreatorSaveStatus = 'idle' | 'saving' | 'success' | 'error';

export type FeedCreatorModel = {
  feed: FeedInput;
  mode: FeedCreatorMode;
  fields: readonly FeedCreatorFieldConfig[];
  submitted: boolean;
  saveStatus: FeedCreatorSaveStatus;
  detectionStatus: FeedTypeDetectionStatus;
  isSaving: boolean;
  isFeedFieldValid: (field: keyof FeedInput) => boolean;
  updateMode: (mode: FeedCreatorMode) => void;
  updateFeed: (field: keyof FeedInput, value: string) => void;
  detectFeedType: () => Promise<void>;
  submitFeed: () => Promise<void>;
};
