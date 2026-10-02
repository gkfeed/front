import type {
  FeedCreatorFieldConfig,
  FeedTypeDetectionStatus,
} from '../domain/feedCreator';
import type { FeedInput } from '../types';

export type FeedCreatorSaveStatus = 'idle' | 'saving' | 'success' | 'error';

export type FeedCreatorModel = {
  feed: FeedInput;
  fields: readonly FeedCreatorFieldConfig[];
  submitted: boolean;
  saveStatus: FeedCreatorSaveStatus;
  detectionStatus: FeedTypeDetectionStatus;
  isSaving: boolean;
  isFeedFieldValid: (field: keyof FeedInput) => boolean;
  updateFeed: (field: keyof FeedInput, value: string) => void;
  submitFeed: () => Promise<void>;
};
