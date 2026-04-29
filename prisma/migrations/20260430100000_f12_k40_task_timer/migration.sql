-- F12-K40: per-task time tracking. Trzy stany: idle / running / completed.
-- accumulator (timeTrackedSeconds) zachowuje się przez pause/resume cykle.

ALTER TABLE "Task"
  ADD COLUMN "timeTrackedSeconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "timerStartedAt"     TIMESTAMP(3),
  ADD COLUMN "timerCompletedAt"   TIMESTAMP(3);
