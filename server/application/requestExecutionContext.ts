export interface RequestExecutionContext {
  readonly signal: AbortSignal;
  readonly deadline: number;
  remainingMs(maximum?: number): number;
}

export function createDetachedRequestExecutionContext(): RequestExecutionContext {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    deadline: Number.POSITIVE_INFINITY,
    remainingMs(maximum = Number.POSITIVE_INFINITY) {
      return maximum;
    },
  };
}

export function isRequestDeadlineExceeded(context: RequestExecutionContext): boolean {
  return context.remainingMs() <= 0;
}

export function throwIfRequestAborted(context: RequestExecutionContext): void {
  if (context.signal.aborted) {
    throw new Error(isRequestDeadlineExceeded(context)
      ? 'Request deadline exceeded'
      : 'Request aborted');
  }
}
