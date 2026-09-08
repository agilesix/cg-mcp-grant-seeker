// Compatibility exports for existing app consumers. Shared data operations live in core/service/.
export * from '../../core/service/shortlist.js';
export { assembleShortlist as presentOpportunityShortlist } from '../../core/service/shortlist.js';

export const presentShortlistDefinition = {
  title: 'Present grant opportunity shortlist',
  description: [
    'After completed grant research produces one or more recommended opportunities, call this tool automatically to present the final ranked shortlist.',
    'Call it as soon as the current search results provide enough relevant candidates.',
    'For a non-exhaustive request, five or more clearly relevant candidates are ordinarily enough to present.',
    'Do not delay presentation for additional searches that are unlikely to materially improve relevance or coverage.',
    'Search results preserve provider fields needed for ranking, and this tool retrieves every selected opportunity in full.',
    'Do not call get_opportunity for each candidate before this tool unless a search result is missing information required for selection.',
    'Do not wait for the user to request the shortlist or offer it as a separate optional step.',
    'The host may ask the user for permission; that approval flow is sufficient and should not prevent the call.',
    'Call once per completed shortlist revision, not for intermediate searches.',
    'If this call is denied or fails, provide a concise plain-text shortlist instead.',
    'After a successful call, do not duplicate the full shortlist in prose.',
    'Include one to eight unique source-scoped references worth showing, in final display order.',
    'If research context is included, list each distinct full-text query term separately.',
    'Also report any filters and ordering actually applied to the final shortlist so the view can explain the selection.',
    'The server retrieves and preserves each complete SDK-validated opportunity.',
    'The attached view displays a concise subset without narrowing structuredContent.',
  ].join(' '),
  annotations: { readOnlyHint: true, openWorldHint: true },
};
