import {
  Prisma,
  type Evaluation,
  type MentorMessage,
  type Submission,
  type Ticket,
} from '@prisma/client';
import { prisma } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import {
  calculateWeightedScore as calculateRubricWeightedScore,
  type RubricScores,
} from '../lib/scoring/rubric.js';
import { callEvaluatorModel } from '../integrations/groq.js';
import type {
  EvaluationInput,
  MentorTranscriptMessage,
  TicketContent,
} from '../types/domain.js';

export function calculateWeightedScore(scores: RubricScores): number {
  return calculateRubricWeightedScore(scores);
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

function validateTicketContent(rawContent: unknown): TicketContent {
  if (!rawContent || typeof rawContent !== 'object') {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Malformed ticket content');
  }

  const content = rawContent as Record<string, unknown>;
  const requiredStringFields: (keyof TicketContent)[] = [
    'title',
    'scenario',
    'category',
    'difficulty',
  ];

  for (const field of requiredStringFields) {
    if (typeof content[field] !== 'string' || (content[field] as string).trim().length === 0) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `Malformed ticket content: missing or invalid ${field}`,
      );
    }
  }

  if (
    !isStringArray(content.touchedFiles) ||
    !isStringArray(content.acceptanceCriteria) ||
    !isStringArray(content.testChecklist)
  ) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      'Malformed ticket content: invalid list fields',
    );
  }

  return content as unknown as TicketContent;
}

export function buildEvaluationInput(
  submission: Pick<Submission, 'attempt' | 'diff' | 'ciPassed'>,
  ticket: Pick<Ticket, 'content'>,
  transcript?: Pick<MentorMessage, 'role' | 'content'>[],
): EvaluationInput {
  if (submission.ciPassed === null || submission.ciPassed === undefined) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      'Submission CI result is required for evaluation',
    );
  }

  if (typeof submission.diff !== 'string') {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      'Submission diff is required for evaluation',
    );
  }

  if (submission.attempt !== 1 && submission.attempt !== 2) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid submission attempt');
  }

  const ticketContent = validateTicketContent(ticket.content);

  if (submission.attempt === 1) {
    return {
      attempt: 1,
      ticketContent,
      diff: submission.diff,
      ciPassed: submission.ciPassed,
    };
  }

  const mappedTranscript: MentorTranscriptMessage[] | undefined = transcript
    ? transcript.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))
    : undefined;

  return {
    attempt: 2,
    ticketContent,
    diff: submission.diff,
    ciPassed: submission.ciPassed,
    ...(mappedTranscript ? { transcript: mappedTranscript } : {}),
  };
}

export async function evaluateSubmission(submissionId: string): Promise<Evaluation> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { ticket: true },
  });

  if (!submission) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Submission not found');
  }

  let transcript: MentorMessage[] | undefined;
  if (submission.attempt === 2) {
    transcript = await prisma.mentorMessage.findMany({
      where: { ticketId: submission.ticketId },
      orderBy: { createdAt: 'asc' },
    });
  }

  const evaluationInput = buildEvaluationInput(
    submission,
    submission.ticket,
    transcript,
  );

  const evaluatorOutput = await callEvaluatorModel(evaluationInput);

  if (
    !evaluatorOutput ||
    typeof evaluatorOutput.feedback !== 'string' ||
    evaluatorOutput.feedback.trim().length === 0
  ) {
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'Evaluator output missing or empty feedback',
    );
  }

  const feedback = evaluatorOutput.feedback.trim();

  let requirementsMetScore: number | null = null;
  let correctnessTestsScore: number | null = null;
  let codeQualityScore: number | null = null;
  let problemSolvingScore: number | null = null;
  let totalScore: Prisma.Decimal | null = null;

  if (submission.attempt === 2) {
    const rawScores = evaluatorOutput.scores;
    if (!rawScores || typeof rawScores !== 'object') {
      throw new ApiError(
        HTTP_STATUS.BAD_GATEWAY,
        'Evaluator output missing scores object on attempt 2',
      );
    }

    const { requirementsMet, correctnessTests, codeQuality, problemSolving } = rawScores;

    const isValidScore = (val: unknown): val is number =>
      typeof val === 'number' && Number.isFinite(val) && val >= 0 && val <= 100;

    if (
      !isValidScore(requirementsMet) ||
      !isValidScore(correctnessTests) ||
      !isValidScore(codeQuality) ||
      !isValidScore(problemSolving)
    ) {
      throw new ApiError(
        HTTP_STATUS.BAD_GATEWAY,
        'Evaluator output category scores must be finite numbers between 0 and 100',
      );
    }

    const weightedTotal = calculateWeightedScore({
      requirementsMet,
      correctnessTests,
      codeQuality,
      problemSolving,
    });

    requirementsMetScore = Math.round(requirementsMet);
    correctnessTestsScore = Math.round(correctnessTests);
    codeQualityScore = Math.round(codeQuality);
    problemSolvingScore = Math.round(problemSolving);
    totalScore = new Prisma.Decimal(weightedTotal.toFixed(2));
  }

  try {
    return await prisma.evaluation.create({
      data: {
        submissionId: submission.id,
        feedback,
        requirementsMetScore,
        correctnessTestsScore,
        codeQualityScore,
        problemSolvingScore,
        totalScore,
      },
    });
  } catch (err: unknown) {
    if (
      (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') ||
      (err instanceof Error && /unique/i.test(err.message))
    ) {
      const existing = await prisma.evaluation.findUnique({
        where: { submissionId: submission.id },
      });
      if (existing) {
        return existing;
      }
    }
    throw err;
  }
}
