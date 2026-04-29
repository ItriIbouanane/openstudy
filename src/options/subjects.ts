export interface SubjectOption {
  name: string;
  color: `#${string}`;
  default?: boolean;
}

export const subjects: SubjectOption[] = [
  { name: 'Biology', color: '#22c55e' },
  { name: 'Chemistry', color: '#f97316' },
  { name: 'Computer Science', color: '#3b82f6' },
  { name: 'History', color: '#a855f7' },
  { name: 'Mathematics', color: '#eab308' },
  { name: 'Physics', color: '#06b6d4' },
  { name: 'Literature', color: '#ec4899' },
  { name: 'General', color: '#13248b', default: true }, // Chill color for general subjects
];
