import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ExternalLink } from '@/components/common/ExternalLink';

describe('ExternalLink', () => {
    it('renders valid https and http URLs as clickable links with safe target and rel attributes', () => {
        render(
            <ExternalLink href="https://github.com/worksim/repo">
                GitHub Repository
            </ExternalLink>
        );

        const link = screen.getByRole('link', { name: /GitHub Repository/i });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', 'https://github.com/worksim/repo');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');

        render(
            <ExternalLink href="http://example.com/build">
                CI Build Run
            </ExternalLink>
        );

        const httpLink = screen.getByRole('link', { name: /CI Build Run/i });
        expect(httpLink).toHaveAttribute('href', 'http://example.com/build');
        expect(httpLink).toHaveAttribute('target', '_blank');
        expect(httpLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('includes accessible screen-reader-only text for new-tab indication', () => {
        render(
            <ExternalLink href="https://github.com/worksim/repo">
                Pull Request #42
            </ExternalLink>
        );

        const link = screen.getByRole('link');
        expect(link).toHaveTextContent('Pull Request #42');
        expect(link).toHaveTextContent('(opens in a new tab)');

        const srOnlySpan = screen.getByText('(opens in a new tab)');
        expect(srOnlySpan).toHaveClass('sr-only');
    });

    it('renders as plain text fallback for unsafe protocols like javascript: and data:', () => {
        const { container: jsContainer } = render(
            <ExternalLink href="javascript:alert(document.cookie)">
                Unsafe JS Link
            </ExternalLink>
        );

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.getByText('Unsafe JS Link')).toBeInTheDocument();
        expect(jsContainer.querySelector('a')).toBeNull();

        const { container: dataContainer } = render(
            <ExternalLink href="data:text/html,<script>alert(1)</script>">
                Unsafe Data Link
            </ExternalLink>
        );

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.getByText('Unsafe Data Link')).toBeInTheDocument();
        expect(dataContainer.querySelector('a')).toBeNull();
    });

    it('renders plain text fallback for malformed, relative, or unsupported protocol URLs', () => {
        const invalidUrls = [
            'ftp://example.com',
            'httpjavascript:alert(1)',
            '/relative/path',
            '//protocol-relative.com',
            'invalid-url-string',
            '',
        ];

        invalidUrls.forEach((url) => {
            const { unmount } = render(
                <ExternalLink href={url}>Fallback Content</ExternalLink>
            );

            expect(screen.queryByRole('link')).not.toBeInTheDocument();
            expect(screen.getByText('Fallback Content')).toBeInTheDocument();

            unmount();
        });
    });

    it('applies custom className to link or plain content span appropriately', () => {
        render(
            <ExternalLink href="https://github.com" className="custom-link-class">
                Styled Link
            </ExternalLink>
        );

        const link = screen.getByRole('link', { name: /Styled Link/i });
        expect(link).toHaveClass('custom-link-class');

        render(
            <ExternalLink href="javascript:void(0)" className="custom-fallback-class">
                Styled Fallback
            </ExternalLink>
        );

        const span = screen.getByText('Styled Fallback');
        expect(span).toHaveClass('custom-fallback-class');
    });
});