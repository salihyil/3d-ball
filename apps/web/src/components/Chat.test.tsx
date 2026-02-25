import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { socket } from '../hooks/useNetwork';
import Chat from './Chat';

// Mock useTranslation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('Chat Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should render chat messages when received from socket', () => {
    render(<Chat />);

    act(() => {
      // Find the handler and call it
      const handler = (
        socket.on as unknown as { mock: { calls: unknown[][] } }
      ).mock.calls.find((call) => call[0] === 'chat_message')?.[1] as (
        msg: unknown
      ) => void;
      handler({
        id: '1',
        type: 'user',
        nickname: 'Player1',
        text: 'Hello world',
        timestamp: Date.now(),
      });
    });

    expect(screen.getByText('Player1:')).toBeDefined();
    expect(screen.getByText('Hello world')).toBeDefined();
  });

  it('should emit message when form is submitted', () => {
    render(<Chat />);
    const input = screen.getByPlaceholderText('common.press_enter_chat');

    fireEvent.change(input, { target: { value: 'My Message' } });
    fireEvent.submit(input.closest('form')!);

    expect(socket.emit).toHaveBeenCalledWith('send-chat-message', {
      text: 'My Message',
    });
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('should handle fading in game overlay', () => {
    render(<Chat isGameOverlay={true} />);

    // Should be visible initially
    const container = document.querySelector('.chat-container');
    expect(container?.classList.contains('faded')).toBe(false);

    // After 5s of inactivity
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(container?.classList.contains('faded')).toBe(true);

    // Becomes visible again on message
    act(() => {
      const handler = (
        socket.on as unknown as { mock: { calls: unknown[][] } }
      ).mock.calls.find((call) => call[0] === 'chat_message')?.[1] as (
        msg: unknown
      ) => void;
      handler({
        id: '2',
        type: 'system',
        text: 'Activity',
        timestamp: Date.now(),
      });
    });

    expect(container?.classList.contains('faded')).toBe(false);
  });

  it('should focus input when Enter is pressed globally in game overlay', () => {
    render(<Chat isGameOverlay={true} />);
    const input = screen.getByPlaceholderText('common.press_enter_chat');

    fireEvent.keyDown(window, { key: 'Enter' });

    expect(document.activeElement).toBe(input);
  });
});
