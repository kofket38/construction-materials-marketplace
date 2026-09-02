import type { Request, Response } from "express";
import type { ProjectService } from "../services/project.service.js";
import { UnauthorizedError } from "../utils/api-error.js";
import type {
  ChangeProjectStatusBody,
  CreateProjectBody,
  ListPublishedProjectsQueryParams,
  ProjectIdParams,
  ProjectOrderLinkParams,
  ProjectRfqLinkParams,
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
   * Owners may read their project in any status and receive the full
   * ProjectEntity shape. Anonymous / non-owner callers receive the enriched
   * public detail shape (with safe owner info) for PUBLISHED projects only.
   * Non-published projects are reported as missing so hidden state never leaks.
   */
  getById = async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params as ProjectIdParams;

    // Authenticated owner: return the full owner project shape.
    if (req.auth) {
      const existingProject = await this.service.getProject(req.auth, projectId);

      // Check if the caller is the owner; if so, return the owner shape.
      // If they are authenticated but NOT the owner and the project is
      // published, fall through to the public shape below.
      if (existingProject.ownerId === req.auth.userId) {
        res.status(200).json({ success: true, data: { project: existingProject } });
        return;
      }
    }

    // Public / non-owner path: return enriched public detail (PUBLISHED only).
    const project = await this.service.getPublicProject(projectId);
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

  // ── Linked procurement (owner-private) ─────────────────────────────────────

  /**
   * GET /api/projects/:projectId/procurement
   *
   * Owner-only. Lists the RFQs and orders the professional attached to this
   * project. Non-owners receive the same 404 a missing project produces, so
   * this never doubles as a project-existence probe.
   */
  getProcurement = async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params as ProjectIdParams;
    const procurement = await this.service.getProjectProcurement(
      this.requireActor(req),
      projectId,
    );

    res.status(200).json({ success: true, data: procurement });
  };

  /**
   * DELETE /api/projects/:projectId/procurement/rfqs/:rfqId
   *
   * Owner-only. Clears the project link on one attached RFQ without touching
   * the RFQ itself. Required because the procurement foreign keys are ON
   * DELETE RESTRICT: an owner has to be able to release the link before the
   * project can be deleted.
   */
  detachRfq = async (req: Request, res: Response): Promise<void> => {
    const { projectId, rfqId } = req.params as ProjectRfqLinkParams;
    await this.service.detachProjectRfq(
      this.requireActor(req),
      projectId,
      rfqId,
    );

    res.status(200).json({ success: true, data: null });
  };

  /**
   * DELETE /api/projects/:projectId/procurement/orders/:orderId
   *
   * Owner-only. Clears the project link on one attached order without touching
   * the order itself.
   */
  detachOrder = async (req: Request, res: Response): Promise<void> => {
    const { projectId, orderId } = req.params as ProjectOrderLinkParams;
    await this.service.detachProjectOrder(
      this.requireActor(req),
      projectId,
      orderId,
    );

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
