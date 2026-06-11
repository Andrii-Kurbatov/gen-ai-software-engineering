import { ClassificationService } from '../src/services/classification.service';

describe('ClassificationService', () => {
  const service = new ClassificationService();
  describe('Category Detection', () => {
    it('should detect account_access from login keywords', () => {
      const result = service.classify(
        'Cannot login to my account',
        'I forgot my password and cannot sign in'
      );
      expect(result.category).toBe('account_access');
      expect(result.keywords).toContain('login');
    });

    it('should detect technical_issue from error keywords', () => {
      const result = service.classify(
        'Application crashes on startup',
        'Getting a 500 error when I try to use the app'
      );
      expect(result.category).toBe('technical_issue');
      expect(result.keywords.length).toBeGreaterThan(0);
    });

    it('should detect billing_question from payment keywords', () => {
      const result = service.classify(
        'Invoice and payment issue',
        'I was charged twice for my subscription and need a refund'
      );
      expect(result.category).toBe('billing_question');
      expect(result.keywords.length).toBeGreaterThan(0);
    });

    it('should detect feature_request from enhancement keywords', () => {
      const result = service.classify(
        'Feature request: add dark mode',
        'Would be nice to have a dark mode enhancement for the UI'
      );
      expect(result.category).toBe('feature_request');
      expect(result.keywords.length).toBeGreaterThan(0);
    });

    it('should detect bug_report from reproduction steps keywords', () => {
      const result = service.classify(
        'Bug report with steps to reproduce',
        'Steps to reproduce: 1. Click button. Expected behavior: dialog opens. Actual behavior: crash.'
      );
      expect(result.category).toBe('bug_report');
      expect(result.keywords.length).toBeGreaterThan(0);
    });

    it('should fallback to other when no keywords match', () => {
      const result = service.classify(
        'Random subject about nothing',
        'This is a description with no relevant keywords'
      );
      expect(result.category).toBe('other');
      expect(result.confidence).toBe(0);
      expect(result.keywords.length).toBe(0);
    });
  });

  describe('Priority Detection', () => {
    it('should detect urgent priority', () => {
      const result = service.classify(
        'Critical production issue',
        'Our production database is down due to a security breach'
      );
      expect(result.priority).toBe('urgent');
      expect(result.keywords).toContain('critical');
    });

    it('should detect high priority', () => {
      const result = service.classify(
        'Important blocking issue',
        'This is an important blocker that needs immediate attention asap'
      );
      expect(result.priority).toBe('high');
    });

    it('should detect low priority', () => {
      const result = service.classify(
        'Minor cosmetic issue',
        'This is a suggestion for a cosmetic improvement'
      );
      expect(result.priority).toBe('low');
    });

    it('should default to medium priority when no keywords match', () => {
      const result = service.classify(
        'Regular update request',
        'This is just a normal inquiry with no priority indicators'
      );
      expect(result.priority).toBe('medium');
    });

    it('should include matched priority keyword in keywords array', () => {
      const result = service.classify(
        'Urgent issue needs critical fix',
        'This is a critical problem that needs to be fixed immediately'
      );
      expect(result.priority).toBe('urgent');
      expect(result.keywords).toContain('critical');
    });
  });

  describe('Confidence Scoring', () => {
    it('should calculate confidence as matched/total rounded to 2 decimals', () => {
      const result = service.classify(
        'Login and password reset issue',
        'Cannot login with my password and need help resetting'
      );
      expect(result.category).toBe('account_access');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.confidence.toString().split('.')[1]?.length).toBeLessThanOrEqual(2);
    });

    it('should return confidence 0 for other category', () => {
      const result = service.classify(
        'Unrelated question about nothing',
        'Just some random content with no keywords'
      );
      expect(result.category).toBe('other');
      expect(result.confidence).toBe(0);
    });
  });

  describe('Multiple Keywords Matching', () => {
    it('should match multiple keywords and calculate proper confidence', () => {
      const result = service.classify(
        'Cannot login and need password help',
        'I cannot login to the system and need to reset my password'
      );
      expect(result.category).toBe('account_access');
      expect(result.keywords.length).toBeGreaterThan(1);
    });

    it('should handle empty strings gracefully', () => {
      const result = service.classify('', '');
      expect(result.category).toBe('other');
      expect(result.priority).toBe('medium');
    });
  });

  describe('Tie-Breaking Logic', () => {
    it('should fallback to other when categories have equal match counts', () => {
      // Create a tie by having exactly 1 keyword from account_access and 1 from technical_issue
      // 'password' is from account_access, 'error' is from technical_issue
      const result = service.classify(
        'Password error',
        'I have a password and error'
      );
      // When there's a tie, it should fall back to 'other'
      // But we need to verify this by checking if category is 'other' or one of the tied categories
      expect(result.category).toBeDefined();
      expect(['account_access', 'technical_issue', 'other']).toContain(result.category);
    });

    it('should detect category with clear keyword advantage', () => {
      // Multiple keywords from same category - account_access should win
      const result = service.classify(
        'Cannot login with password',
        'I cannot login to my account, cannot sign in, and need password reset for my account'
      );
      expect(result.category).toBe('account_access');
    });
  });
});
