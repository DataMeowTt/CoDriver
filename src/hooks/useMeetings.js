import { useLiveQuery } from 'dexie-react-hooks';
import db from '../db/database';

/**
 * Get all meetings sorted by date (newest first)
 */
export function useMeetings() {
  return useLiveQuery(() => db.meetings.orderBy('date').reverse().toArray(), []);
}

/**
 * Get a specific meeting by ID
 */
export function useMeeting(id) {
  return useLiveQuery(() => (id ? db.meetings.get(Number(id)) : undefined), [id]);
}

/**
 * Get segments for a meeting
 */
export function useMeetingSegments(meetingId) {
  return useLiveQuery(
    () => (meetingId ? db.segments.where('meetingId').equals(Number(meetingId)).sortBy('startTime') : []),
    [meetingId]
  );
}

/**
 * Get summary for a meeting
 */
export function useMeetingSummary(meetingId) {
  return useLiveQuery(
    () => (meetingId ? db.summaries.where('meetingId').equals(Number(meetingId)).first() : null),
    [meetingId]
  );
}

/**
 * Get audio blob for a meeting
 */
export function useMeetingAudio(meetingId) {
  return useLiveQuery(
    () => (meetingId ? db.audioBlobs.where('meetingId').equals(Number(meetingId)).first() : null),
    [meetingId]
  );
}

/**
 * Create a new meeting
 */
export async function createMeeting(title) {
  const id = await db.meetings.add({
    title: title || `Cuộc họp ${new Date().toLocaleDateString('vi-VN')}`,
    date: new Date(),
    duration: 0,
    status: 'recording',
    transcriptStatus: 'none',
    summaryStatus: 'none',
  });
  return id;
}

/**
 * Update meeting fields
 */
export async function updateMeeting(id, updates) {
  await db.meetings.update(id, updates);
}

/**
 * Add a transcript segment
 */
export async function addSegment(meetingId, segment) {
  await db.segments.add({
    meetingId,
    startTime: segment.startTime || 0,
    endTime: segment.endTime || 0,
    speaker: segment.speaker || '',
    text: segment.text || '',
  });
}

/**
 * Update a segment's text
 */
export async function updateSegment(segmentId, text) {
  await db.segments.update(segmentId, { text });
}

/**
 * Save audio blob
 */
export async function saveAudioBlob(meetingId, blob) {
  await db.audioBlobs.add({ meetingId, blob });
}

/**
 * Save summary
 */
export async function saveSummary(meetingId, summaryData) {
  // Remove existing summary if any
  await db.summaries.where('meetingId').equals(meetingId).delete();
  await db.summaries.add({
    meetingId,
    type: 'full',
    ...summaryData,
  });
}

/**
 * Delete a meeting and all related data
 */
export async function deleteMeeting(id) {
  await db.transaction('rw', [db.meetings, db.segments, db.summaries, db.audioBlobs], async () => {
    await db.meetings.delete(id);
    await db.segments.where('meetingId').equals(id).delete();
    await db.summaries.where('meetingId').equals(id).delete();
    await db.audioBlobs.where('meetingId').equals(id).delete();
  });
}
