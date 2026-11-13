import { randomId } from './randomId';

const subjects = new Map<string, string>();

export function getRecommendationSubjectId(username: string): string {
  let subjectId = subjects.get(username);
  if (!subjectId) {
    const key = `gkfeed.recommendation-subject.v1:${encodeURIComponent(username)}`;
    subjectId = randomId();
    try {
      subjectId = localStorage.getItem(key) || subjectId;
      localStorage.setItem(key, subjectId);
    } catch { /* Keep recording for this visit when storage is unavailable. */ }
    subjects.set(username, subjectId);
  }
  return subjectId;
}
