import { z } from "zod";

export const linkTaskToNodeSchema = z.object({
  nodeId: z.string().min(1),
  taskId: z.string().min(1),
});

export const unlinkTaskFromNodeSchema = z.object({
  nodeId: z.string().min(1),
  taskId: z.string().min(1),
});

export const createAndLinkTaskFromNodeSchema = z.object({
  nodeId: z.string().min(1),
  boardId: z.string().min(1),
  title: z.string().trim().min(1, "Tytuł wymagany.").max(200),
});

export type LinkTaskToNodeInput = z.infer<typeof linkTaskToNodeSchema>;
export type UnlinkTaskFromNodeInput = z.infer<typeof unlinkTaskFromNodeSchema>;
export type CreateAndLinkTaskFromNodeInput = z.infer<typeof createAndLinkTaskFromNodeSchema>;
