// backend/src/serializers/repo.serializer.ts

export interface RepoDbRecord {
  fullName: string;
  starterTemplate: string;
  defaultBranch: string;
  [key: string]: unknown;
}

export interface SerializedRepo {
  fullName: string;
  starterTemplate: string;
  defaultBranch: string;
}

export function serializeRepo(repo: RepoDbRecord): SerializedRepo {
  return {
    fullName: repo.fullName,
    starterTemplate: repo.starterTemplate,
    defaultBranch: repo.defaultBranch,
  };
}
