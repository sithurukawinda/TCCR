import { createHttpError } from '@shared/errors';
import { CellType }        from './CellGroup';

export type ReportLanguage        = 'si' | 'ta' | 'en';
export type SubjectDiscussed      = 'sunday_sermon' | 'other';
export type ContactedAbsenteesVal = 'yes' | 'no' | 'future';

export interface AttendanceEntry {
  userUid?:  string;
  name:      string;
  status:    'present' | 'absent' | 'new';
  isNew:     boolean;
}

export interface CellReportProps {
  id:                      string;
  cellId:                  string;
  filledByUid:             string;
  clientReqId:             string;
  date:                    string;
  didMeet:                 boolean;
  noMeetReason?:           string | null;
  leaderPresent:           boolean;
  conductedByIfAbsent?:    string | null;
  location:                string;
  timeStarted:             string;
  timeEnded:               string;
  language:                ReportLanguage;
  subjectDiscussed:        SubjectDiscussed;
  otherSubjectReason?:     string | null;
  cellType:                CellType;
  g12LeaderUid:            string;
  immediateG12LeaderText?: string | null;
  attendance:              AttendanceEntry[];
  contactedAbsentees:      ContactedAbsenteesVal;
  absenteeNotes?:          string | null;
  additionalVisitors:      number;
  childrenCount:           number;
  satisfactionRate:        number;   // 1–6
  additionalInfo?:         string | null;
  photoUrls:               string[]; // up to 10 meeting photo URLs
  voided:                  boolean;
  createdAt:               string;
}

export class CellReport {
  id:                      string;
  cellId:                  string;
  filledByUid:             string;
  clientReqId:             string;
  date:                    string;
  didMeet:                 boolean;
  noMeetReason:            string | null;
  leaderPresent:           boolean;
  conductedByIfAbsent:     string | null;
  location:                string;
  timeStarted:             string;
  timeEnded:               string;
  language:                ReportLanguage;
  subjectDiscussed:        SubjectDiscussed;
  otherSubjectReason:      string | null;
  cellType:                CellType;
  g12LeaderUid:            string;
  immediateG12LeaderText:  string | null;
  attendance:              AttendanceEntry[];
  contactedAbsentees:      ContactedAbsenteesVal;
  absenteeNotes:           string | null;
  additionalVisitors:      number;
  childrenCount:           number;
  satisfactionRate:        number;
  additionalInfo:          string | null;
  photoUrls:               string[];
  voided:                  boolean;
  readonly createdAt:      string;

  constructor(props: CellReportProps) {
    this.id                     = props.id;
    this.cellId                 = props.cellId;
    this.filledByUid            = props.filledByUid;
    this.clientReqId            = props.clientReqId;
    this.date                   = props.date;
    this.didMeet                = props.didMeet;
    this.noMeetReason           = props.noMeetReason           ?? null;
    this.leaderPresent          = props.leaderPresent;
    this.conductedByIfAbsent    = props.conductedByIfAbsent    ?? null;
    this.location               = props.location;
    this.timeStarted            = props.timeStarted;
    this.timeEnded              = props.timeEnded;
    this.language               = props.language;
    this.subjectDiscussed       = props.subjectDiscussed;
    this.otherSubjectReason     = props.otherSubjectReason     ?? null;
    this.cellType               = props.cellType;
    this.g12LeaderUid           = props.g12LeaderUid;
    this.immediateG12LeaderText = props.immediateG12LeaderText ?? null;
    this.attendance             = props.attendance;
    this.contactedAbsentees     = props.contactedAbsentees;
    this.absenteeNotes          = props.absenteeNotes          ?? null;
    this.additionalVisitors     = props.additionalVisitors;
    this.childrenCount          = props.childrenCount;
    this.satisfactionRate       = props.satisfactionRate;
    this.additionalInfo         = props.additionalInfo         ?? null;
    this.photoUrls              = props.photoUrls              ?? [];
    this.voided                 = props.voided;
    this.createdAt              = props.createdAt;
  }

  void(reason: string): void {
    if (this.voided) {
      throw createHttpError(409, 'REPORT_ALREADY_VOIDED', 'This report has already been voided.');
    }
    this.voided         = true;
    this.additionalInfo = reason;
  }
}
