import type { Role } from "@/lib/generated/prisma/enums";

export type Action =
  | "workspace.delete"
  | "workspace.updateSettings"
  | "workspace.inviteMember"
  | "workspace.removeMember"
  | "workspace.changeRole"
  | "board.create"
  | "board.delete"
  | "board.update"
  | "board.view"
  | "task.create"
  | "task.update"
  | "task.delete"
  | "task.assignUsers"
  | "task.comment"
  | "task.upload"
  | "milestone.create"
  | "milestone.update"
  | "milestone.delete"
  | "canvas.create"
  | "canvas.edit"
  | "canvas.delete"
  | "tag.manage"
  | "background.customize";

const MATRIX: Record<Role, Set<Action>> = {
  ADMIN: new Set<Action>([
    "workspace.delete",
    "workspace.updateSettings",
    "workspace.inviteMember",
    "workspace.removeMember",
    "workspace.changeRole",
    "board.create",
    "board.delete",
    "board.update",
    "board.view",
    "task.create",
    "task.update",
    "task.delete",
    "task.assignUsers",
    "task.comment",
    "task.upload",
    "milestone.create",
    "milestone.update",
    "milestone.delete",
    "canvas.create",
    "canvas.edit",
    "canvas.delete",
    "tag.manage",
    "background.customize",
  ]),
  MEMBER: new Set<Action>([
    "board.create",
    "board.update",
    "board.view",
    "task.create",
    "task.update",
    "task.delete",
    "task.assignUsers",
    "task.comment",
    "task.upload",
    "milestone.create",
    "milestone.update",
    "milestone.delete",
    "canvas.create",
    "canvas.edit",
    "tag.manage",
    "background.customize",
  ]),
  VIEWER: new Set<Action>(["board.view", "task.comment"]),
};

export function can(role: Role, action: Action): boolean {
  return MATRIX[role].has(action);
}

export class ForbiddenError extends Error {
  constructor(action: Action) {
    super(`Forbidden: ${action}`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(role: Role, action: Action): void {
  if (!can(role, action)) throw new ForbiddenError(action);
}
