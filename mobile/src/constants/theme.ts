export const colors = {
  primary: '#FF5A1F',
  primaryDark: '#E04A12',
  primarySoft: '#FFF1EA',
  text: '#1B1F3B',
  textSecondary: '#5F6478',
  textMuted: '#9A9FB0',
  background: '#F5F6FA',
  card: '#FFFFFF',
  border: '#E6E8F0',
  success: '#1E9E5A',
  successSoft: '#E6F6EE',
  warning: '#C77700',
  warningSoft: '#FFF6E0',
  danger: '#D93636',
  dangerSoft: '#FDECEC',
  info: '#2F6FED',
  infoSoft: '#EAF1FE',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const platformColors: Record<string, string> = {
  taobao: '#FF5000',
  tmall: '#E1251B',
  '1688': '#FF6A00',
  alibaba: '#FF7300',
  jd: '#E2231A',
  weidian: '#D9363E',
  other: '#5F6478',
};

/** Couleurs des tuiles d'images de démonstration, par catégorie. */
export const categoryTints: Record<string, [string, string]> = {
  women: ['#FDE2EC', '#F7A8C4'],
  men: ['#E1E9FB', '#A5BDF2'],
  shoes: ['#E7F5EC', '#9ED8B4'],
  bags: ['#F6EADF', '#E0B48C'],
  jewelry: ['#FFF4D6', '#F2CF6B'],
  electronics: ['#E3EEF7', '#8DB8DD'],
  phone: ['#ECE7FA', '#B7A6EE'],
  home: ['#F3EEE7', '#D7C2A5'],
  kitchen: ['#FBE9E4', '#F0AE9C'],
  beauty: ['#FBE6F3', '#EBA6D2'],
  kids: ['#FFF0DE', '#F7C38A'],
  sport: ['#E2F4F1', '#8FD3C7'],
  auto: ['#E8EAEE', '#AEB5C2'],
  tools: ['#FCEFE0', '#E9B57A'],
  office: ['#EEF3E3', '#BFD39A'],
  wholesale: ['#F1ECE4', '#C9B79D'],
  qc: ['#ECEFF3', '#B8C0CC'],
};
