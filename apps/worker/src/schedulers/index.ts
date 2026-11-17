export interface SchedulerBootstrapDescriptor {
  readonly enabledInPhase: string;
  readonly activeSchedules: number;
}

export function getSchedulerBootstrapDescriptor(): SchedulerBootstrapDescriptor {
  return {
    enabledInPhase: 'phase-2',
    activeSchedules: 0,
  };
}
