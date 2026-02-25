import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SetNicknameModal } from './SetNicknameModal';

// Mock the hook and its return values
const mockUpdateNickname = vi.fn();
vi.mock('../../hooks/usePlayerProfile', () => ({
  usePlayerProfile: () => ({
    updateNickname: mockUpdateNickname,
  }),
}));

// Mock translation hook
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key,
  }),
}));

// Mock toast
vi.mock('../../utils/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SetNicknameModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<SetNicknameModal isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly when isOpen is true', () => {
    render(<SetNicknameModal isOpen={true} />);
    expect(screen.getByText('Choose Your Nickname')).toBeInTheDocument();
    expect(
      screen.getByText('Please set a nickname to start playing.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save Nickname' })
    ).toBeInTheDocument();
  });

  it('shows validation errors for invalid nicknames', async () => {
    render(<SetNicknameModal isOpen={true} />);

    const input = screen.getByPlaceholderText('Enter nickname...');
    const button = screen.getByRole('button', { name: 'Save Nickname' });

    // Test minimum length (less than 3 characters)
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByText('auth.validation.nickname_min')
      ).toBeInTheDocument();
    });

    // Test invalid characters
    fireEvent.change(input, { target: { value: 'invalid_!@#' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByText('auth.validation.nickname_format')
      ).toBeInTheDocument();
    });

    // Ensure mockUpdateNickname was never called
    expect(mockUpdateNickname).not.toHaveBeenCalled();
  });

  it('calls updateNickname on valid submission', async () => {
    mockUpdateNickname.mockResolvedValueOnce(undefined);
    render(<SetNicknameModal isOpen={true} />);

    const input = screen.getByPlaceholderText('Enter nickname...');
    const button = screen.getByRole('button', { name: 'Save Nickname' });

    fireEvent.change(input, { target: { value: 'ValidNick_123' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockUpdateNickname).toHaveBeenCalledWith('ValidNick_123');
    });
  });
});
