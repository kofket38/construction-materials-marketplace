import type { Request, Response } from "express";
import type { ProjectService } from "../services/project.service.js";
import { UnauthorizedError } from "../utils/api-error.js";
import type {
  ChangeProjectStatusBody,
  CreateProjectBody,
  ListPublishedProjectsQueryParams,
  ProjectIdParams,
  ReorderProjectsBody,
  UpdateProjectBody,
} from "../validators/project.validators.js";

export class ProjectController {
  constructor(private readonly service: ProjectService) {}

  // ── Public search ───────────────────────────────────────────────────────────

  /** GET /api/projects */
  list = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.searchPublishedProjects(
      req.query as ListPublishedProjectsQueryParams,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  // ── Owner mutations / reads ────────────────────────────────────────────────

  /** POST /api/projects */
  create = async (req: Request, res: Response): Promise<void> => {
    const project = await this.service.createProject(
      this.requireActor(req),
      req.body as CreateProjectBody,
    );

    res.status(201).json({ success: true, data: { project } });
  };

  /** GET /api/projects/me */
  getMyProjects = async (req: Request, res: Response): Promise<void> => {
    const projects = await this.service.getMyProjects(this.requireActor(req));

    res.status(200).json({ success: true, data: { projects } });
  };

  /** PUT /api/projects/me/reorder */
  reorder = async (req: Request, res: Response): Promise<void> => {
    const projects = await this.service.reorderProjects(
      this.requireActor(req),
      req.body as ReorderProjectsBody,
    );

    res.status(200).json({ success: true, data: { projects } });
  };

  // ── Public / mixed detail ──────────────────────────────────────────────────

  /**
   * GET /api/projects/:projectId
   *
   * Owners may read their project in any status; everyone else only sees
   * PUBLISHED projects. Non-published projects are reported as missing so
   * hidden state and existence never leak.
   */
  getById = async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params as ProjectIdParams;
    const project = await this.service.getProject(
      req.auth ?? null,
      projectId,
    );

    res.status(200).json({ success: true, data: { project } });
  };

  /** PATCH /api/projects/:projectId */
  update = async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params as ProjectIdParams;
    const project = await this.service.updateProject(
      this.requireActor(req),
      projectId,
      req.body as UpdateProjectBody,
    );

    res.status(200).json({ success: true, data: { project } });
  };

  /** PATCH /api/projects/:projectId/status */
  changeStatus = async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params as ProjectIdParams;
    const project = await this.service.changeProjectStatus(
      this.requireActor(req),
      projectId,
      req.body as ChangeProjectStatusBody,
    );

    res.status(200).json({ success: true, data: { project } });
  };

  /** DELETE /api/projects/:projectId */
  delete = async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params as ProjectIdParams;
    await this.service.deleteProject(this.requireActor(req), projectId);

    res.status(200).json({ success: true, data: null });
  };

  // ── Private helpers ────────────────────────────────────────────────────────

  private requireActor(req: Request) {
    if (!req.auth) {
      throw new UnauthorizedError();
    }
    return req.auth;
  }
}
