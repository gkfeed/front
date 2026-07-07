let originalLocalStorageDescriptor: PropertyDescriptor | undefined;
let hasStubbedLocalStorage = false;

class TestStatusError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'TestStatusError';
  }
}

export function createStatusError(message: string, status: number): Error & { status: number } {
  return new TestStatusError(message, status);
}

export function getControlValue(control: HTMLElement): string {
  if (
    control instanceof HTMLInputElement
    || control instanceof HTMLSelectElement
    || control instanceof HTMLTextAreaElement
  ) {
    return control.value;
  }

  throw new Error('Expected a form control with a value');
}

export function stubLocalStorage() {
  const values = new Map<string, string>();

  if (!hasStubbedLocalStorage) {
    originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    hasStubbedLocalStorage = true;
  }

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    },
  });

  return values;
}

export function restoreLocalStorage() {
  if (!hasStubbedLocalStorage) return;

  if (originalLocalStorageDescriptor) {
    Object.defineProperty(window, 'localStorage', originalLocalStorageDescriptor);
  } else {
    Reflect.deleteProperty(window, 'localStorage');
  }

  originalLocalStorageDescriptor = undefined;
  hasStubbedLocalStorage = false;
}
