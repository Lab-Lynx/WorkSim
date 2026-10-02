import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from '@/pages/public/LandingPage';
import { ROUTES } from '@/constants';

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe('LandingPage', () => {
  it('renders the brand, hero headline, and primary CTAs', () => {
    renderLanding();

    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Your First Job Before You Get Your First Job/i,
    );
    expect(screen.getAllByRole('link', { name: /get started|start building/i }).length).toBeGreaterThan(0);
  });

  it('links Get Started / Start Building to register', () => {
    renderLanding();

    const ctaLinks = screen.getAllByRole('link', { name: /get started|start building/i });
    for (const link of ctaLinks) {
      expect(link).toHaveAttribute('href', ROUTES.REGISTER);
    }
  });

  it('exposes how-it-works, pricing, and features sections', () => {
    renderLanding();

    expect(document.getElementById('how-it-works')).toBeTruthy();
    expect(document.getElementById('pricing')).toBeTruthy();
    expect(document.getElementById('features')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /plans for your practice/i })).toBeInTheDocument();
  });
});
