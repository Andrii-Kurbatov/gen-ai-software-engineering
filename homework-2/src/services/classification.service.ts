import {
  ClassificationResult,
  Category,
  Priority,
} from '../types/ticket.types';

const CATEGORY_KEYWORDS: Record<Exclude<Category, 'other'>, string[]> = {
  account_access: [
    'login',
    'password',
    '2fa',
    'two-factor',
    'locked out',
    "can't sign in",
    'account access',
    'sign in',
  ],
  technical_issue: [
    'error',
    'crash',
    'exception',
    'not working',
    'broken',
    'fails',
    'failure',
    '500',
    'timeout',
    'bug',
  ],
  billing_question: [
    'invoice',
    'payment',
    'charge',
    'refund',
    'billing',
    'subscription',
    'receipt',
    'overcharged',
  ],
  feature_request: [
    'feature',
    'enhancement',
    'would be nice',
    'suggestion',
    'improve',
    'add support for',
    'request',
  ],
  bug_report: [
    'reproduce',
    'steps to reproduce',
    'expected behavior',
    'actual behavior',
    'regression',
    'defect',
  ],
};

const PRIORITY_KEYWORDS: {
  urgent: string[];
  high: string[];
  low: string[];
} = {
  urgent: [
    "can't access",
    'critical',
    'production down',
    'security',
    'data loss',
    'breach',
    'outage',
  ],
  high: ['important', 'blocking', 'asap', 'blocker', 'high priority'],
  low: ['minor', 'cosmetic', 'suggestion', 'nice to have', 'whenever'],
};

export class ClassificationService {
  classify(subject: string, description: string): ClassificationResult {
    const text = `${subject} ${description}`.toLowerCase();

    let bestCategory: Category = 'other';
    let maxScore = 0;
    let isTie = false;
    const matchedCategoryKeywords: string[] = [];

    for (const [category, keywords] of Object.entries(
      CATEGORY_KEYWORDS
    ) as [Exclude<Category, 'other'>, string[]][]) {
      const matches = keywords.filter((kw) => text.includes(kw));
      const score = matches.length;

      if (score > maxScore) {
        maxScore = score;
        bestCategory = category;
        isTie = false;
        matchedCategoryKeywords.length = 0;
        matchedCategoryKeywords.push(...matches);
      } else if (score === maxScore && score > 0) {
        isTie = true;
      }
    }

    if (isTie) {
      bestCategory = 'other';
      matchedCategoryKeywords.length = 0;
    }

    let bestPriority: Priority = 'medium';
    let matchedPriorityKeyword: string | null = null;

    for (const level of ['urgent', 'high', 'low'] as const) {
      const match = PRIORITY_KEYWORDS[level].find((kw) =>
        text.includes(kw)
      );
      if (match) {
        bestPriority = level;
        matchedPriorityKeyword = match;
        break;
      }
    }

    const categoryKeywords =
      bestCategory !== 'other'
        ? CATEGORY_KEYWORDS[bestCategory as Exclude<Category, 'other'>]
        : [];

    const confidence =
      categoryKeywords.length > 0
        ? Math.round(
            (matchedCategoryKeywords.length / categoryKeywords.length) * 100
          ) / 100
        : 0;

    const keywords: string[] = [
      ...matchedCategoryKeywords,
      ...(matchedPriorityKeyword ? [matchedPriorityKeyword] : []),
    ];

    const reasoning =
      matchedCategoryKeywords.length > 0
        ? `Matched ${matchedCategoryKeywords.length} ${bestCategory} keywords: ${matchedCategoryKeywords.join(
            ', '
          )}.` +
          (matchedPriorityKeyword
            ? ` Priority ${bestPriority}: found '${matchedPriorityKeyword}'.`
            : ` Priority ${bestPriority}: no keyword match, using default.`)
        : 'No category keywords matched, using default.' +
          (matchedPriorityKeyword
            ? ` Priority ${bestPriority}: found '${matchedPriorityKeyword}'.`
            : '');

    const result: ClassificationResult = {
      ticket_id: '',
      category: bestCategory,
      priority: bestPriority,
      confidence,
      reasoning,
      keywords,
    };

    console.debug(
      `[classify] ticketId=${result.ticket_id} category=${bestCategory} priority=${bestPriority} confidence=${confidence}`
    );

    return result;
  }
}
