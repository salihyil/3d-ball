type ToastType = 'success' | 'error' | 'info';

export interface ToastEventPayload {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

class ToastManager {
  private static instance: ToastManager;

  private constructor() {}

  static getInstance() {
    if (!ToastManager.instance) {
      ToastManager.instance = new ToastManager();
    }
    return ToastManager.instance;
  }

  show(message: string, type: ToastType = 'info', duration: number = 4000) {
    const event = new CustomEvent<ToastEventPayload>('bb-toast', {
      detail: {
        id: Math.random().toString(36).substring(2, 9),
        message,
        type,
        duration,
      },
    });
    window.dispatchEvent(event);
  }

  success(message: string, duration?: number) {
    this.show(message, 'success', duration);
  }

  error(message: string, duration?: number) {
    this.show(message, 'error', duration);
  }

  info(message: string, duration?: number) {
    this.show(message, 'info', duration);
  }
}

export const toast = ToastManager.getInstance();
