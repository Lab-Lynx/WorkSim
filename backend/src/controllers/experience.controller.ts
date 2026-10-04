import { Request, Response, NextFunction } from 'express';
import {
  createExperience as createExperienceService,
  listExperiences as listExperiencesService,
  getExperienceById,
  hideExperience as hideExperienceService,
} from '../services/experience.service';
import { serializeExperience } from '../serializers/experience.serializer';

// GET /experiences
export async function listExperiences(req: Request, res: Response, next: NextFunction) {
  try {
    const { cursor, limit } = req.query as unknown as { cursor?: string; limit: number };
    const { items, nextCursor } = await listExperiencesService({ cursor, limit } as any);
    res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'Experiences',
      data: { items: items.map(serializeExperience), nextCursor },
    });
  } catch (err) {
    next(err);
  }
}

// GET /experiences/:id
export async function getExperience(req: Request, res: Response, next: NextFunction) {
  try {
    const experience = await getExperienceById(req.params.id);
    if (!experience) {
      // Not forwarded to next() — a hidden-or-missing experience is a
      // plain, expected 404 here, not an application error to log.
      res.status(404).json({
        statusCode: 404,
        success: false,
        message: 'Experience not found',
        data: null,
      });
      return;
    }
    res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'Experience',
      data: { experience: serializeExperience(experience) },
    });
  } catch (err) {
    next(err);
  }
}

// POST /experiences
export async function createExperience(req: Request, res: Response, next: NextFunction) {
  try {
    const created = await createExperienceService(req.body);
    // Always 201, honeypot-tripped or not — the service already returns a
    // plausible-looking result either way, and the controller has no
    // business knowing or reacting to which case it was.
    res.status(201).json({
      statusCode: 201,
      success: true,
      message: 'Experience created',
      data: { experience: serializeExperience(created) },
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /experiences/:id
export async function hideExperience(req: Request, res: Response, next: NextFunction) {
  try {
    await hideExperienceService(req.params.id);
    res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'Experience hidden',
      data: null,
    });
  } catch (err) {
    next(err);
  }
}
