import Dexie from 'dexie';

const db = new Dexie('MeetingRecorderDB');

db.version(1).stores({
  meetings: '++id, title, date, duration, status, transcriptStatus, summaryStatus',
  segments: '++id, meetingId, startTime, endTime, speaker, text',
  summaries: '++id, meetingId, type',
  audioBlobs: '++id, meetingId',
});

export default db;
