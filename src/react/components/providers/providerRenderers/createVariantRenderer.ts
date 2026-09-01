import { createElement, type ComponentType } from 'react';

import type { FeedItemCardRenderFacts } from '../../useFeedItemCardModel';
import {
  FeedItemMediaPreview,
  type FeedItemCardProviderRendererProps,
  type VariantRendererProps,
} from './common';

export function createVariantRenderer<T extends FeedItemCardRenderFacts['variant']['type']>(
  variantType: T,
  Renderer: ComponentType<VariantRendererProps<T>>,
  Fallback: ComponentType<FeedItemCardProviderRendererProps> = FeedItemMediaPreview,
): ComponentType<FeedItemCardProviderRendererProps> {
  return (props) => props.facts.variant.type === variantType
    ? createElement(Renderer, props as VariantRendererProps<T>)
    : createElement(Fallback, props);
}
