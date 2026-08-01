declare module 'socket.io-client' {
  type SocketIoTransportOptions = {
    extraHeaders?: Record<string, string>;
    agent?: unknown;
    maxPayload?: number;
  };

  type SocketIoOptions = {
    reconnection?: boolean;
    timeout?: number;
    transports?: string[];
    transportOptions?: Record<string, SocketIoTransportOptions>;
  };

  type SocketIoSocket = {
    on(event: string, handler: (...args: unknown[]) => void): SocketIoSocket;
    emit(event: string, ...args: unknown[]): void;
    close(): void;
  };

  export function connect(url: string, options?: SocketIoOptions): SocketIoSocket;
}
