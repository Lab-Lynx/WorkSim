import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GitHubConnectionCard, { GITHUB_PERMISSIONS_TEXT } from '@/components/github/GitHubConnectionCard';
import type { UiError } from '@/lib/api/errors';
import type { GitHubConnectionSummary } from '@/types';

describe('GitHubConnectionCard (FE-078)', () => {
  const connection: GitHubConnectionSummary = {
    connected: false,
    githubLogin: null,
    repo: null,
  };
  const baseProps = {
    connection,
    hasAccess: true,
    oauthResult: null,
    onDismissResult: vi.fn(),
    isConnecting: false,
    connectError: null as UiError | null,
    onConnect: vi.fn(),
    onDisconnectClick: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it('renders the permission wording from its constant', () => {
    render(<MemoryRouter><GitHubConnectionCard {...baseProps} /></MemoryRouter>);
    expect(screen.getByText(GITHUB_PERMISSIONS_TEXT)).toBeInTheDocument();
  });

  it('enables connect without requiring an active subscription', () => {
    render(<MemoryRouter><GitHubConnectionCard {...baseProps} /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /connect github/i })).toBeEnabled();
    expect(screen.queryByText(/an active subscription is required/i)).not.toBeInTheDocument();
  });

  it('delegates connect and shows the redirecting state', () => {
    const onConnect = vi.fn();
    render(<MemoryRouter><GitHubConnectionCard {...baseProps} onConnect={onConnect} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Connect GitHub' }));
    expect(onConnect).toHaveBeenCalledOnce();

    render(<MemoryRouter><GitHubConnectionCard {...baseProps} isConnecting /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /redirecting to github/i })).toBeDisabled();
  });

  it('renders connected state and delegates disconnection to the page', () => {
    const onDisconnectClick = vi.fn();
    render(
      <MemoryRouter>
        <GitHubConnectionCard
          {...baseProps}
          connection={{ connected: true, githubLogin: 'octocat', repo: null }}
          onDisconnectClick={onDisconnectClick}
        />
      </MemoryRouter>
    );
    expect(screen.getByRole('status')).toHaveTextContent(/connected as @octocat/i);
    fireEvent.click(screen.getByRole('button', { name: /disconnect github/i }));
    expect(onDisconnectClick).toHaveBeenCalledOnce();
  });

  it('shows OAuth success with status semantics and supports dismissal', () => {
    const onDismissResult = vi.fn();
    render(
      <MemoryRouter>
        <GitHubConnectionCard
          {...baseProps}
          oauthResult={{ status: 'connected' }}
          onDismissResult={onDismissResult}
        />
      </MemoryRouter>
    );
    expect(screen.getByRole('status')).toHaveTextContent('GitHub connected.');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismissResult).toHaveBeenCalledOnce();
  });

  it('maps unknown OAuth reasons to generic text', () => {
    render(
      <MemoryRouter>
        <GitHubConnectionCard
          {...baseProps}
          oauthResult={{ status: 'error', reason: 'raw_untrusted_reason_string' }}
        />
      </MemoryRouter>
    );
    const alert = screen.getByRole('alert');
    expect(alert).not.toHaveTextContent('raw_untrusted_reason_string');
    expect(alert).toHaveTextContent("Couldn't connect to GitHub. Try again.");
  });

  it('renders the page-provided connect error', () => {
    render(
      <MemoryRouter>
        <GitHubConnectionCard
          {...baseProps}
          connectError={{
            status: 403,
            kind: 'api',
            message: 'Reconnect GitHub.',
            action: 'reconnect_github',
            isNotFound: false,
            isTimeout: false,
          }}
        />
      </MemoryRouter>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Reconnect GitHub.');
  });
});