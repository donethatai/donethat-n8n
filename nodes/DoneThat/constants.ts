/** DoneThat API base URL. */
export const API_BASE_URL = 'https://api.donethat.ai';

/** DoneThat API reference documentation. */
export const API_DOCS_URL = 'https://donethat.ai/api-reference';

/** Allowed project color hex values (DoneThat API). */
export const PROJECT_COLORS = [
  '#FFB623',
  '#4BC0C0',
  '#6C63FF',
  '#FF4590',
  '#32D74B',
  '#FFD166',
  '#845EC2',
  '#00C2FF',
  '#FF6B6B',
  '#00B8A9',
  '#FF9F1C',
  '#F9F871',
  '#EF5DA8',
  '#4ECDC4',
  '#00BBF9',
  '#FF9671',
  '#FCBAD3',
  '#A6E3E9',
  '#FFCB77',
  '#D65DB1',
] as const;

export const PROJECT_COLOR_HELP =
  'Optional. Must be one of the 20 DoneThat palette hex values if set.';
