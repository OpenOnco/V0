import { describe, it, expect } from 'vitest';
import { canonicalizeContent } from '../../src/utils/canonicalize.js';

describe('canonicalizeContent', () => {
  describe('date stripping', () => {
    it('strips "Last updated: Jan 28, 2026" style dates', () => {
      const input = 'Policy content. Last updated: Jan 28, 2026. More content.';
      const result = canonicalizeContent(input);
      
      expect(result).not.toContain('last updated');
      expect(result).not.toContain('2026');
      expect(result).toContain('policy content');
      expect(result).toContain('more content');
    });

    it('strips "Last reviewed: 01/28/2026" style dates', () => {
      const input = 'Content here. Last reviewed: 01/28/2026';
      const result = canonicalizeContent(input);
      
      expect(result).not.toContain('last reviewed');
    });

    it('strips "Last modified" and "Last revised" dates', () => {
      const input = 'Last modified: December 15, 2025. Last revised: November 2024.';
      const result = canonicalizeContent(input);
      
      expect(result).not.toContain('last modified');
      expect(result).not.toContain('last revised');
    });

    it('strips "Page generated at" timestamps', () => {
      const input = 'Page generated at January 1, 2026. Content here.';
      const result = canonicalizeContent(input);
      
      expect(result).not.toContain('page generated');
    });

    it('strips "Retrieved on" and "Accessed" timestamps', () => {
      const input = 'Retrieved on Jan 15, 2026. Accessed March 2025.';
      const result = canonicalizeContent(input);
      
      expect(result).not.toContain('retrieved');
      expect(result).not.toContain('accessed');
    });
  });

  describe('copyright stripping', () => {
    it('strips "Copyright 2024" style', () => {
      const input = 'Content here. Copyright 2024 Company Name.';
      const result = canonicalizeContent(input);
      
      expect(result).not.toContain('copyright');
      expect(result).not.toContain('2024');
    });

    it('strips "© 2026" style', () => {
      const input = '© 2026 All content. More text.';
      const result = canonicalizeContent(input);
      
      expect(result).not.toContain('©');
      expect(result).not.toContain('2026');
    });

    it('strips "Copyright 2024-2026" year ranges', () => {
      const input = 'Copyright 2024-2026 Company.';
      const result = canonicalizeContent(input);
      
      expect(result).not.toContain('copyright');
      expect(result).not.toContain('2024-2026');
    });
  });

  describe('boilerplate stripping', () => {
    it('strips "Skip to main content"', () => {
      const input = 'Skip to main content. Policy information here.';
      const result = canonicalizeContent(input);
      
      expect(result).not.toContain('skip to');
      expect(result).toContain('policy information');
    });

    it('strips "Skip to content" (without main)', () => {
      const input = 'Skip to content. Important policy.';
      const result = canonicalizeContent(input);
      
      expect(result).not.toContain('skip to content');
    });

    it('strips "Print this page"', () => {
      const input = 'Print this page. Coverage criteria below.';
      const result = canonicalizeContent(input);
      
      expect(result).not.toContain('print this page');
    });

    it('strips cookie consent text', () => {
      const input = 'Cookie policy. Cookie consent. Accept all cookies. We use cookies to improve your experience.';
      const result = canonicalizeContent(input);
      
      expect(result).not.toContain('cookie');
    });

    it('strips "Privacy policy" and "Terms of use"', () => {
      const input = 'Privacy policy. Terms of use. Terms and conditions.';
      const result = canonicalizeContent(input);
      
      expect(result).not.toContain('privacy policy');
      expect(result).not.toContain('terms of use');
      expect(result).not.toContain('terms and conditions');
    });

    it('strips "All rights reserved"', () => {
      const input = 'Content here. All rights reserved.';
      const result = canonicalizeContent(input);
      
      expect(result).not.toContain('all rights reserved');
    });

    it('strips "Back to top" and "Breadcrumb"', () => {
      const input = 'Breadcrumb navigation. Content. Back to top.';
      const result = canonicalizeContent(input);
      
      expect(result).not.toContain('breadcrumb');
      expect(result).not.toContain('back to top');
    });
  });

  describe('whitespace normalization', () => {
    it('collapses multiple spaces to single space', () => {
      const input = 'Multiple    spaces     here.';
      const result = canonicalizeContent(input);
      
      expect(result).toBe('multiple spaces here.');
      expect(result).not.toContain('  ');
    });

    it('collapses multiple newlines', () => {
      const input = 'Line one.\n\n\nLine two.';
      const result = canonicalizeContent(input);
      
      expect(result).toBe('line one. line two.');
    });

    it('trims leading and trailing whitespace', () => {
      const input = '   Content here.   ';
      const result = canonicalizeContent(input);
      
      expect(result).toBe('content here.');
    });

    it('handles tabs and mixed whitespace', () => {
      const input = 'Tab\there.\n  Mixed\t\n  whitespace.';
      const result = canonicalizeContent(input);
      
      expect(result).toBe('tab here. mixed whitespace.');
    });
  });

  describe('lowercase conversion', () => {
    it('converts to lowercase', () => {
      const input = 'MixedCase CONTENT Here';
      const result = canonicalizeContent(input);
      
      expect(result).toBe('mixedcase content here');
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(canonicalizeContent('')).toBe('');
    });

    it('handles null', () => {
      expect(canonicalizeContent(null)).toBe('');
    });

    it('handles undefined', () => {
      expect(canonicalizeContent(undefined)).toBe('');
    });

    it('preserves policy-relevant content', () => {
      const input = 'Coverage is approved for Signatera MRD testing in colorectal cancer patients post-surgery.';
      const result = canonicalizeContent(input);
      
      expect(result).toContain('coverage is approved');
      expect(result).toContain('signatera');
      expect(result).toContain('colorectal cancer');
    });

    it('handles real-world payer page excerpt', () => {
      const input = `Skip to main content
        Medical Policy
        Last updated: January 15, 2026
        Molecular Residual Disease Testing
        Coverage is provided for FDA-approved MRD tests.
        Print this page
        © 2026 Insurance Company. All rights reserved.
        Privacy policy | Terms of use`;
      
      const result = canonicalizeContent(input);
      
      // Should keep policy content
      expect(result).toContain('medical policy');
      expect(result).toContain('molecular residual disease');
      expect(result).toContain('fda-approved');
      
      // Should strip boilerplate
      expect(result).not.toContain('skip to');
      expect(result).not.toContain('last updated');
      expect(result).not.toContain('print this');
      expect(result).not.toContain('©');
      expect(result).not.toContain('privacy policy');
    });
  });
});
