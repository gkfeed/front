import { useCallback, useEffect, useRef, useState } from 'react';

import { deleteFeedItem } from '../features/feeds/feedUseCases';
import type { Credentials } from '../types';

export type FeedItemDeletionStatus = 'pending' | 'failed';

export type FeedItemDeletion = {
  itemId: number;
  title: string;
  status: FeedItemDeletionStatus;
};

type MutableDeletion = FeedItemDeletion;

export function useFeedItemDeletion(credentials: Credentials | null) {
  const [operations, setOperations] = useState<FeedItemDeletion[]>([]);
  const operationsRef = useRef(new Map<number, MutableDeletion>());
  const queueRef = useRef<number[]>([]);
  const isProcessingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  const publishOperations = useCallback(() => {
    if (isMountedRef.current) setOperations([...operationsRef.current.values()]);
  }, []);

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;

    isProcessingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const itemId = queueRef.current.shift();
        if (itemId === undefined) continue;

        const operation = operationsRef.current.get(itemId);
        if (!operation || operation.status !== 'pending') continue;

        try {
          await deleteFeedItem(itemId, credentials);
          if (operationsRef.current.get(itemId) === operation) {
            operationsRef.current.delete(itemId);
            publishOperations();
          }
        } catch {
          const currentOperation = operationsRef.current.get(itemId);
          if (currentOperation !== operation) continue;

          operationsRef.current.set(itemId, {
            ...operation,
            status: 'failed',
          });
          publishOperations();
        }
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [credentials, publishOperations]);

  const retryItem = useCallback((itemId: number): boolean => {
    const operation = operationsRef.current.get(itemId);
    if (!operation || operation.status !== 'failed') return false;

    operationsRef.current.set(itemId, {
      ...operation,
      status: 'pending',
    });
    queueRef.current.push(itemId);
    publishOperations();
    void processQueue();
    return true;
  }, [processQueue, publishOperations]);

  const deleteItem = useCallback((itemId: number, title: string): boolean => {
    const existingOperation = operationsRef.current.get(itemId);
    if (existingOperation) {
      return existingOperation.status === 'failed' ? retryItem(itemId) : false;
    }

    operationsRef.current.set(itemId, {
      itemId,
      title,
      status: 'pending',
    });
    queueRef.current.push(itemId);
    publishOperations();
    void processQueue();
    return true;
  }, [processQueue, publishOperations, retryItem]);

  const isItemPending = useCallback(
    (itemId: number) => operations.some((operation) => (
      operation.itemId === itemId && operation.status === 'pending'
    )),
    [operations],
  );

  return {
    deleteItem,
    retryItem,
    operations,
    failedDeletions: operations.filter((operation) => operation.status === 'failed'),
    isItemPending,
  };
}
