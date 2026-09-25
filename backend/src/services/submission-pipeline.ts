/**
 * Kick CI/evaluator work after submit or retry.
 * Webhook + evaluation epics own the real implementation.
 */
export const startSubmissionPipeline = async (submissionId: string): Promise<void> => {
  void submissionId;
};
