-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- DropForeignKey
ALTER TABLE "BoardLink" DROP CONSTRAINT "BoardLink_boardId_fkey";

-- DropForeignKey
ALTER TABLE "CreativeBrief" DROP CONSTRAINT "CreativeBrief_creatorId_fkey";

-- DropForeignKey
ALTER TABLE "FirefliesIntegration" DROP CONSTRAINT "FirefliesIntegration_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "LinkFolder" DROP CONSTRAINT "LinkFolder_boardId_fkey";

-- DropForeignKey
ALTER TABLE "LinkFolderCellValue" DROP CONSTRAINT "LinkFolderCellValue_columnId_fkey";

-- DropForeignKey
ALTER TABLE "LinkFolderCellValue" DROP CONSTRAINT "LinkFolderCellValue_rowId_fkey";

-- DropForeignKey
ALTER TABLE "LinkFolderColumn" DROP CONSTRAINT "LinkFolderColumn_folderId_fkey";

-- DropForeignKey
ALTER TABLE "LinkFolderRow" DROP CONSTRAINT "LinkFolderRow_folderId_fkey";

-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_folderId_fkey";

-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_userId_fkey";

-- DropForeignKey
ALTER TABLE "NoteFolder" DROP CONSTRAINT "NoteFolder_userId_fkey";

-- DropForeignKey
ALTER TABLE "PersonalReminder" DROP CONSTRAINT "PersonalReminder_creatorId_fkey";

-- DropForeignKey
ALTER TABLE "PersonalReminder" DROP CONSTRAINT "PersonalReminder_recipientId_fkey";

-- DropForeignKey
ALTER TABLE "ProcessCanvas" DROP CONSTRAINT "ProcessCanvas_boardId_fkey";

-- DropForeignKey
ALTER TABLE "Subtask" DROP CONSTRAINT "Subtask_taskId_fkey";

-- DropForeignKey
ALTER TABLE "SupportTicket" DROP CONSTRAINT "SupportTicket_reporterId_fkey";

-- DropForeignKey
ALTER TABLE "TableColumn" DROP CONSTRAINT "TableColumn_boardId_fkey";

-- DropForeignKey
ALTER TABLE "TaskCustomValue" DROP CONSTRAINT "TaskCustomValue_columnId_fkey";

-- DropForeignKey
ALTER TABLE "TaskCustomValue" DROP CONSTRAINT "TaskCustomValue_taskId_fkey";

-- DropForeignKey
ALTER TABLE "TaskPoll" DROP CONSTRAINT "TaskPoll_authorId_fkey";

-- DropForeignKey
ALTER TABLE "TaskPoll" DROP CONSTRAINT "TaskPoll_taskId_fkey";

-- DropForeignKey
ALTER TABLE "TaskPollOption" DROP CONSTRAINT "TaskPollOption_pollId_fkey";

-- DropForeignKey
ALTER TABLE "TaskPollVote" DROP CONSTRAINT "TaskPollVote_optionId_fkey";

-- DropForeignKey
ALTER TABLE "TaskPollVote" DROP CONSTRAINT "TaskPollVote_pollId_fkey";

-- DropForeignKey
ALTER TABLE "TaskPollVote" DROP CONSTRAINT "TaskPollVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "TodoFolder" DROP CONSTRAINT "TodoFolder_parentId_fkey";

-- DropForeignKey
ALTER TABLE "TodoFolder" DROP CONSTRAINT "TodoFolder_userId_fkey";

-- DropForeignKey
ALTER TABLE "TodoItem" DROP CONSTRAINT "TodoItem_listId_fkey";

-- DropForeignKey
ALTER TABLE "TodoItem" DROP CONSTRAINT "TodoItem_userId_fkey";

-- DropForeignKey
ALTER TABLE "TodoList" DROP CONSTRAINT "TodoList_folderId_fkey";

-- DropForeignKey
ALTER TABLE "TodoList" DROP CONSTRAINT "TodoList_userId_fkey";

-- DropForeignKey
ALTER TABLE "TodoStep" DROP CONSTRAINT "TodoStep_itemId_fkey";

-- DropForeignKey
ALTER TABLE "WikiPage" DROP CONSTRAINT "WikiPage_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "WikiPage" DROP CONSTRAINT "WikiPage_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "WorkspaceEvent" DROP CONSTRAINT "WorkspaceEvent_creatorId_fkey";

-- DropIndex
DROP INDEX "Note_deletedAt_idx";

-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "FirefliesIntegration" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "boardId" TEXT;

-- AlterTable
ALTER TABLE "LinkFolder" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LinkFolderCellValue" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LinkFolderRow" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Note" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "NoteFolder" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PersonalReminder" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Subtask" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TableColumn" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TaskCustomValue" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TodoFolder" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TodoItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TodoList" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TodoStep" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WikiPage" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "BoardMembership" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardMembership_userId_idx" ON "BoardMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BoardMembership_boardId_userId_key" ON "BoardMembership"("boardId", "userId");

-- CreateIndex
CREATE INDEX "Invitation_boardId_idx" ON "Invitation"("boardId");

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardMembership" ADD CONSTRAINT "BoardMembership_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardMembership" ADD CONSTRAINT "BoardMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardLink" ADD CONSTRAINT "BoardLink_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkFolder" ADD CONSTRAINT "LinkFolder_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkFolderColumn" ADD CONSTRAINT "LinkFolderColumn_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "LinkFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkFolderRow" ADD CONSTRAINT "LinkFolderRow_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "LinkFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkFolderCellValue" ADD CONSTRAINT "LinkFolderCellValue_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "LinkFolderRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkFolderCellValue" ADD CONSTRAINT "LinkFolderCellValue_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "LinkFolderColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableColumn" ADD CONSTRAINT "TableColumn_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCustomValue" ADD CONSTRAINT "TaskCustomValue_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCustomValue" ADD CONSTRAINT "TaskCustomValue_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "TableColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceEvent" ADD CONSTRAINT "WorkspaceEvent_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeBrief" ADD CONSTRAINT "CreativeBrief_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subtask" ADD CONSTRAINT "Subtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPoll" ADD CONSTRAINT "TaskPoll_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPoll" ADD CONSTRAINT "TaskPoll_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPollOption" ADD CONSTRAINT "TaskPollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "TaskPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPollVote" ADD CONSTRAINT "TaskPollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "TaskPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPollVote" ADD CONSTRAINT "TaskPollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "TaskPollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPollVote" ADD CONSTRAINT "TaskPollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessCanvas" ADD CONSTRAINT "ProcessCanvas_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoFolder" ADD CONSTRAINT "TodoFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoFolder" ADD CONSTRAINT "TodoFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TodoFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoList" ADD CONSTRAINT "TodoList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoList" ADD CONSTRAINT "TodoList_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "TodoFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "TodoList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoStep" ADD CONSTRAINT "TodoStep_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "TodoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteFolder" ADD CONSTRAINT "NoteFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "NoteFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalReminder" ADD CONSTRAINT "PersonalReminder_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalReminder" ADD CONSTRAINT "PersonalReminder_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPage" ADD CONSTRAINT "WikiPage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPage" ADD CONSTRAINT "WikiPage_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirefliesIntegration" ADD CONSTRAINT "FirefliesIntegration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
