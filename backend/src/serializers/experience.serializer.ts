export interface ExperienceDbRecord {
  id: string;
  authorName: string | null;
  content: string;
  createdAt: Date;
  [key: string]: unknown; // tolerates hiddenAt
}

export interface SerializedExperience {
  id: string;
  authorName: string | null;
  content: string;
  createdAt: Date;
}

export function serializeExperience(experience: ExperienceDbRecord): SerializedExperience {
  return {
    id: experience.id,
    authorName: experience.authorName,
    content: experience.content,
    createdAt: experience.createdAt,
  };
}
