export interface ProviderDataModule<T> {
  is(value: unknown): value is T;
  imageUrls(value: T): readonly string[];
}
