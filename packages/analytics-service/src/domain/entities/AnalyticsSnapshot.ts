export interface AttendanceMetrics {
  present:      number;
  absent:       number;
  visitors:     number;
  children:     number;
  newAttendees: number;
}

export interface MeetingTypeBreakdown {
  g12:      number;
  care:     number;
  children: number;
  outreach: number;
}

export interface ParticipationEntry {
  leaderUid:         string;
  leaderName:        string;
  averageAttendance: number;
  cellCount:         number;
}

export interface SnapshotMetrics {
  cellCount:             number;
  activeCells:           number;
  reportCount:           number;
  attendance:            AttendanceMetrics;
  meetingTypeBreakdown:  MeetingTypeBreakdown;
  memberGrowth:          number;
  participationRate:     number;
  averageSatisfaction:   number;
  participationByLeader: ParticipationEntry[];
}

export interface AnalyticsSnapshotProps {
  id:          string; // {scope}_{periodKey}
  scope:       string; // "leader:{uid}" | "g12:{uid}" | "org"
  periodKey:   string; // "YYYY-WW"
  metrics:     SnapshotMetrics;
  computedAt:  string;
}

export class AnalyticsSnapshot {
  id:         string;
  scope:      string;
  periodKey:  string;
  metrics:    SnapshotMetrics;
  computedAt: string;

  constructor(props: AnalyticsSnapshotProps) {
    this.id         = props.id;
    this.scope      = props.scope;
    this.periodKey  = props.periodKey;
    this.metrics    = props.metrics;
    this.computedAt = props.computedAt;
  }
}
